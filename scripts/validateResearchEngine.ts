import assert from "node:assert/strict";
import { redditAdapter, youtubeAdapter } from "@/lib/research/adapters";
import { getResearchConfig } from "@/lib/research/config";
import { isResearchCronAuthorized } from "@/lib/research/cronAuth";
import { __researchTest } from "@/lib/research/engine";
import {
  canonicalizeUrl,
  classifyCategory,
  normalizeResearchSignal,
  titleSimilarity
} from "@/lib/research/normalize";
import { classifyRisk } from "@/lib/research/risk";

const canonical = canonicalizeUrl(
  "https://www.example.com/news/story/?utm_source=x&b=2&a=1#comments"
);
assert.equal(canonical, "https://example.com/news/story?a=1&b=2");

assert.equal(classifyCategory("Apple unveils a new AI chip for iPhone"), "Technology");
assert.ok(titleSimilarity("Apple unveils AI chip", "Apple AI chip unveiled today") > 0.45);

const low = classifyRisk("A new restaurant opens in Austin");
assert.equal(low.riskLevel, "low");
assert.equal(low.factCheckRequired, false);

const high = classifyRisk("Election lawsuit after a shooting investigation");
assert.equal(high.riskLevel, "high");
assert.equal(high.factCheckRequired, true);

const blocked = classifyRisk("How to make a bomb recipe");
assert.equal(blocked.riskLevel, "blocked");

const signalA = normalizeResearchSignal({
  source: "google_news_rss",
  externalId: "a",
  keyword: "Apple launches new AI feature",
  headline: "Apple launches new AI feature",
  summary: "A technology update from Apple.",
  sourceUrl: "https://reuters.com/technology/apple-ai?utm_medium=social",
  publisher: "Reuters",
  categoryHint: "Technology",
  region: "US",
  language: "en-US",
  publishedAt: new Date().toISOString(),
  popularitySignals: { sourceRank: 1 },
  relatedQueries: ["Apple AI"],
  rawMetadata: {}
});

const signalB = normalizeResearchSignal({
  source: "rss_feed",
  externalId: "b",
  keyword: "Apple AI feature launch",
  headline: "Apple AI feature launch",
  summary: "Another feed describes the same technology topic.",
  sourceUrl: "https://apnews.com/article/apple-ai?fbclid=1",
  publisher: "AP",
  categoryHint: "Technology",
  region: "US",
  language: "en-US",
  publishedAt: new Date().toISOString(),
  popularitySignals: { sourceRank: 2 },
  relatedQueries: [],
  rawMetadata: {}
});

assert.ok(signalA);
assert.ok(signalB);
assert.equal(signalA?.credibilityTier, "B");
assert.equal(signalA?.category, "Technology");

const config = {
  ...getResearchConfig(),
  minTrendScore: 0,
  maxCandidatesPerRun: 10,
  maxSourcesPerCandidate: 8,
  redditClientId: undefined,
  redditClientSecret: undefined,
  youtubeApiKey: undefined
};

const clusters = __researchTest.mergeSignalsIntoClusters([signalA!, signalB!], config);
assert.equal(clusters.length, 1);
assert.equal(clusters[0]?.sources.length, 2);
assert.ok(clusters[0]?.scores.trendScore);

const trendSignals = [
  ["https://nytimes.com/sports/open-golf", "The New York Times"],
  ["https://sports.yahoo.com/open-golf", "Yahoo Sports"],
  ["https://cbssports.com/golf/open", "CBS Sports"]
].map(([sourceUrl, publisher], index) =>
  normalizeResearchSignal({
    source: "google_trends",
    externalId: `open-golf-${index}`,
    keyword: "the open tee times",
    headline: "The Open golf tee times and tournament schedule",
    summary: "Coverage of the current professional golf tournament schedule.",
    sourceUrl,
    publisher,
    categoryHint: "Sports",
    region: "US",
    language: "en-US",
    publishedAt: new Date().toISOString(),
    popularitySignals: { approxTraffic: "1,000+", newsItemCount: 3 },
    relatedQueries: [],
    rawMetadata: {}
  })
);
assert.ok(trendSignals.every(Boolean));
const trendClusters = __researchTest.mergeSignalsIntoClusters(
  trendSignals.filter((signal): signal is NonNullable<typeof signal> => Boolean(signal)),
  { ...config, minTrendScore: 65 }
);
assert.equal(trendClusters[0]?.category, "Sports");
assert.ok((trendClusters[0]?.scores.trendScore || 0) >= 75);
assert.equal(trendClusters[0]?.recommendedAction, "generate_draft");

assert.equal(redditAdapter.isEnabled(config), false);
assert.equal(youtubeAdapter.isEnabled(config), false);

const unauthorized = new Request("http://localhost/api/cron/research");
assert.equal(isResearchCronAuthorized(unauthorized, "secret"), false);
const authorized = new Request("http://localhost/api/cron/research", {
  headers: { authorization: "Bearer secret" }
});
assert.equal(isResearchCronAuthorized(authorized, "secret"), true);

console.log("Research engine validation passed.");
