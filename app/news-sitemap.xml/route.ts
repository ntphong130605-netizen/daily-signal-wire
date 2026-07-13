import { prisma, safeDbQuery } from "@/lib/prisma";
import { parseStringArray } from "@/lib/json";
import { absoluteUrl, siteName } from "@/lib/site";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const posts = await safeDbQuery(
    "news_sitemap_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: {
          status: "published",
          publishedAt: { gte: since }
        },
        select: {
          slug: true,
          title: true,
          tags: true,
          publishedAt: true,
          updatedAt: true,
          category: { select: { name: true } },
          trend: { select: { category: true } }
        },
        orderBy: { publishedAt: "desc" },
        take: 1000
      })
  );

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${posts
  .map((post) => {
    const publishedAt = post.publishedAt || post.updatedAt || new Date();
    const category = post.category?.name || post.trend?.category || "Latest";
    const keywords = [category, ...parseStringArray(post.tags)].filter(Boolean).slice(0, 10);
    return `  <url>
    <loc>${escapeXml(absoluteUrl(`/news/${post.slug}`))}</loc>
    <news:news>
      <news:publication>
        <news:name>${escapeXml(siteName)}</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${publishedAt.toISOString()}</news:publication_date>
      <news:title>${escapeXml(post.title)}</news:title>
      ${keywords.length ? `<news:keywords>${escapeXml(keywords.join(", "))}</news:keywords>` : ""}
    </news:news>
  </url>`;
  })
  .join("\n")}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600"
    }
  });
}
