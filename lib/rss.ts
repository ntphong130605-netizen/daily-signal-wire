import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { logError, logInfo } from "@/lib/logger";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  cdataPropName: "#cdata",
  trimValues: true
});

export type ParsedFeedStory = {
  externalId: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  sourceUrl: string;
  author?: string;
  imageUrl?: string;
  publishedAt?: Date;
};

export type ParsedFeed = {
  title: string;
  slug: string;
  siteUrl?: string;
  feedUrl: string;
  description?: string;
  imageUrl?: string;
  stories: ParsedFeedStory[];
};

function arrayify<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function valueText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(valueText).find(Boolean) || "";
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return valueText(record["#cdata"]) || valueText(record["#text"]);
  }
  return "";
}

function attr(value: unknown, name: string): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return valueText(record[`@${name}`]) || valueText(record[name]);
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(value: string | undefined, max = 360) {
  const clean = stripHtml(value || "");
  if (!clean) return undefined;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function maybeDate(value: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function resolveUrl(base: string, href: string | undefined) {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

function feedHash(...parts: string[]) {
  return createHash("sha1").update(parts.filter(Boolean).join("|")).digest("hex");
}

function storyId(feedUrl: string, item: Record<string, unknown>, sourceUrl: string) {
  return feedHash(
    feedUrl,
    valueText(item.guid),
    valueText(item.id),
    valueText(item["dc:identifier"]),
    sourceUrl,
    valueText(item.title)
  );
}

function htmlImage(html: string | undefined, base: string) {
  if (!html) return undefined;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return resolveUrl(base, match?.[1]);
}

function mediaImage(item: Record<string, unknown>, base: string) {
  const mediaContent = arrayify(item["media:content"] as unknown);
  const mediaThumbnail = arrayify(item["media:thumbnail"] as unknown);
  const enclosure = arrayify(item.enclosure as unknown);
  const candidates = [...mediaThumbnail, ...mediaContent, ...enclosure];
  for (const candidate of candidates) {
    const url = attr(candidate, "url");
    const type = attr(candidate, "type");
    if (url && (!type || type.startsWith("image/"))) {
      return resolveUrl(base, url);
    }
  }
  return undefined;
}

function atomLink(entry: Record<string, unknown>, base: string) {
  const links = arrayify(entry.link as unknown);
  if (links.length === 0) return undefined;
  for (const link of links) {
    const href = attr(link, "href");
    const rel = attr(link, "rel");
    if (href && (!rel || rel === "alternate")) return resolveUrl(base, href);
  }
  return resolveUrl(base, attr(links[0], "href") || valueText(links[0]));
}

function rssLink(item: Record<string, unknown>, base: string) {
  const links = arrayify(item.link as unknown);
  for (const link of links) {
    const href = typeof link === "object" ? attr(link, "href") : valueText(link);
    const resolved = resolveUrl(base, href);
    if (resolved) return resolved;
  }
  return undefined;
}

function licensedFullContent(
  item: Record<string, unknown>,
  channel: Record<string, unknown>
) {
  const licenseHints = [
    valueText(item["creativeCommons:license"]),
    valueText(item["cc:license"]),
    valueText(item.rights),
    valueText(channel.copyright),
    valueText(channel.rights)
  ].join(" ");
  const feedAllowsRedistribution =
    /creative\s*commons|creativecommons|cc-by|public domain|public-domain/i.test(
      licenseHints
    );
  if (!feedAllowsRedistribution) return undefined;
  return excerpt(
    valueText(item["content:encoded"]) ||
      valueText(item.content) ||
      valueText(item.description) ||
      valueText(item.summary),
    5000
  );
}

function parseRssChannel(
  channel: Record<string, unknown>,
  feedUrl: string,
  rdfItems?: unknown
): ParsedFeed {
  const siteUrl = resolveUrl(feedUrl, valueText(channel.link));
  const items = arrayify((channel.item ?? rdfItems) as unknown);
  const title = valueText(channel.title) || new URL(feedUrl).hostname;
  const stories = items
    .map((raw): ParsedFeedStory | null => {
      if (!raw || typeof raw !== "object") return null;
      const item = raw as Record<string, unknown>;
      const sourceUrl = rssLink(item, feedUrl);
      const storyTitle = valueText(item.title);
      if (!sourceUrl || !storyTitle) return null;
      const rawSummary =
        valueText(item.description) ||
        valueText(item.summary) ||
        valueText(item["content:encoded"]);
      const imageUrl =
        mediaImage(item, feedUrl) ||
        htmlImage(valueText(item["content:encoded"]) || valueText(item.description), feedUrl);
      return {
        externalId: storyId(feedUrl, item, sourceUrl),
        title: storyTitle,
        slug: slugify(storyTitle) || feedHash(sourceUrl).slice(0, 12),
        excerpt: excerpt(rawSummary),
        content: licensedFullContent(item, channel),
        sourceUrl,
        author:
          valueText(item.author) ||
          valueText(item["dc:creator"]) ||
          valueText(item.creator) ||
          undefined,
        imageUrl,
        publishedAt:
          maybeDate(valueText(item.pubDate)) ||
          maybeDate(valueText(item.published)) ||
          maybeDate(valueText(item.updated))
      };
    })
    .filter((story): story is ParsedFeedStory => Boolean(story));

  return {
    title,
    slug: slugify(title) || feedHash(feedUrl).slice(0, 12),
    feedUrl,
    siteUrl,
    description: excerpt(valueText(channel.description), 500),
    imageUrl:
      resolveUrl(feedUrl, valueText((channel.image as Record<string, unknown>)?.url)) ||
      undefined,
    stories
  };
}

function parseAtomFeed(feed: Record<string, unknown>, feedUrl: string): ParsedFeed {
  const entries = arrayify(feed.entry as unknown);
  const title = valueText(feed.title) || new URL(feedUrl).hostname;
  const siteUrl = atomLink(feed, feedUrl);
  const stories = entries
    .map((raw): ParsedFeedStory | null => {
      if (!raw || typeof raw !== "object") return null;
      const entry = raw as Record<string, unknown>;
      const sourceUrl = atomLink(entry, feedUrl);
      const storyTitle = valueText(entry.title);
      if (!sourceUrl || !storyTitle) return null;
      const rawSummary = valueText(entry.summary) || valueText(entry.content);
      return {
        externalId: storyId(feedUrl, entry, sourceUrl),
        title: storyTitle,
        slug: slugify(storyTitle) || feedHash(sourceUrl).slice(0, 12),
        excerpt: excerpt(rawSummary),
        content: licensedFullContent(entry, feed),
        sourceUrl,
        author: valueText((entry.author as Record<string, unknown>)?.name) || undefined,
        imageUrl: mediaImage(entry, feedUrl) || htmlImage(valueText(entry.content), feedUrl),
        publishedAt:
          maybeDate(valueText(entry.published)) ||
          maybeDate(valueText(entry.updated)) ||
          maybeDate(valueText(entry["dc:date"]))
      };
    })
    .filter((story): story is ParsedFeedStory => Boolean(story));

  return {
    title,
    slug: slugify(title) || feedHash(feedUrl).slice(0, 12),
    feedUrl,
    siteUrl,
    description: excerpt(valueText(feed.subtitle), 500),
    imageUrl: resolveUrl(feedUrl, valueText(feed.logo) || valueText(feed.icon)),
    stories
  };
}

export function parseFeedXml(xml: string, feedUrl: string): ParsedFeed {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const rss = parsed.rss as Record<string, unknown> | undefined;
  const channel = rss?.channel as Record<string, unknown> | undefined;
  if (channel) return parseRssChannel(channel, feedUrl);

  const rdf = parsed["rdf:RDF"] as Record<string, unknown> | undefined;
  const rdfChannel = rdf?.channel as Record<string, unknown> | undefined;
  if (rdfChannel) return parseRssChannel(rdfChannel, feedUrl, rdf?.item);

  const atom = parsed.feed as Record<string, unknown> | undefined;
  if (atom) return parseAtomFeed(atom, feedUrl);

  throw new Error("The URL did not return a supported RSS or Atom feed.");
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: {
        accept:
          "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8",
        "user-agent": "DailySignalWire/1.0 (+https://localhost)"
      },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`Fetch failed with HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function feedAlternates(html: string, baseUrl: string) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  return links
    .map((tag) => {
      const type = tag.match(/\btype=["']([^"']+)["']/i)?.[1] || "";
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1] || "";
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      const isFeed =
        /alternate/i.test(rel) &&
        /(rss|atom|xml)/i.test(type) &&
        href &&
        !href.startsWith("mailto:");
      return isFeed ? resolveUrl(baseUrl, href) : undefined;
    })
    .filter((url): url is string => Boolean(url));
}

export async function loadFeed(inputUrl: string): Promise<ParsedFeed> {
  const initialUrl = new URL(inputUrl).toString();
  const text = await fetchText(initialUrl);
  try {
    return parseFeedXml(text, initialUrl);
  } catch (feedError) {
    const alternates = feedAlternates(text, initialUrl);
    for (const feedUrl of alternates) {
      try {
        return parseFeedXml(await fetchText(feedUrl), feedUrl);
      } catch {
        // Try the next discovered feed URL.
      }
    }
    throw feedError;
  }
}

async function uniqueFeedSlug(baseSlug: string, existingId?: string) {
  let candidate = baseSlug || "feed";
  let index = 2;
  while (true) {
    const existing = await prisma.feed.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === existingId) return candidate;
    candidate = `${baseSlug}-${index}`;
    index += 1;
  }
}

export async function persistFeedStories(feedId: string, stories: ParsedFeedStory[]) {
  let imported = 0;
  for (const story of stories) {
    const existing = await prisma.feedStory.findUnique({
      where: { externalId: story.externalId },
      select: { id: true }
    });
    await prisma.feedStory.upsert({
      where: { externalId: story.externalId },
      update: {
        title: story.title,
        excerpt: story.excerpt,
        content: story.content,
        sourceUrl: story.sourceUrl,
        author: story.author,
        imageUrl: story.imageUrl,
        publishedAt: story.publishedAt
      },
      create: {
        feedId,
        externalId: story.externalId,
        title: story.title,
        slug: story.slug,
        excerpt: story.excerpt,
        content: story.content,
        sourceUrl: story.sourceUrl,
        author: story.author,
        imageUrl: story.imageUrl,
        publishedAt: story.publishedAt
      }
    });
    if (!existing) imported += 1;
  }
  return imported;
}

export async function addFeedFromUrl(
  inputUrl: string,
  options: { folderId?: string; categoryId?: string } = {}
) {
  const parsed = await loadFeed(inputUrl);
  const existing = await prisma.feed.findUnique({
    where: { feedUrl: parsed.feedUrl },
    select: { id: true }
  });
  const slug = await uniqueFeedSlug(parsed.slug, existing?.id);
  const feed = await prisma.feed.upsert({
    where: { feedUrl: parsed.feedUrl },
    update: {
      title: parsed.title,
      slug,
      siteUrl: parsed.siteUrl,
      description: parsed.description,
      imageUrl: parsed.imageUrl,
      folderId: options.folderId,
      categoryId: options.categoryId,
      active: true,
      fetchStatus: "completed",
      lastFetchedAt: new Date(),
      lastError: null
    },
    create: {
      title: parsed.title,
      slug,
      feedUrl: parsed.feedUrl,
      siteUrl: parsed.siteUrl,
      description: parsed.description,
      imageUrl: parsed.imageUrl,
      folderId: options.folderId,
      categoryId: options.categoryId,
      fetchStatus: "completed",
      lastFetchedAt: new Date()
    }
  });
  const imported = await persistFeedStories(feed.id, parsed.stories);
  logInfo("rss_feed_added", { feedId: feed.id, imported });
  return { feed, imported };
}

export async function refreshFeed(feedId: string) {
  const feed = await prisma.feed.findUniqueOrThrow({ where: { id: feedId } });
  await prisma.feed.update({
    where: { id: feedId },
    data: { fetchStatus: "fetching", lastError: null }
  });
  try {
    const parsed = await loadFeed(feed.feedUrl);
    const imported = await persistFeedStories(feed.id, parsed.stories);
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        title: parsed.title,
        siteUrl: parsed.siteUrl,
        description: parsed.description,
        imageUrl: parsed.imageUrl,
        fetchStatus: "completed",
        lastFetchedAt: new Date(),
        lastError: null
      }
    });
    logInfo("rss_feed_refreshed", { feedId, imported });
    return { imported };
  } catch (error) {
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        fetchStatus: "failed",
        lastError: error instanceof Error ? error.message.slice(0, 800) : "Unknown error"
      }
    });
    logError("rss_feed_refresh_failed", error, { feedId });
    throw error;
  }
}

export async function refreshDueFeeds(minutes = 30) {
  const cutoff = new Date(Date.now() - minutes * 60 * 1000);
  const feeds = await prisma.feed.findMany({
    where: {
      active: true,
      OR: [{ lastFetchedAt: null }, { lastFetchedAt: { lt: cutoff } }]
    },
    orderBy: { lastFetchedAt: "asc" },
    take: 20
  });
  const results = [];
  for (const feed of feeds) {
    try {
      const result = await refreshFeed(feed.id);
      results.push({ feedId: feed.id, ok: true, ...result });
    } catch (error) {
      results.push({
        feedId: feed.id,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }
  return results;
}
