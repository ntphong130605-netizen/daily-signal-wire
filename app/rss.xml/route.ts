import { prisma, safeDbQuery } from "@/lib/prisma";
import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { parseStringArray } from "@/lib/json";
import { stripMarkdown } from "@/lib/newsSeo";
import { absoluteUrl, siteDescription, siteName } from "@/lib/site";

export const dynamic = "force-dynamic";

function escapeXml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cdata(value: string | null | undefined) {
  return `<![CDATA[${String(value || "").replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function markdownToRssHtml(content: string) {
  const html = content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const heading = block.match(/^#{2,4}\s+(.+)$/);
      if (heading) return `<h2>${escapeXml(stripMarkdown(heading[1]))}</h2>`;
      return `<p>${escapeXml(stripMarkdown(block))}</p>`;
    })
    .join("");

  return html || `<p>${escapeXml(stripMarkdown(content))}</p>`;
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
          content: true,
          tags: true,
          seoDescription: true,
          imageAlt: true,
          imageCaption: true,
          imageCredit: true,
          imageUrl: true,
          featuredImageUrl: true,
          featuredImage: true,
          thumbnailImage: true,
          openGraphImage: true,
          publishedAt: true,
          updatedAt: true,
          category: { select: { name: true } },
          trend: { select: { category: true } }
        },
        orderBy: { publishedAt: "desc" },
        take: 50
      })
  );

  const updatedAt = posts[0]?.publishedAt || posts[0]?.updatedAt || new Date();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:media="http://search.yahoo.com/mrss/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
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
        const category = post.category?.name || post.trend?.category || "Latest";
        const image = normalizeEditorialImageUrl(
          post.openGraphImage ||
            post.featuredImageUrl ||
            post.featuredImage ||
            post.imageUrl ||
            post.thumbnailImage ||
            placeholderImageForCategory(category),
          category
        );
        const imageUrl = image ? absoluteUrl(image) : "";
        const tags = parseStringArray(post.tags);
        const description = post.seoDescription || post.excerpt;
        return `<item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${cdata(description)}</description>
      <dc:creator>${escapeXml(siteName)}</dc:creator>
      <category>${escapeXml(category)}</category>
      ${tags.map((tag) => `<category>${escapeXml(tag)}</category>`).join("\n      ")}
      <pubDate>${(post.publishedAt || post.updatedAt).toUTCString()}</pubDate>
      ${imageUrl ? `<media:content url="${escapeXml(imageUrl)}" medium="image" width="1600" height="900" />
      <media:thumbnail url="${escapeXml(imageUrl)}" width="1600" height="900" />
      <media:title>${cdata(post.imageAlt || post.title)}</media:title>
      <media:description>${cdata(post.imageCaption || post.excerpt)}</media:description>
      ${post.imageCredit ? `<media:credit>${escapeXml(post.imageCredit)}</media:credit>` : ""}` : ""}
      <content:encoded>${cdata(`${imageUrl ? `<p><img src="${escapeXml(imageUrl)}" alt="${escapeXml(post.imageAlt || post.title)}" width="1600" height="900" /></p>` : ""}${markdownToRssHtml(post.content)}`)}</content:encoded>
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
