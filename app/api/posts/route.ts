import { prisma, safeDbQuery } from "@/lib/prisma";
import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { matchesCategorySlug } from "@/lib/categoryLanding";
import { publicCache, sanitizeQueryParam } from "@/lib/http";
import { parseStringArray } from "@/lib/json";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const take = Math.min(12, Math.max(3, Number(searchParams.get("limit") || 6)));
  const skip = (page - 1) * take;
  const category = sanitizeQueryParam(searchParams.get("category"), 80);
  const tag = sanitizeQueryParam(searchParams.get("tag"), 80);
  const query = sanitizeQueryParam(searchParams.get("q"), 120).toLowerCase();
  const hasClientFiltering = Boolean(category || tag || query);

  const posts = await safeDbQuery(
    "public_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: { status: "published" },
        include: {
          trend: { select: { category: true } },
          category: { select: { name: true, slug: true } },
          sourceStory: { include: { feed: { select: { title: true } } } }
        },
        orderBy: { publishedAt: "desc" },
        skip: hasClientFiltering ? 0 : skip,
        take: hasClientFiltering ? 240 : take
      })
  );

  const filteredPosts = posts.filter((post) => {
    const tags = parseStringArray(post.tags);
    if (
      category &&
      !matchesCategorySlug({
        slug: category,
        categoryName: post.category?.name,
        categorySlug: post.category?.slug,
        trendCategory: post.trend?.category,
        tags
      })
    ) {
      return false;
    }
    if (tag && !tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return false;
    if (query) {
      const haystack = [
        post.title,
        post.subtitle,
        post.excerpt,
        post.summary,
        post.content,
        post.category?.name,
        post.trend?.category,
        ...tags
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    }
    return true;
  });

  const pagedPosts = hasClientFiltering
    ? filteredPosts.slice(skip, skip + take)
    : filteredPosts;

  return Response.json(
    {
      posts: pagedPosts.map((post) => {
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
      nextPage:
        hasClientFiltering
          ? filteredPosts.length > skip + take
            ? page + 1
            : null
          : posts.length === take
            ? page + 1
            : null
    },
    {
      headers: {
        "Cache-Control": publicCache(hasClientFiltering ? 60 : 180, 600)
      }
    }
  );
}
