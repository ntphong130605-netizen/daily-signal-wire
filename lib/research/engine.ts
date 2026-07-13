import { Prisma } from "@prisma/client";
import { logError, logInfo } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getResearchConfig } from "@/lib/research/config";
import { researchAdapters, researchSourceReadiness } from "@/lib/research/adapters";
import { buildResearchBrief } from "@/lib/research/brief";
import {
  clusterKeyFor,
  normalizeKeyword,
  normalizeResearchSignal,
  titleSimilarity
} from "@/lib/research/normalize";
import { classifyRisk, recommendedActionForRisk } from "@/lib/research/risk";
import { scoreResearchCluster } from "@/lib/research/scoring";
import type {
  NormalizedResearchSignal,
  ResearchCluster,
  ResearchConfig,
  ResearchRiskLevel
} from "@/lib/research/types";

const RUN_LOCK_MINUTES = 15;

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function uniquePublisherCount(sources: NormalizedResearchSignal[]) {
  const publishers = sources.map((source) => {
    try {
      return new URL(source.canonicalUrl).hostname;
    } catch {
      return source.publisher || source.source;
    }
  });
  return new Set(publishers).size;
}

function strongestRisk(sources: NormalizedResearchSignal[]): ResearchRiskLevel {
  if (sources.some((source) => source.riskLevel === "blocked")) return "blocked";
  if (sources.some((source) => source.riskLevel === "high")) return "high";
  if (sources.some((source) => source.riskLevel === "medium")) return "medium";
  return "low";
}

function selectTopic(sources: NormalizedResearchSignal[]) {
  const googleTrend = sources.find((source) => source.source === "google_trends");
  const strongest = googleTrend || sources[0];
  return strongest.keyword || strongest.headline;
}

function buildCluster(sources: NormalizedResearchSignal[], config: ResearchConfig): ResearchCluster {
  const sorted = [...sources]
    .sort((a, b) => {
      const sourceWeight = Number(b.source === "google_trends") - Number(a.source === "google_trends");
      if (sourceWeight !== 0) return sourceWeight;
      return (b.publishedAtDate?.getTime() || 0) - (a.publishedAtDate?.getTime() || 0);
    })
    .slice(0, config.maxSourcesPerCandidate);
  const topic = selectTopic(sorted);
  const category = sorted[0]?.category || "US News";
  const normalizedTopic = normalizeKeyword(topic);
  const riskFromText = classifyRisk(`${topic} ${sorted.map((source) => source.summary).join(" ")}`);
  const riskLevel = riskFromText.riskLevel === "blocked" ? "blocked" : strongestRisk(sorted);
  const scores = scoreResearchCluster(sorted, riskLevel);
  const independentSources = uniquePublisherCount(sorted);
  const recommendedAction = recommendedActionForRisk({
    riskLevel,
    score: scores.trendScore,
    independentSources,
    minTrendScore: config.minTrendScore
  });
  return {
    clusterKey: clusterKeyFor(topic, category),
    topic,
    normalizedTopic,
    category,
    region: config.region,
    language: config.language,
    relatedQueries: unique(sorted.flatMap((source) => source.relatedQueries || [])).slice(0, 12),
    sources: sorted,
    riskLevel,
    factCheckRequired: riskFromText.factCheckRequired || riskLevel === "high" || riskLevel === "blocked",
    recommendedAction,
    scores
  };
}

async function semanticSimilarity(a: string, b: string) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result = await client.embeddings.create({
      model: process.env.RESEARCH_EMBEDDING_MODEL || "text-embedding-3-small",
      input: [a, b]
    });
    const left = result.data[0]?.embedding || [];
    const right = result.data[1]?.embedding || [];
    if (!left.length || left.length !== right.length) return null;
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index];
      leftNorm += left[index] * left[index];
      rightNorm += right[index] * right[index];
    }
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
  } catch (error) {
    logError("research_semantic_similarity_failed", error);
    return null;
  }
}

async function findExistingCandidate(cluster: ResearchCluster, semanticBudget: { remaining: number }) {
  const urls = cluster.sources.map((source) => source.canonicalUrl);
  const exact = await prisma.researchCandidate.findFirst({
    where: {
      OR: [
        { clusterKey: cluster.clusterKey },
        { normalizedTopic: cluster.normalizedTopic },
        { sources: { some: { canonicalUrl: { in: urls } } } }
      ]
    },
    include: { sources: true }
  });
  if (exact) return exact;

  const recent = await prisma.researchCandidate.findMany({
    take: 40,
    where: {
      category: cluster.category,
      lastSeenAt: { gte: new Date(Date.now() - 5 * 24 * 60 * 60_000) }
    },
    include: { sources: true },
    orderBy: { lastSeenAt: "desc" }
  });

  for (const candidate of recent) {
    const similarity = titleSimilarity(cluster.topic, candidate.topic);
    if (similarity >= 0.72) return candidate;
    if (similarity >= 0.48 && semanticBudget.remaining > 0) {
      semanticBudget.remaining -= 1;
      const semantic = await semanticSimilarity(cluster.topic, candidate.topic);
      if (semantic && semantic >= 0.86) return candidate;
    }
  }

  return null;
}

