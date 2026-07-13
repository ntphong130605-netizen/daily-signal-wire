import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { logError, logInfo } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export const AI_FACT_CHECKER_PROMPT_VERSION = "ai-fact-checker-v1.0";

export const FactCheckStatusSchema = z.enum([
  "Verified",
  "Needs Review",
  "Low Confidence",
  "Rejected"
]);
export type FactCheckStatus = z.infer<typeof FactCheckStatusSchema>;

export type FactCheckSeverity = "low" | "medium" | "high";

export type FactCheckEvidenceItem = {
  claim: string;
  verdict: "supported" | "single-source" | "partial" | "unsupported" | "conflicting";
  sources: Array<{
    url: string;
    title?: string | null;
    publisher?: string | null;
    domain: string;
    trusted: boolean;
    credibilityTier?: string | null;
    publishedAt?: string | null;
  }>;
  notes: string[];
};

export type FactCheckWarning = {
  type:
    | "possible_hallucination"
    | "unsupported_claim"
    | "weak_evidence"
    | "duplicate_information"
    | "speculation"
    | "missing_attribution"
    | "outdated_information"
    | "clickbait_wording"
    | "source_disagreement";
  severity: FactCheckSeverity;
  message: string;
  paragraphIndex?: number;
  claim?: string;
};

export type RiskyParagraph = {
  index: number;
  paragraph: string;
  reason: string;
  severity: FactCheckSeverity;
  suggestedAction: string;
};

export type FactCheckResult = {
  status: FactCheckStatus;
  trustScore: number;
  evidenceScore: number;
  sourceDiversityScore: number;
  freshnessScore: number;
  confidenceLevel: "High" | "Medium" | "Low";
  summary: string;
  evidence: FactCheckEvidenceItem[];
  warnings: FactCheckWarning[];
  riskyParagraphs: RiskyParagraph[];
  metadata: {
    promptVersion: string;
    model: string;
    generatedAt: string;
    sourceCount: number;
    trustedSourceCount: number;
    domainCount: number;
    aiAssisted: boolean;
    method: string;
  };
};

type EvidenceSource = {
  url: string;
  title?: string | null;
  summary?: string | null;
  publisher?: string | null;
  domain: string;
  trusted: boolean;
  credibilityTier?: string | null;
  publishedAt?: string | null;
};

type ExtractedClaim = {
  text: string;
  paragraphIndex: number;
  risk: "low" | "medium" | "high";
  reason: string;
};

const AiClaimExtractionSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().min(20).max(320),
        paragraphIndex: z.number().int().min(0).max(80),
        risk: z.enum(["low", "medium", "high"]),
        reason: z.string().min(4).max(180)
      })
    )
    .max(14)
});

function clampScore(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedDomain(domain: string, url: string) {
  const clean = domain.toLowerCase();
  const trustedRoots = [
    "reuters.com",
    "apnews.com",
    "bbc.com",
    "bloomberg.com",
    "cnbc.com",
    "ft.com",
    "who.int",
    "nasa.gov"
  ];
  if (trustedRoots.some((root) => clean === root || clean.endsWith(`.${root}`))) return true;
  if (clean.endsWith(".gov")) return true;
  if (/\b(press|newsroom|media|investor|investors|ir)\b/i.test(url)) return true;
  return false;
}

function uniqueByUrl(sources: EvidenceSource[]) {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokenize(value: string) {
  const stop = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "from",
    "this",
    "have",
    "has",
    "was",
    "were",
    "are",
    "about",
    "into",
    "after",
    "before",
    "over",
    "under",
    "their",
    "its",
    "his",
    "her",
    "they",
    "them",
    "you",
    "your",
    "daily",
    "signal",
    "wire",
    "according",
    "available",
    "reports"
  ]);
  return value
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9$%.-]+/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2 && !stop.has(item));
}

function tokenOverlap(a: string, b: string) {
  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let matches = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) matches += 1;
  });
  return matches / Math.max(1, Math.min(aTokens.size, bTokens.size));
}

function paragraphsFrom(content: string) {
  return content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/^#{2,4}\s*/, "").trim())
    .filter((paragraph) => paragraph.length > 40);
}

