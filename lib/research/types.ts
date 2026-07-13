export const RESEARCH_CATEGORIES = [
  "US News",
  "World",
  "Politics",
  "Business",
  "Technology",
  "Science",
  "Health",
  "Sports",
  "Entertainment",
  "Lifestyle",
  "Travel",
  "Climate"
] as const;

export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number];

export type ResearchSourceName =
  | "google_trends"
  | "google_news_rss"
  | "rss_feed"
  | "reddit"
  | "youtube"
  | "internal_analytics";

export type SourceCredibilityTier = "A" | "B" | "C";
export type ResearchRiskLevel = "low" | "medium" | "high" | "blocked";
export type ResearchAction = "generate_draft" | "monitor" | "ignore" | "blocked";

export type ResearchSourceAdapterOutput = {
  source: ResearchSourceName;
  externalId: string;
  keyword: string;
  headline: string;
  summary: string;
  sourceUrl: string;
  publisher: string;
  categoryHint?: string;
  region: string;
  language: string;
  publishedAt?: string | Date | null;
  popularitySignals: Record<string, number | string | boolean | null | undefined>;
  relatedQueries: string[];
  rawMetadata: Record<string, unknown>;
};

export type NormalizedResearchSignal = ResearchSourceAdapterOutput & {
  canonicalUrl: string;
  normalizedKeyword: string;
  category: ResearchCategory;
  credibilityTier: SourceCredibilityTier;
  riskLevel: ResearchRiskLevel;
  publishedAtDate: Date | null;
};

export type ResearchAdapterStatus = {
  status: "completed" | "disabled" | "failed";
  count: number;
  message?: string;
  durationMs?: number;
};

export type ResearchAdapterResult = {
  source: ResearchSourceName;
  status: ResearchAdapterStatus;
  items: ResearchSourceAdapterOutput[];
};

export type ResearchAdapterContext = {
  config: ResearchConfig;
};

export type ResearchSourceAdapter = {
  name: ResearchSourceName;
  isEnabled: (config: ResearchConfig) => boolean;
  fetch: (context: ResearchAdapterContext) => Promise<ResearchAdapterResult>;
};

export type ResearchScoreBreakdown = {
  sourceDiversity: number;
  credibility: number;
  freshness: number;
  popularity: number;
  newsworthiness: number;
  riskPenalty: number;
  trendScore: number;
  freshnessScore: number;
  opportunityScore: number;
};

export type ResearchCluster = {
  clusterKey: string;
  topic: string;
  normalizedTopic: string;
  category: ResearchCategory;
  region: string;
  language: string;
  relatedQueries: string[];
  sources: NormalizedResearchSignal[];
  riskLevel: ResearchRiskLevel;
  factCheckRequired: boolean;
  recommendedAction: ResearchAction;
  scores: ResearchScoreBreakdown;
};

export type ResearchBriefDraft = {
  whyTrending: string;
  readerValue: string;
  verifiedFacts: string[];
  uncertainClaims: string[];
  timeline: string[];
  keyEntities: string[];
  relatedQueries: string[];
  suggestedAngles: string[];
  suggestedKeywords: string[];
  factCheckNotes: string[];
  intent: string;
  sourceUrls: string[];
  sourceCredibility: Array<{
    publisher: string;
    url: string;
    tier: SourceCredibilityTier;
  }>;
};

export type ResearchConfig = {
  region: string;
  language: string;
  maxCandidatesPerRun: number;
  maxSourcesPerCandidate: number;
  minTrendScore: number;
  aiEnrichmentLimit: number;
  sourceTimeoutMs: number;
  redditClientId?: string;
  redditClientSecret?: string;
  youtubeApiKey?: string;
};
