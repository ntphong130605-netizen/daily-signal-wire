import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { slugify } from "@/lib/slug";
import { asArray, cleanResearchText, classifyCategory } from "@/lib/research/normalize";
import type {
  ResearchAdapterContext,
  ResearchAdapterResult,
  ResearchConfig,
  ResearchSourceAdapter,
  ResearchSourceAdapterOutput,
  ResearchSourceName
} from "@/lib/research/types";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  processEntities: false
});

async function fetchText(url: string, config: ResearchConfig) {
  const response = await fetch(url, {
    headers: { "User-Agent": "DailySignalWire/1.0 research-engine" },
    signal: AbortSignal.timeout(config.sourceTimeoutMs),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Request failed with ${response.status}`);
  return response.text();
}

function result(
  source: ResearchSourceName,
  status: ResearchAdapterResult["status"]["status"],
  items: ResearchSourceAdapterOutput[],
  startedAt: number,
  message?: string
): ResearchAdapterResult {
  return {
    source,
    items,
    status: {
      status,
      count: items.length,
      message,
      durationMs: Date.now() - startedAt
    }
  };
}

async function safeAdapter(
  source: ResearchSourceName,
  work: () => Promise<ResearchSourceAdapterOutput[]>,
  startedAt: number
) {
  try {
    return result(source, "completed", await work(), startedAt);
  } catch (error) {
    logError("research_source_failed", error, { source });
    return result(
      source,
      "failed",
      [],
      startedAt,
      error instanceof Error ? error.message : "Source failed"
    );
  }
}

function rssItemPublisher(item: Record<string, unknown>) {
  const source = item.source;
  if (typeof source === "object" && source) {
    return cleanResearchText((source as Record<string, unknown>)["#text"], 120);
  }
  return cleanResearchText(source, 120);
}

export const googleTrendsAdapter: ResearchSourceAdapter = {
  name: "google_trends",
  isEnabled: () => true,
  fetch: async ({ config }: ResearchAdapterContext) => {
    const startedAt = Date.now();
    return safeAdapter(
      "google_trends",
      async () => {
        const xml = await fetchText("https://trends.google.com/trending/rss?geo=US", config);
        const data = parser.parse(xml);
        const items = asArray(data?.rss?.channel?.item).slice(0, 30) as Record<string, unknown>[];
        return items
          .flatMap((item) => {
            const keyword = cleanResearchText(item.title, 140);
            const newsItems = asArray(item["ht:news_item"] as Record<string, unknown>[]);
            const relatedQueries = newsItems
              .map((news) => cleanResearchText(news["ht:news_item_title"], 140))
              .filter(Boolean);
            const approxTraffic = cleanResearchText(item["ht:approx_traffic"], 60);
            const publishedAt = cleanResearchText(item.pubDate, 80) || new Date().toISOString();
            const trendUrl =
              cleanResearchText(item.link, 400) ||
              `https://trends.google.com/trends/explore?geo=US&q=${encodeURIComponent(keyword)}`;
            const realNewsItems = newsItems
              .map((news, index) => {
                const sourceUrl = cleanResearchText(news["ht:news_item_url"], 500);
                if (!sourceUrl) return null;
                const headline = cleanResearchText(news["ht:news_item_title"], 220) || keyword;
                const publisher =
                  cleanResearchText(news["ht:news_item_source"], 120) || "Google Trends source";
                return {
                  source: "google_trends" as const,
                  externalId: `google-trends:${slugify(keyword)}:${index + 1}`,
                  keyword,
                  headline,
                  summary:
                    cleanResearchText(news["ht:news_item_snippet"], 500) ||
                    `Google Trends reports rising search interest for ${keyword}.`,
                  sourceUrl,
                  publisher,
                  categoryHint: classifyCategory(`${keyword} ${headline}`),
                  region: config.region,
                  language: config.language,
                  publishedAt,
                  popularitySignals: { approxTraffic, newsItemCount: newsItems.length },
                  relatedQueries,
                  rawMetadata: {
                    approxTraffic,
                    newsItemCount: newsItems.length,
                    trendUrl,
                    trendKeyword: keyword
                  }
                };
              })
              .filter((value): value is NonNullable<typeof value> => Boolean(value));

            if (realNewsItems.length) return realNewsItems;
            return [
              {
                source: "google_trends" as const,
                externalId: `google-trends:${slugify(keyword)}:trend`,
                keyword,
                headline: keyword,
                summary: `Google Trends reports rising search interest for ${keyword}.`,
                sourceUrl: trendUrl,
                publisher: "Google Trends",
                categoryHint: classifyCategory(keyword),
                region: config.region,
                language: config.language,
                publishedAt,
                popularitySignals: { approxTraffic, newsItemCount: 0 },
                relatedQueries,
                rawMetadata: { approxTraffic, newsItemCount: 0, trendUrl, trendKeyword: keyword }
              }
            ];
          })
          .filter((item) => item.keyword);
      },
      startedAt
    );
  }
};

