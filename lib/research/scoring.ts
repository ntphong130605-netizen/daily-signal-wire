import { RESEARCH_SCORE_WEIGHTS } from "@/lib/research/config";
import { credibilityScore } from "@/lib/research/credibility";
import type {
  NormalizedResearchSignal,
  ResearchRiskLevel,
  ResearchScoreBreakdown
} from "@/lib/research/types";

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function publisherKey(source: NormalizedResearchSignal) {
  try {
    return new URL(source.canonicalUrl).hostname;
  } catch {
    return source.publisher || source.source;
  }
}

function parseApproxTraffic(value: unknown) {
  const raw = String(value || "").toLowerCase().replace(/,/g, "");
  const number = Number.parseFloat(raw);
  if (!Number.isFinite(number)) return 0;
  if (raw.includes("m")) return number * 1_000_000;
  if (raw.includes("k")) return number * 1_000;
  return number;
}

function popularitySignalScore(sources: NormalizedResearchSignal[]) {
  let score = 0;
  for (const source of sources) {
    const signals = source.popularitySignals || {};
    score = Math.max(score, Math.min(100, parseApproxTraffic(signals.approxTraffic) / 2_000));
    score = Math.max(score, Math.min(100, Number(signals.redditScore || 0) / 300));
    score = Math.max(score, Math.min(100, Number(signals.youtubeViews || 0) / 20_000));
    score = Math.max(score, Math.min(100, Number(signals.internalCount || 0) * 15));
  }
  return clamp(score || Math.min(100, sources.length * 16));
}

function freshnessScore(sources: NormalizedResearchSignal[]) {
  const newest = sources
    .map((source) => source.publishedAtDate?.getTime() || 0)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  if (!newest) return 42;
  const hours = (Date.now() - newest) / 3_600_000;
  if (hours <= 2) return 100;
  if (hours <= 6) return 92;
  if (hours <= 12) return 82;
  if (hours <= 24) return 68;
  if (hours <= 72) return 45;
  return 24;
}

function riskPenalty(riskLevel: ResearchRiskLevel) {
  if (riskLevel === "blocked") return 100;
  if (riskLevel === "high") return 35;
  if (riskLevel === "medium") return 14;
  return 0;
}

export function scoreResearchCluster(
  sources: NormalizedResearchSignal[],
  riskLevel: ResearchRiskLevel
): ResearchScoreBreakdown {
  const uniquePublishers = new Set(sources.map(publisherKey)).size;
  const sourceDiversity = clamp(uniquePublishers * 26);
  const credibility = clamp(
    sources.reduce((sum, source) => sum + credibilityScore(source.credibilityTier), 0) /
      Math.max(1, sources.length)
  );
  const freshness = freshnessScore(sources);
  const popularity = popularitySignalScore(sources);
  const newsworthiness = clamp(
    35 +
      Math.min(30, uniquePublishers * 7) +
      (sources.some((source) => source.source === "google_trends") ? 18 : 0) +
      (sources.some((source) => source.credibilityTier === "A") ? 10 : 0)
  );
  const penalty = riskPenalty(riskLevel);
  const weighted =
    sourceDiversity * RESEARCH_SCORE_WEIGHTS.sourceDiversity +
    credibility * RESEARCH_SCORE_WEIGHTS.credibility +
    freshness * RESEARCH_SCORE_WEIGHTS.freshness +
    popularity * RESEARCH_SCORE_WEIGHTS.popularity +
    newsworthiness * RESEARCH_SCORE_WEIGHTS.newsworthiness -
    penalty * RESEARCH_SCORE_WEIGHTS.riskPenalty;

  const trendScore = clamp(weighted);
  return {
    sourceDiversity,
    credibility,
    freshness,
    popularity,
    newsworthiness,
    riskPenalty: penalty,
    trendScore,
    freshnessScore: freshness,
    opportunityScore: clamp((trendScore + newsworthiness + sourceDiversity) / 3)
  };
}
