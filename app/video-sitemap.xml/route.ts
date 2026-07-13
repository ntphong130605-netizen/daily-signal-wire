import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { parseStringArray } from "@/lib/json";
import { compactSeoText, extractFirstVideoUrl, videoEmbedUrl } from "@/lib/newsSeo";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

function escapeXml(value: string | null | undefined) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = await safeDbQuery("video_sitemap_posts_query_failed", [], () =>
    prisma.post.findMany({
      where: { status: "published" },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        sourceUrls: true,
        publishedAt: true,
        updatedAt: true,
        imageUrl: true,
        featuredImageUrl: true,
        featuredImage: true,
        thumbnailImage: true,
        openGraphImage: true,
        category: { select: { name: true } },
        trend: { select: { category: true } }
      },
      orderBy: { publishedAt: "desc" },
      take: 1000
    })
  );

  const urls = posts
    .map((post) => {
      const videoUrl = extractFirstVideoUrl([post.content, ...parseStringArray(post.sourceUrls)]);
      if (!videoUrl) return "";
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
      const thumbnailUrl = image ? absoluteUrl(image) : absoluteUrl(placeholderImageForCategory(category));
      return `  <url>
    <loc>${escapeXml(absoluteUrl(`/news/${post.slug}`))}</loc>
    <video:video>
      <video:thumbnail_loc>${escapeXml(thumbnailUrl)}</video:thumbnail_loc>
      <video:title>${escapeXml(post.title)}</video:title>
      <video:description>${escapeXml(compactSeoText(post.excerpt, 200))}</video:description>
      <video:content_loc>${escapeXml(videoUrl)}</video:content_loc>
      <video:player_loc>${escapeXml(videoEmbedUrl(videoUrl))}</video:player_loc>
      <video:publication_date>${(post.publishedAt || post.updatedAt).toISOString()}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
    </video:video>
  </url>`;
    })
    .filter(Boolean)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urls}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200"
    }
  });
}