export const googleNewsRssAdapter: ResearchSourceAdapter = {
  name: "google_news_rss",
  isEnabled: () => true,
  fetch: async ({ config }: ResearchAdapterContext) => {
    const startedAt = Date.now();
    return safeAdapter(
      "google_news_rss",
      async () => {
        const xml = await fetchText(
          "https://news.google.com/rss/topstories?hl=en-US&gl=US&ceid=US:en",
          config
        );
        const data = parser.parse(xml);
        const items = asArray(data?.rss?.channel?.item).slice(0, 35) as Record<string, unknown>[];
        return items
          .map((item) => {
            const title = cleanResearchText(item.title, 220);
            const publisher = rssItemPublisher(item) || "Google News";
            return {
              source: "google_news_rss" as const,
              externalId: cleanResearchText(
                typeof item.guid === "object"
                  ? (item.guid as Record<string, unknown>)["#text"]
                  : item.guid || item.link,
                260
              ),
              keyword: title,
              headline: title,
              summary: cleanResearchText(item.description, 500),
              sourceUrl: cleanResearchText(item.link, 500),
              publisher,
              categoryHint: classifyCategory(`${title} ${publisher}`),
              region: config.region,
              language: config.language,
              publishedAt: cleanResearchText(item.pubDate, 80),
              popularitySignals: { sourceRank: 1 },
              relatedQueries: [],
              rawMetadata: { publisher }
            };
          })
          .filter((item) => item.headline && item.sourceUrl);
      },
      startedAt
    );
  }
};

export const rssFeedAdapter: ResearchSourceAdapter = {
  name: "rss_feed",
  isEnabled: () => true,
  fetch: async ({ config }: ResearchAdapterContext) => {
    const startedAt = Date.now();
    return safeAdapter(
      "rss_feed",
      async () => {
        const stories = await prisma.feedStory.findMany({
          take: 40,
          orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
          include: { feed: { include: { category: true } } }
        });
        return stories.map((story) => ({
          source: "rss_feed" as const,
          externalId: story.externalId,
          keyword: story.title,
          headline: story.title,
          summary: story.excerpt || story.content || "",
          sourceUrl: story.sourceUrl,
          publisher: story.feed.title,
          categoryHint: story.feed.category?.name || undefined,
          region: config.region,
          language: config.language,
          publishedAt: story.publishedAt || story.fetchedAt,
          popularitySignals: { saved: story.isRead ? 0 : 1 },
          relatedQueries: [],
          rawMetadata: {
            feedId: story.feedId,
            imageUrl: story.imageUrl
          }
        }));
      },
      startedAt
    );
  }
};

