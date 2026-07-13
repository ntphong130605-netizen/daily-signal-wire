import type { ResearchConfig } from "@/lib/research/types";

export const RESEARCH_SCORE_WEIGHTS = {
  sourceDiversity: 0.22,
  credibility: 0.2,
  freshness: 0.18,
  popularity: 0.18,
  newsworthiness: 0.17,
  riskPenalty: 0.05
} as const;

function intEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number.parseInt(process.env[name] || "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function getResearchConfig(): ResearchConfig {
  return {
    region: process.env.RESEARCH_REGION || "US",
    language: process.env.RESEARCH_LANGUAGE || "en-US",
    maxCandidatesPerRun: intEnv("RESEARCH_MAX_CANDIDATES_PER_RUN", 25, 1, 100),
    maxSourcesPerCandidate: intEnv("RESEARCH_MAX_SOURCES_PER_CANDIDATE", 8, 2, 20),
    minTrendScore: intEnv("RESEARCH_MIN_TREND_SCORE", 55, 0, 100),
    aiEnrichmentLimit: intEnv("RESEARCH_AI_ENRICHMENT_LIMIT", 10, 0, 50),
    sourceTimeoutMs: intEnv("RESEARCH_SOURCE_TIMEOUT_MS", 10_000, 2_000, 30_000),
    redditClientId: process.env.REDDIT_CLIENT_ID,
    redditClientSecret: process.env.REDDIT_CLIENT_SECRET,
    youtubeApiKey: process.env.YOUTUBE_API_KEY
  };
}