function sentenceClaimsFromParagraph(paragraph: string, index: number): ExtractedClaim[] {
  const sentences = paragraph
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 50);

  return sentences
    .filter((sentence, sentenceIndex) => {
      const hasSpecifics =
        /\b\d{1,4}([,.]\d+)?(%| million| billion| trillion| years?| days?| weeks?| months?)?\b/i.test(
          sentence
        ) ||
        /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}\b/.test(sentence) ||
        /\b(announced|reported|confirmed|launched|warned|approved|rejected|said|filed|won|lost|died|resigned)\b/i.test(
          sentence
        );
      return hasSpecifics || (index === 0 && sentenceIndex < 2);
    })
    .slice(0, 2)
    .map((sentence) => ({
      text: sentence,
      paragraphIndex: index,
      risk: /\b\d|\"|“|”|\$|%\b/.test(sentence) ? "high" : "medium",
      reason: "Important factual claim detected in article copy."
    }));
}

async function extractClaimsWithAi({
  title,
  content,
  paragraphs,
  sources
}: {
  title: string;
  content: string;
  paragraphs: string[];
  sources: EvidenceSource[];
}): Promise<{ claims: ExtractedClaim[]; model: string; aiAssisted: boolean }> {
  if (!process.env.OPENAI_API_KEY) {
    return { claims: [], model: "heuristic", aiAssisted: false };
  }
  const model = process.env.AI_MODEL || "gpt-5.5";
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.responses.parse({
      model,
      instructions: `You are a newsroom fact-check triage assistant.
Extract only important factual claims that need verification before publication.
Use the article text and the supplied source packet only. Do not browse and do not add new facts.
Return JSON only. Keep claims verbatim or near-verbatim from the article.`,
      input: JSON.stringify({
        task: "Extract claims for fact-checking.",
        title,
        content: content.slice(0, 12000),
        numberedParagraphs: paragraphs.map((paragraph, index) => ({ index, paragraph })),
        sourcePacket: sources.map((source) => ({
          publisher: source.publisher,
          title: source.title,
          summary: source.summary,
          url: source.url,
          trusted: source.trusted,
          credibilityTier: source.credibilityTier,
          publishedAt: source.publishedAt
        }))
      }),
      text: { format: zodTextFormat(AiClaimExtractionSchema, "daily_signal_wire_fact_claims") }
    });
    return {
      claims: response.output_parsed?.claims || [],
      model,
      aiAssisted: true
    };
  } catch (error) {
    logError("ai_fact_claim_extraction_failed", error, { title });
    return { claims: [], model, aiAssisted: false };
  }
}

function findSupportingSources(claim: string, sources: EvidenceSource[]) {
  return sources
    .map((source) => ({
      source,
      score: tokenOverlap(claim, `${source.title || ""} ${source.summary || ""} ${source.publisher || ""}`)
    }))
    .filter((item) => item.score >= 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => item.source);
}

function hasConflictLanguage(values: string[]) {
  const combined = values.join(" ").toLowerCase();
  return /\b(disputed|contradicted|denied|denies|unclear|unverified|conflicting|contested|could not confirm)\b/.test(
    combined
  );
}

