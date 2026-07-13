import { extractEntitiesFromText } from "@/lib/research/normalize";
import type { ResearchBriefDraft, ResearchCluster } from "@/lib/research/types";

function unique(values: string[], limit = 10) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).slice(0, limit);
}

export function buildResearchBrief(cluster: ResearchCluster): ResearchBriefDraft {
  const sourceNames = unique(cluster.sources.map((source) => source.publisher || source.source), 6);
  const topHeadlines = unique(cluster.sources.map((source) => source.headline), 5);
  const relatedQueries = unique(
    [...cluster.relatedQueries, ...cluster.sources.flatMap((source) => source.relatedQueries || [])],
    10
  );
  const textCorpus = `${cluster.topic}. ${topHeadlines.join(". ")} ${cluster.sources
    .map((source) => source.summary)
    .join(". ")}`;
  const entities = extractEntitiesFromText(textCorpus);
  const factCheckNotes = [
    cluster.factCheckRequired
      ? "Fact-check required before any draft is generated because this topic is risk-sensitive."
      : "Verify source details before assigning this topic to the writing pipeline.",
    cluster.riskLevel === "high"
      ? "High-risk topic: require at least two independent credible sources and avoid unsupported claims."
      : "",
    cluster.riskLevel === "blocked"
      ? "Blocked topic: do not send to article generation."
      : ""
  ].filter(Boolean);

  return {
    whyTrending: `${cluster.topic} is appearing across ${cluster.sources.length} source signal${
      cluster.sources.length === 1 ? "" : "s"
    }${sourceNames.length ? ` including ${sourceNames.join(", ")}` : ""}.`,
    readerValue:
      "A concise, source-first briefing can help readers understand what is known, what remains uncertain, and why the topic is moving now.",
    verifiedFacts: topHeadlines.map((headline) => `Reported signal: ${headline}`),
    uncertainClaims:
      cluster.riskLevel === "low"
        ? []
        : [
            "Specific numbers, quotes, blame, and causal claims must be checked against original reporting or official sources."
          ],
    timeline: unique(
      cluster.sources
        .filter((source) => source.publishedAtDate)
        .map(
          (source) =>
            `${source.publishedAtDate?.toISOString()} — ${source.publisher || source.source}: ${
              source.headline
            }`
        ),
      8
    ),
    keyEntities: entities,
    relatedQueries,
    suggestedAngles: [
      `What readers should know about ${cluster.topic}`,
      `Why ${cluster.topic} is gaining attention now`,
      `What could happen next around ${cluster.topic}`
    ],
    suggestedKeywords: unique([
      cluster.topic,
      cluster.normalizedTopic,
      cluster.category,
      ...relatedQueries,
      ...entities
    ], 14),
    factCheckNotes,
    intent:
      cluster.recommendedAction === "generate_draft"
        ? "Ready for editor-reviewed draft generation."
        : cluster.recommendedAction === "blocked"
          ? "Blocked from editorial automation."
          : "Monitor and gather stronger source confirmation before draft generation.",
    sourceUrls: unique(cluster.sources.map((source) => source.canonicalUrl || source.sourceUrl), 12),
    sourceCredibility: cluster.sources.slice(0, 12).map((source) => ({
      publisher: source.publisher || source.source,
      url: source.canonicalUrl || source.sourceUrl,
      tier: source.credibilityTier
    }))
  };
}
