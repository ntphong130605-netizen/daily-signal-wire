import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl, siteDescription, siteName } from "@/lib/site";

export const dynamic = "force-dynamic";

function escapeXml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET() {
  const posts = await safeDbQuery(
    "rss_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: { status: "published" },
        select: {
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          updatedAt: true
        },
        orderBy: { publishedAt: "desc" },
        take: 50
      })
  );

  const updatedAt = posts[0]?.publishedAt || posts[0]?.updatedAt || new Date();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${absoluteUrl("/")}</link>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml" />
    <description>${escapeXml(siteDescription())}</description>
    <language>en-US</language>
    <lastBuildDate>${updatedAt.toUTCString()}</lastBuildDate>
    ${posts
      .map((post) => {
        const url = absoluteUrl(`/news/${post.slug}`);
        return `<item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.excerpt)}</description>
      <pubDate>${(post.publishedAt || post.updatedAt).toUTCString()}</pubDate>
    </item>`;
      })
      .join("\n    ")}
  </channel>
</rss>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "s-maxage=600, stale-while-revalidate=3600"
    }
  });
}
