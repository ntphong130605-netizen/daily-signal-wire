import { prisma, safeDbQuery } from "@/lib/prisma";
import { placeholderImageForCategory } from "@/lib/aiImage";

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
        excerpt: post.excerpt,
        imageUrl:
          post.featuredImageUrl ||
          post.featuredImage ||
          post.imageUrl ||
          post.thumbnailImage ||
          placeholderImageForCategory(category),
        imageAlt: post.imageAlt || "",
        category,
        source: post.sourceStory?.feed?.title || "Daily Signal Wire",
        publishedAt: (post.publishedAt || post.createdAt).toISOString(),
        createdAt: post.createdAt.toISOString()
      };
    }),
    nextPage: posts.length === take ? page + 1 : null
  });
}