function mergeSignalsIntoClusters(signals: NormalizedResearchSignal[], config: ResearchConfig) {
  const clusters: NormalizedResearchSignal[][] = [];

  for (const signal of signals) {
    const existing = clusters.find((cluster) => {
      const topic = selectTopic(cluster);
      const sameTopic = normalizeKeyword(topic) === signal.normalizedKeyword;
      const sharedUrl = cluster.some((item) => item.canonicalUrl === signal.canonicalUrl);
      const similarTitle = titleSimilarity(topic, signal.keyword || signal.headline) >= 0.58;
      const sameExternalId = cluster.some(
        (item) => item.source === signal.source && item.externalId === signal.externalId
      );
      return sameTopic || sharedUrl || similarTitle || sameExternalId;
    });

    if (existing) {
      existing.push(signal);
    } else {
      clusters.push([signal]);
    }
  }

  return clusters
    .map((cluster) => buildCluster(cluster, config))
    .filter((cluster) => {
      if (cluster.recommendedAction === "blocked") return true;
      return cluster.scores.trendScore >= config.minTrendScore;
    })
    .sort((a, b) => b.scores.trendScore - a.scores.trendScore)
    .slice(0, config.maxCandidatesPerRun);
}

export const __researchTest = {
  mergeSignalsIntoClusters
};