export const internalAnalyticsAdapter: ResearchSourceAdapter = {
  name: "internal_analytics",
  isEnabled: () => true,
  fetch: async ({ config }: ResearchAdapterContext) => {
    const startedAt = Date.now();
    return safeAdapter(
      "internal_analytics",
      async () => {
        const posts = await prisma.post.findMany({
          take: 20,
          where: { status: "published" },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          include: { category: true }
        });
        return posts.map((post) => ({
          source: "internal_analytics" as const,
          externalId: `post:${post.id}`,
          keyword: post.title,
          headline: post.title,
          summary: post.summary || post.excerpt,
          sourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://daily-signal-wire.vercel.app"}/news/${
            post.slug
          }`,
          publisher: "Daily Signal Wire",
          categoryHint: post.category?.name || undefined,
          region: config.region,
          language: config.language,
          publishedAt: post.publishedAt || post.createdAt,
          popularitySignals: { internalCount: 1 },
          relatedQueries: [],
          rawMetadata: { postId: post.id }
        }));
      },
      startedAt
    );
  }
};

export const redditAdapter: ResearchSourceAdapter = {
  name: "reddit",
  isEnabled: (config) => Boolean(config.redditClientId && config.redditClientSecret),
  fetch: async ({ config }: ResearchAdapterContext) => {
    const startedAt = Date.now();
    if (!redditAdapter.isEnabled(config)) {
      return result("reddit", "disabled", [], startedAt, "REDDIT_CLIENT_ID/SECRET not configured.");
    }
    return safeAdapter(
      "reddit",
      async () => {
        const credentials = Buffer.from(
          `${config.redditClientId}:${config.redditClientSecret}`
        ).toString("base64");
        const tokenResponse = await fetch("https://www.reddit.com/api/v1/access_token", {
          method: "POST",
          headers: {
            Authorization: `Basic ${credentials}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "DailySignalWire/1.0 research-engine"
          },
          body: "grant_type=client_credentials",
          signal: AbortSignal.timeout(config.sourceTimeoutMs),
          cache: "no-store"
        });
        if (!tokenResponse.ok) throw new Error(`Reddit auth failed ${tokenResponse.status}`);
        const tokenData = (await tokenResponse.json()) as { access_token?: string };
        if (!tokenData.access_token) throw new Error("Reddit auth did not return an access token.");
        const response = await fetch(
          "https://oauth.reddit.com/r/news+politics+technology+worldnews/hot?limit=20",
          {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              "User-Agent": "DailySignalWire/1.0 research-engine"
            },
            signal: AbortSignal.timeout(config.sourceTimeoutMs),
            cache: "no-store"
          }
        );
        if (!response.ok) throw new Error(`Reddit hot feed failed ${response.status}`);
        const data = (await response.json()) as {
          data?: { children?: Array<{ data?: Record<string, unknown> }> };
        };
        return (data.data?.children || []).map(({ data: post = {} }) => {
          const title = cleanResearchText(post.title, 220);
          const permalink = cleanResearchText(post.permalink, 300);
          return {
            source: "reddit" as const,
            externalId: `reddit:${cleanResearchText(post.id, 120)}`,
            keyword: title,
            headline: title,
            summary: cleanResearchText(post.selftext || post.url, 500),
            sourceUrl: permalink.startsWith("http") ? permalink : `https://reddit.com${permalink}`,
            publisher: `r/${cleanResearchText(post.subreddit, 80)}`,
            categoryHint: classifyCategory(title),
            region: config.region,
            language: config.language,
            publishedAt: new Date(Number(post.created_utc || 0) * 1000).toISOString(),
            popularitySignals: {
              redditScore: Number(post.score || 0),
              comments: Number(post.num_comments || 0)
            },
            relatedQueries: [],
            rawMetadata: {
              subreddit: cleanResearchText(post.subreddit, 80),
              domain: cleanResearchText(post.domain, 120)
            }
          };
        });
      },
      startedAt
    );
  }
};

export const youtubeAdapter: ResearchSourceAdapter = {
  name: "youtube",
  isEnabled: (config) => Boolean(config.youtubeApiKey),
  fetch: async ({ config }: ResearchAdapterContext) => {
    const startedAt = Date.now();
    if (!youtubeAdapter.isEnabled(config)) {
      return result("youtube", "disabled", [], startedAt, "YOUTUBE_API_KEY not configured.");
    }
    return safeAdapter(
      "youtube",
      async () => {
        const url = new URL("https://www.googleapis.com/youtube/v3/videos");
        url.searchParams.set("part", "snippet,statistics");
        url.searchParams.set("chart", "mostPopular");
        url.searchParams.set("regionCode", "US");
        url.searchParams.set("videoCategoryId", "25");
        url.searchParams.set("maxResults", "20");
        url.searchParams.set("key", config.youtubeApiKey || "");
        const response = await fetch(url, {
          signal: AbortSignal.timeout(config.sourceTimeoutMs),
          cache: "no-store"
        });
        if (!response.ok) throw new Error(`YouTube request failed ${response.status}`);
        const data = (await response.json()) as { items?: Array<Record<string, unknown>> };
        return (data.items || []).map((video) => {
          const snippet = (video.snippet || {}) as Record<string, unknown>;
          const statistics = (video.statistics || {}) as Record<string, unknown>;
          const title = cleanResearchText(snippet.title, 220);
          return {
            source: "youtube" as const,
            externalId: `youtube:${cleanResearchText(video.id, 120)}`,
            keyword: title,
            headline: title,
            summary: cleanResearchText(snippet.description, 500),
            sourceUrl: `https://www.youtube.com/watch?v=${cleanResearchText(video.id, 120)}`,
            publisher: cleanResearchText(snippet.channelTitle, 120) || "YouTube",
            categoryHint: classifyCategory(title),
            region: config.region,
            language: config.language,
            publishedAt: cleanResearchText(snippet.publishedAt, 80),
            popularitySignals: {
              youtubeViews: Number(statistics.viewCount || 0),
              likes: Number(statistics.likeCount || 0)
            },
            relatedQueries: [],
            rawMetadata: { channelId: cleanResearchText(snippet.channelId, 120) }
          };
        });
      },
      startedAt
    );
  }
};

export const researchAdapters: ResearchSourceAdapter[] = [
  googleTrendsAdapter,
  googleNewsRssAdapter,
  rssFeedAdapter,
  redditAdapter,
  youtubeAdapter,
  internalAnalyticsAdapter
];

export function researchSourceReadiness(config: ResearchConfig) {
  return researchAdapters.map((adapter) => ({
    source: adapter.name,
    enabled: adapter.isEnabled(config)
  }));
}
