import { XMLParser } from "fast-xml-parser";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { protectMutation, apiError } from "@/lib/apiSecurity";
import { addFeedFromUrl } from "@/lib/rss";

function escapeXml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collectOutlineUrls(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(collectOutlineUrls);
  if (typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const url =
    typeof record["@xmlUrl"] === "string"
      ? record["@xmlUrl"]
      : typeof record.xmlUrl === "string"
        ? record.xmlUrl
        : "";
  return [
    ...(url ? [url] : []),
    ...collectOutlineUrls(record.outline)
  ];
}

export async function GET() {
  try {
    await requireAdmin();
    const folders = await prisma.feedFolder.findMany({
      include: { feeds: { orderBy: { title: "asc" } } },
      orderBy: { name: "asc" }
    });
    const uncategorized = await prisma.feed.findMany({
      where: { folderId: null },
      orderBy: { title: "asc" }
    });
    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0">',
      "<head><title>Daily Signal Wire feeds</title></head>",
      "<body>",
      ...folders.map((folder) =>
        [
          `<outline text="${escapeXml(folder.name)}" title="${escapeXml(folder.name)}">`,
          ...folder.feeds.map(
            (feed) =>
              `<outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(
                feed.title
              )}" xmlUrl="${escapeXml(feed.feedUrl)}" htmlUrl="${escapeXml(
                feed.siteUrl
              )}" />`
          ),
          "</outline>"
        ].join("")
      ),
      ...uncategorized.map(
        (feed) =>
          `<outline type="rss" text="${escapeXml(feed.title)}" title="${escapeXml(
            feed.title
          )}" xmlUrl="${escapeXml(feed.feedUrl)}" htmlUrl="${escapeXml(
            feed.siteUrl
          )}" />`
      ),
      "</body>",
      "</opml>"
    ].join("\n");
    return new Response(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="daily-signal-wire-feeds.opml"'
      }
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const text = await request.text();
    const parsed = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@"
    }).parse(text) as Record<string, unknown>;
    const opml = parsed.opml as Record<string, unknown> | undefined;
    const body = opml?.body as Record<string, unknown> | undefined;
    const urls = [...new Set(collectOutlineUrls(body?.outline))].slice(0, 50);
    const results = [];
    for (const url of urls) {
      try {
        const result = await addFeedFromUrl(url);
        results.push({ url, ok: true, feedId: result.feed.id, imported: result.imported });
      } catch (error) {
        results.push({
          url,
          ok: false,
          error: error instanceof Error ? error.message : "Import failed"
        });
      }
    }
    return Response.json({ imported: results.filter((result) => result.ok).length, results });
  } catch (error) {
    return apiError(error);
  }
}