async function persistCluster(cluster: ResearchCluster, semanticBudget: { remaining: number }) {
  const existing = await findExistingCandidate(cluster, semanticBudget);
  const now = new Date();
  const candidate = existing
    ? await prisma.researchCandidate.update({
        where: { id: existing.id },
        data: {
          topic: cluster.topic,
          normalizedTopic: cluster.normalizedTopic,
          category: cluster.category,
          region: cluster.region,
          language: cluster.language,
          trendScore: cluster.scores.trendScore,
          freshnessScore: cluster.scores.freshnessScore,
          opportunityScore: cluster.scores.opportunityScore,
          riskLevel: cluster.riskLevel,
          factCheckRequired: cluster.factCheckRequired,
          recommendedAction: cluster.recommendedAction,
          lastSeenAt: now
        }
      })
    : await prisma.researchCandidate.create({
        data: {
          clusterKey: cluster.clusterKey,
          topic: cluster.topic,
          normalizedTopic: cluster.normalizedTopic,
          category: cluster.category,
          region: cluster.region,
          language: cluster.language,
          trendScore: cluster.scores.trendScore,
          freshnessScore: cluster.scores.freshnessScore,
          opportunityScore: cluster.scores.opportunityScore,
          riskLevel: cluster.riskLevel,
          factCheckRequired: cluster.factCheckRequired,
          recommendedAction: cluster.recommendedAction,
          status: cluster.recommendedAction === "blocked" ? "blocked" : "new"
        }
      });

  for (const source of cluster.sources) {
    try {
      await prisma.researchSource.upsert({
        where: {
          candidateId_canonicalUrl: {
            candidateId: candidate.id,
            canonicalUrl: source.canonicalUrl
          }
        },
        update: {
          publisher: source.publisher,
          sourceUrl: source.sourceUrl,
          externalId: source.externalId,
          headline: source.headline,
          summary: source.summary,
          credibilityTier: source.credibilityTier,
          publishedAt: source.publishedAtDate,
          rawMetadata: json({
            ...source.rawMetadata,
            popularitySignals: source.popularitySignals,
            relatedQueries: source.relatedQueries
          })
        },
        create: {
          candidateId: candidate.id,
          source: source.source,
          publisher: source.publisher,
          sourceUrl: source.sourceUrl,
          canonicalUrl: source.canonicalUrl,
          externalId: source.externalId,
          headline: source.headline,
          summary: source.summary,
          credibilityTier: source.credibilityTier,
          publishedAt: source.publishedAtDate,
          rawMetadata: json({
            ...source.rawMetadata,
            popularitySignals: source.popularitySignals,
            relatedQueries: source.relatedQueries
          })
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  const brief = buildResearchBrief(cluster);
  await prisma.researchBrief.upsert({
    where: { candidateId: candidate.id },
    update: {
      whyTrending: brief.whyTrending,
      readerValue: brief.readerValue,
      verifiedFacts: json(brief.verifiedFacts),
      uncertainClaims: json(brief.uncertainClaims),
      timeline: json(brief.timeline),
      keyEntities: json(brief.keyEntities),
      relatedQueries: json(brief.relatedQueries),
      suggestedAngles: json(brief.suggestedAngles),
      suggestedKeywords: json(brief.suggestedKeywords),
      factCheckNotes: json(brief.factCheckNotes),
      intent: brief.intent,
      sourceUrls: json(brief.sourceUrls),
      sourceCredibility: json(brief.sourceCredibility),
      scoreBreakdown: json(cluster.scores),
      riskLevel: cluster.riskLevel,
      recommendedAction: cluster.recommendedAction,
      factCheckRequired: cluster.factCheckRequired,
      generatedAt: now,
      model: process.env.RESEARCH_BRIEF_MODEL || "deterministic-v1"
    },
    create: {
      candidateId: candidate.id,
      whyTrending: brief.whyTrending,
      readerValue: brief.readerValue,
      verifiedFacts: json(brief.verifiedFacts),
      uncertainClaims: json(brief.uncertainClaims),
      timeline: json(brief.timeline),
      keyEntities: json(brief.keyEntities),
      relatedQueries: json(brief.relatedQueries),
      suggestedAngles: json(brief.suggestedAngles),
      suggestedKeywords: json(brief.suggestedKeywords),
      factCheckNotes: json(brief.factCheckNotes),
      intent: brief.intent,
      sourceUrls: json(brief.sourceUrls),
      sourceCredibility: json(brief.sourceCredibility),
      scoreBreakdown: json(cluster.scores),
      riskLevel: cluster.riskLevel,
      recommendedAction: cluster.recommendedAction,
      factCheckRequired: cluster.factCheckRequired,
      model: process.env.RESEARCH_BRIEF_MODEL || "deterministic-v1"
    }
  });

  return { candidate, created: !existing };
}

export async function runResearchEngine() {
  const config = getResearchConfig();
  const activeRun = await prisma.researchRun.findFirst({
    where: {
      status: "running",
      startedAt: { gte: new Date(Date.now() - RUN_LOCK_MINUTES * 60_000) }
    },
    orderBy: { startedAt: "desc" }
  });
  if (activeRun) {
    return {
      ok: true,
      skipped: true,
      reason: "already_running",
      runId: activeRun.id,
      sourceStatuses: {}
    };
  }

  const run = await prisma.researchRun.create({
    data: {
      status: "running",
      sourceStatuses: json({})
    }
  });

  try {
    const adapterResults = await Promise.all(
      researchAdapters.map((adapter) =>
        adapter.isEnabled(config)
          ? adapter.fetch({ config })
          : Promise.resolve({
              source: adapter.name,
              items: [],
              status: {
                status: "disabled" as const,
                count: 0,
                message: `${adapter.name} is not configured.`,
                durationMs: 0
              }
            })
      )
    );
    const sourceStatuses = Object.fromEntries(
      adapterResults.map((adapterResult) => [adapterResult.source, adapterResult.status])
    );
    const signals = adapterResults
      .flatMap((adapterResult) => adapterResult.items)
      .map(normalizeResearchSignal)
      .filter((signal): signal is NormalizedResearchSignal => Boolean(signal));
    const clusters = mergeSignalsIntoClusters(signals, config);
    let created = 0;
    let merged = 0;
    const semanticBudget = { remaining: config.aiEnrichmentLimit };

    for (const cluster of clusters) {
      const result = await persistCluster(cluster, semanticBudget);
      if (result.created) created += 1;
      else merged += 1;
    }

    await prisma.researchRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: "completed",
        sourceStatuses: json(sourceStatuses),
        candidatesFound: clusters.length,
        candidatesCreated: created,
        candidatesMerged: merged
      }
    });

    logInfo("research_run_completed", {
      runId: run.id,
      candidatesFound: clusters.length,
      created,
      merged
    });

    return {
      ok: true,
      skipped: false,
      runId: run.id,
      candidatesFound: clusters.length,
      candidatesCreated: created,
      candidatesMerged: merged,
      sourceStatuses
    };
  } catch (error) {
    await prisma.researchRun.update({
      where: { id: run.id },
      data: {
        completedAt: new Date(),
        status: "failed",
        errorSummary: error instanceof Error ? error.message : String(error)
      }
    });
    logError("research_run_failed", error, { runId: run.id });
    throw error;
  }
}

export function getResearchEngineReadiness() {
  const config = getResearchConfig();
  return {
    config: {
      region: config.region,
      language: config.language,
      maxCandidatesPerRun: config.maxCandidatesPerRun,
      maxSourcesPerCandidate: config.maxSourcesPerCandidate,
      minTrendScore: config.minTrendScore,
      aiEnrichmentLimit: config.aiEnrichmentLimit,
      sourceTimeoutMs: config.sourceTimeoutMs
    },
    sources: researchSourceReadiness(config)
  };
}
