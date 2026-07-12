import { prisma, safeDbQuery } from "@/lib/prisma";
import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";

function parseStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const take = Math.min(12, Math.max(3, Number(searchParams.get("limit") || 6)));
  const skip = (page - 1) * take;

  const posts = await safeDbQuery(
    "public_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: { status: "published" },
        include: {
          trend: { select: { category: true } },
          category: { select: { name: true } },
          sourceStory: { include: { feed: { select: { title: true } } } }
        },
        orderBy: { publishedAt: "desc" },
        skip,
        take
      })
  );

  return Response.json({
    posts: posts.map((post) => {
      const category = post.category?.name || post.trend?.category || "Latest";
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        summary: post.summary,
        imageUrl: normalizeEditorialImageUrl(
          post.featuredImageUrl ||
            post.featuredImage ||
            post.imageUrl ||
            post.thumbnailImage ||
            placeholderImageForCategory(category),
          category
        ),
        imageAlt: post.imageAlt || "",
        category,
        source: post.sourceStory?.feed?.title || "Daily Signal Wire",
        tags: parseStringArray(post.tags),
        publishedAt: (post.publishedAt || post.createdAt).toISOString(),
        createdAt: post.createdAt.toISOString()
      };
    }),
    nextPage: posts.length === take ? page + 1 : null
  });
}
