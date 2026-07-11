import { XMLParser } from "fast-xml-parser";
import { slugify } from "@/lib/slug";
import { logError } from "@/lib/logger";

export type SourceContext = {
  title: string;
  source: string;
  url: string;
  snippet: string;
};

export type TrendCandidate = {
  keyword: string;
  normalizedKeyword: string;
  traffic?: string;
  relatedQueries: string[];
  sources: SourceContext[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
  processEntities: false
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": "DailySignalWire/1.0 editorial-trend-monitor" },
    signal: AbortSignal.timeout(12_000),
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Feed request failed with ${response.status}`);
  return response.text();
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function googleNewsSources(keyword: string): Promise<SourceContext[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(
      keyword
    )}&hl=en-US&gl=US&ceid=US:en`;
    const xml = await fetchText(url);
    const data = parser.parse(xml);
    const items = asArray(data?.rss?.channel?.item).slice(0, 5);
    return items
      .map((item: Record<string, unknown>) => ({
        title: cleanText(item.title),
        source: cleanText(
          typeof item.source === "object"
            ? (item.source as Record<string, unknown>)["#text"]
            : item.source
        ),
        url: String(item.link ?? ""),
        snippet: cleanText(item.description)
      }))
      .filter((item) => item.title && item.url.startsWith("https://"));
  } catch (error) {
    logError("google_news_sources_failed", error, { keyword });
    return [];
  }
}

export async function fetchGoogleTrendsUS(): Promise<TrendCandidate[]> {
  try {
    const xml = await fetchText(
      "https://trends.google.com/trending/rss?geo=US"
    );
    const data = parser.parse(xml);
    const items = asArray(data?.rss?.channel?.item).slice(0, 20);
    const candidates: TrendCandidate[] = [];

    for (const item of items as Record<string, unknown>[]) {
      const keyword = cleanText(item.title);
      if (!keyword) continue;
      const newsItems = asArray(
        item["ht:news_item"] as
          | Record<string, unknown>
          | Record<string, unknown>[]
      );
      const trendSources = newsItems
        .map((news) => ({
          title: cleanText(news["ht:news_item_title"]),
          source: cleanText(news["ht:news_item_source"]),
          url: String(news["ht:news_item_url"] ?? ""),
          snippet: cleanText(news["ht:news_item_snippet"])
        }))
        .filter((source) => source.title && source.url.startsWith("https://"));
      const fallbackSources =
        trendSources.length >= 2 ? [] : await googleNewsSources(keyword);
      const sources = [...trendSources, ...fallbackSources].filter(
        (source, index, list) =>
          list.findIndex((candidate) => candidate.url === source.url) === index
      );

      candidates.push({
        keyword,
        normalizedKeyword: slugify(keyword),
        traffic: cleanText(item["ht:approx_traffic"]) || undefined,
        relatedQueries: sources.slice(0, 5).map((source) => source.title),
        sources: sources.slice(0, 8)
      });
    }

    return candidates;
  } catch (error) {
    logError("google_trends_feed_failed", error);
    return [];
  }
}
