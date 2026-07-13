import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
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
  const posts = await safeDbQuery("image_sitemap_posts_query_failed", [], () =>
    prisma.post.findMany({
      where: { status: "published" },
      select: {
        slug: true,
        title: true,
        excerpt: true,
        imageAlt: true,
        imageCaption: true,
        imageLicense: true,
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
      if (!image) return "";
      const imageUrl = absoluteUrl(image);
      return `  <url>
    <loc>${escapeXml(absoluteUrl(`/news/${post.slug}`))}</loc>
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(post.imageAlt || post.title)}</image:title>
      <image:caption>${escapeXml(post.imageCaption || post.excerpt)}</image:caption>
      ${post.imageLicense?.startsWith("http") ? `<image:license>${escapeXml(post.imageLicense)}</image:license>` : ""}
    </image:image>
  </url>`;
    })
    .filter(Boolean)
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=7200"
    }
  });
}