function makeWarnings({
  title,
  content,
  claims,
  evidence,
  sources,
  paragraphs
}: {
  title: string;
  content: string;
  claims: ExtractedClaim[];
  evidence: FactCheckEvidenceItem[];
  sources: EvidenceSource[];
  paragraphs: string[];
}): FactCheckWarning[] {
  const warnings: FactCheckWarning[] = [];
  const sourceDomains = new Set(sources.map((source) => source.domain).filter(Boolean));
  const trustedSources = sources.filter((source) => source.trusted);

  if (sources.length === 0) {
    warnings.push({
      type: "unsupported_claim",
      severity: "high",
      message: "No source URLs are attached to this article."
    });
  } else if (sources.length === 1) {
    warnings.push({
      type: "weak_evidence",
      severity: "high",
      message: "Only one source is attached; important claims need independent confirmation."
    });
  }

  if (trustedSources.length === 0 && sources.length > 0) {
    warnings.push({
      type: "weak_evidence",
      severity: "medium",
      message: "No preferred trusted source domain was found among the attached sources."
    });
  }

  if (sourceDomains.size < Math.min(2, sources.length)) {
    warnings.push({
      type: "weak_evidence",
      severity: "medium",
      message: "Source diversity is low; multiple URLs come from the same domain."
    });
  }

  const clickbaitPattern =
    /\b(shocking|you won't believe|secret|exposed|destroyed|slams|meltdown|jaw-dropping|unbelievable)\b/i;
  if (clickbaitPattern.test(title)) {
    warnings.push({
      type: "clickbait_wording",
      severity: "medium",
      message: "Headline contains wording that may feel clickbait or overstated."
    });
  }

  const speculationPattern =
    /\b(may|might|could|appears|seems|reportedly|rumor|speculation|unconfirmed)\b/i;
  if (speculationPattern.test(content)) {
    warnings.push({
      type: "speculation",
      severity: "medium",
      message: "The article includes uncertain language; ensure it is attributed and clearly framed."
    });
  }

  const attributionPattern =
    /\b(according to|reported by|the company said|officials said|data from|filings show|statement|press release|Reuters|AP|BBC|Bloomberg|CNBC|Financial Times|NASA|WHO)\b/i;
  if (sources.length > 0 && !attributionPattern.test(content)) {
    warnings.push({
      type: "missing_attribution",
      severity: "medium",
      message: "The story has sources but little visible attribution in the article body."
    });
  }

  const normalizedParagraphs = new Map<string, number>();
  paragraphs.forEach((paragraph, index) => {
    const key = paragraph.toLowerCase().replace(/\W+/g, " ").slice(0, 220);
    const firstSeen = normalizedParagraphs.get(key);
    if (firstSeen !== undefined) {
      warnings.push({
        type: "duplicate_information",
        severity: "low",
        message: "A paragraph appears to repeat earlier information.",
        paragraphIndex: index
      });
    } else {
      normalizedParagraphs.set(key, index);
    }
  });

  const unsupportedClaims = evidence.filter((item) => item.verdict === "unsupported");
  unsupportedClaims.forEach((item) => {
    const original = claims.find((claim) => claim.text === item.claim);
    warnings.push({
      type: "unsupported_claim",
      severity: original?.risk === "high" ? "high" : "medium",
      message: "A key claim could not be matched to the saved source packet.",
      paragraphIndex: original?.paragraphIndex,
      claim: item.claim
    });
  });

  evidence
    .filter((item) => item.verdict === "single-source")
    .forEach((item) => {
      const original = claims.find((claim) => claim.text === item.claim);
      warnings.push({
        type: "weak_evidence",
        severity: "medium",
        message: "This important claim is supported by only one attached source.",
        paragraphIndex: original?.paragraphIndex,
        claim: item.claim
      });
    });

  if (
    hasConflictLanguage([
      ...sources.map((source) => `${source.title || ""} ${source.summary || ""}`),
      ...evidence.flatMap((item) => item.notes)
    ])
  ) {
    warnings.push({
      type: "source_disagreement",
      severity: "high",
      message: "At least one source or fact note signals disagreement, denial, uncertainty or conflict."
    });
  }

  return warnings;
}

function riskyParagraphsFromWarnings(
  warnings: FactCheckWarning[],
  paragraphs: string[]
): RiskyParagraph[] {
  const byParagraph = new Map<number, FactCheckWarning[]>();
  warnings.forEach((warning) => {
    if (warning.paragraphIndex === undefined) return;
    const list = byParagraph.get(warning.paragraphIndex) || [];
    list.push(warning);
    byParagraph.set(warning.paragraphIndex, list);
  });

  return [...byParagraph.entries()]
    .sort(([a], [b]) => a - b)
    .slice(0, 10)
    .map(([index, paragraphWarnings]) => {
      const severity: FactCheckSeverity = paragraphWarnings.some((warning) => warning.severity === "high")
        ? "high"
        : paragraphWarnings.some((warning) => warning.severity === "medium")
          ? "medium"
          : "low";
      return {
        index,
        paragraph: paragraphs[index] || "",
        reason: paragraphWarnings.map((warning) => warning.message).join(" "),
        severity,
        suggestedAction:
          severity === "high"
            ? "Regenerate or rewrite this paragraph with stricter attribution."
            : "Review the attached source and add attribution if needed."
      };
    });
}

function freshnessScoreFromSources(sources: EvidenceSource[], postUpdatedAt: Date) {
  const dates = sources
    .map((source) => (source.publishedAt ? new Date(source.publishedAt).getTime() : NaN))
    .filter((time) => Number.isFinite(time));
  const newest = dates.length ? Math.max(...dates) : postUpdatedAt.getTime();
  const ageDays = Math.max(0, (Date.now() - newest) / 86_400_000);
  if (ageDays <= 3) return 100;
  if (ageDays <= 14) return 86;
  if (ageDays <= 30) return 72;
  if (ageDays <= 180) return 55;
  return 35;
}

function statusFromScores(score: number, warnings: FactCheckWarning[]): FactCheckStatus {
  const highWarnings = warnings.filter((warning) => warning.severity === "high").length;
  if (score >= 82 && highWarnings === 0) return "Verified";
  if (score < 45 || highWarnings >= 3) return "Rejected";
  if (score < 62 || highWarnings > 0) return "Low Confidence";
  return "Needs Review";
}

function confidenceFromScore(score: number): "High" | "Medium" | "Low" {
  if (score >= 82) return "High";
  if (score >= 62) return "Medium";
  return "Low";
}

async function collectSources(post: {
  sourceUrls: string;
  factCheckNotes: string;
  trend?: { sourceContext?: string | null } | null;
  researchCandidateId?: string | null;
}) {
  const sources: EvidenceSource[] = [];
  parseStringArray(post.sourceUrls).forEach((url) => {
    const domain = domainFromUrl(url);
    sources.push({
      url,
      domain,
      trusted: isTrustedDomain(domain, url)
    });
  });

  parseJsonArray<{
    title?: string;
    snippet?: string;
    source?: string;
    url?: string;
    publishedAt?: string;
  }>(post.trend?.sourceContext).forEach((source) => {
    if (!source.url) return;
    const domain = domainFromUrl(source.url);
    sources.push({
      url: source.url,
      title: source.title,
      summary: source.snippet,
      publisher: source.source,
      domain,
      trusted: isTrustedDomain(domain, source.url),
      publishedAt: source.publishedAt
    });
  });

  if (post.researchCandidateId) {
    const candidate = await prisma.researchCandidate.findUnique({
      where: { id: post.researchCandidateId },
      include: { brief: true, sources: true }
    });
    candidate?.sources.forEach((source) => {
      const url = source.canonicalUrl || source.sourceUrl;
      const domain = domainFromUrl(url);
      sources.push({
        url,
        title: source.headline,
        summary: source.summary,
        publisher: source.publisher || source.source,
        domain,
        trusted: isTrustedDomain(domain, url) || ["A", "B"].includes(source.credibilityTier),
        credibilityTier: source.credibilityTier,
        publishedAt: source.publishedAt?.toISOString() || null
      });
    });
    parseStringArray(candidate?.brief?.sourceUrls).forEach((url) => {
      const domain = domainFromUrl(url);
      sources.push({
        url,
        domain,
        trusted: isTrustedDomain(domain, url)
      });
    });
  }

  return uniqueByUrl(sources);
}

async function buildFactCheckResult(post: {
  id: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  content: string;
  factCheckNotes: string;
  sourceUrls: string;
  updatedAt: Date;
  researchCandidateId?: string | null;
  trend?: { sourceContext?: string | null } | null;
}): Promise<FactCheckResult> {
  const sources = await collectSources(post);
  const paragraphs = paragraphsFrom(post.content);
  const heuristicClaims = paragraphs.flatMap((paragraph, index) =>
    sentenceClaimsFromParagraph(paragraph, index)
  );
  const aiExtraction = await extractClaimsWithAi({
    title: post.title,
    content: post.content,
    paragraphs,
    sources
  });
  const claims = (aiExtraction.claims.length ? aiExtraction.claims : heuristicClaims).slice(0, 14);
  const factNotes = parseStringArray(post.factCheckNotes);

  const evidence = claims.map<FactCheckEvidenceItem>((claim) => {
    const supportingSources = findSupportingSources(claim.text, sources);
    const supportingNotes = factNotes
      .filter((note) => tokenOverlap(claim.text, note) >= 0.16)
      .slice(0, 3);
    const hasConflict = hasConflictLanguage([
      claim.text,
      ...supportingNotes,
      ...supportingSources.map((source) => `${source.title || ""} ${source.summary || ""}`)
    ]);
    const verdict: FactCheckEvidenceItem["verdict"] = hasConflict
      ? "conflicting"
      : supportingSources.length >= 2
        ? "supported"
        : supportingSources.length === 1
          ? "single-source"
          : supportingNotes.length > 0
            ? "partial"
            : "unsupported";

    return {
      claim: claim.text,
      verdict,
      sources: supportingSources.map((source) => ({
        url: source.url,
        title: source.title,
        publisher: source.publisher,
        domain: source.domain,
        trusted: source.trusted,
        credibilityTier: source.credibilityTier,
        publishedAt: source.publishedAt
      })),
      notes: supportingNotes.length ? supportingNotes : [claim.reason]
    };
  });

  const warnings = makeWarnings({
    title: post.title,
    content: post.content,
    claims,
    evidence,
    sources,
    paragraphs
  });
  const riskyParagraphs = riskyParagraphsFromWarnings(warnings, paragraphs);
  const trustedSourceCount = sources.filter((source) => source.trusted).length;
  const domainCount = new Set(sources.map((source) => source.domain).filter(Boolean)).size;
  const supportedEvidence = evidence.filter((item) => item.verdict === "supported").length;
  const partialEvidence = evidence.filter((item) => item.verdict === "partial").length;
  const singleSourceEvidence = evidence.filter((item) => item.verdict === "single-source").length;
  const unsupportedEvidence = evidence.filter((item) => item.verdict === "unsupported").length;

  const evidenceScore = clampScore(
    (supportedEvidence / Math.max(1, evidence.length)) * 100 +
      singleSourceEvidence * 3 +
      partialEvidence * 2 -
      unsupportedEvidence * 12 +
      Math.min(20, trustedSourceCount * 4)
  );
  const sourceDiversityScore = clampScore(
    Math.min(100, domainCount * 24 + trustedSourceCount * 9 + sources.length * 3)
  );
  const freshnessScore = freshnessScoreFromSources(sources, post.updatedAt);
  const severityPenalty = warnings.reduce((total, warning) => {
    if (warning.severity === "high") return total + 14;
    if (warning.severity === "medium") return total + 7;
    return total + 2;
  }, 0);
  const trustScore = clampScore(
    evidenceScore * 0.42 + sourceDiversityScore * 0.24 + freshnessScore * 0.18 + 22 - severityPenalty
  );
  const status = statusFromScores(trustScore, warnings);
  const confidenceLevel = confidenceFromScore(trustScore);
  const summary =
    status === "Verified"
      ? "The draft has strong support from the saved source packet and is ready for final human review."
      : status === "Needs Review"
        ? "The draft has usable sourcing but needs an editor to review warnings before publication."
        : status === "Low Confidence"
          ? "The draft contains weak or uncertain evidence and should be rewritten or re-sourced before publication."
          : "The draft should not be published until unsupported or conflicting claims are resolved.";

  return {
    status,
    trustScore,
    evidenceScore,
    sourceDiversityScore,
    freshnessScore,
    confidenceLevel,
    summary,
    evidence,
    warnings,
    riskyParagraphs,
    metadata: {
      promptVersion: AI_FACT_CHECKER_PROMPT_VERSION,
      model: aiExtraction.model,
      generatedAt: new Date().toISOString(),
      sourceCount: sources.length,
      trustedSourceCount,
      domainCount,
      aiAssisted: aiExtraction.aiAssisted,
      method: aiExtraction.aiAssisted ? "ai_claim_extraction_plus_source_packet_scoring" : "heuristic_source_packet_scoring"
    }
  };
}

export async function runFactCheckForPost(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { trend: { select: { sourceContext: true } } }
  });
  const result = await buildFactCheckResult(post);
  const now = new Date();

  await prisma.$transaction([
    prisma.factCheckReport.create({
      data: {
        postId,
        status: result.status,
        trustScore: result.trustScore,
        evidenceScore: result.evidenceScore,
        sourceDiversityScore: result.sourceDiversityScore,
        freshnessScore: result.freshnessScore,
        confidenceLevel: result.confidenceLevel,
        summary: result.summary,
        evidence: json(result.evidence),
        warnings: json(result.warnings),
        riskyParagraphs: json(result.riskyParagraphs),
        metadata: json(result.metadata),
        model: result.metadata.model,
        promptVersion: result.metadata.promptVersion
      }
    }),
    prisma.post.update({
      where: { id: postId },
      data: {
        factCheckStatus: result.status,
        trustScore: result.trustScore,
        evidenceScore: result.evidenceScore,
        sourceDiversityScore: result.sourceDiversityScore,
        freshnessScore: result.freshnessScore,
        confidenceLevel: result.confidenceLevel,
        factCheckSummary: result.summary,
        factCheckEvidence: json(result.evidence),
        factCheckWarnings: json(result.warnings),
        riskyParagraphs: json(result.riskyParagraphs),
        verificationMetadata: json(result.metadata),
        verifiedAt: now
      }
    })
  ]);

  logInfo("ai_fact_check_completed", {
    postId,
    status: result.status,
    trustScore: result.trustScore,
    warnings: result.warnings.length
  });
  return result;
}

export async function setFactCheckDecision({
  postId,
  action
}: {
  postId: string;
  action: "approve" | "reject" | "needs_review" | "low_confidence";
}) {
  const data =
    action === "approve"
      ? { factCheckStatus: "Verified", verifiedAt: new Date() }
      : action === "reject"
        ? { factCheckStatus: "Rejected", verifiedAt: new Date() }
        : action === "low_confidence"
          ? { factCheckStatus: "Low Confidence", verifiedAt: new Date() }
          : { factCheckStatus: "Needs Review", verifiedAt: new Date() };

  const post = await prisma.post.update({
    where: { id: postId },
    data
  });
  logInfo("ai_fact_check_decision_recorded", { postId, action, status: post.factCheckStatus });
  return post;
}

