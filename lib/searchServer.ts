import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { buildSearchResponse, type SearchCandidate, type SearchFilters } from "@/lib/searchEngine";
import { slugify } from "@/lib/slug";
import { siteName } from "@/lib/site";

function parseBoolean(value: string | null | undefined) {
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function filtersFromSearchParams(searchParams: URLSearchParams): SearchFilters {
  const date = searchParams.get("date") || "any";
  const readingTime = searchParams.get("readingTime") || "any";
  return {
    q: searchParams.get("q")?.trim() || "",
    category: searchParams.get("category")?.trim() || "",
    tag: searchParams.get("tag")?.trim() || "",
    date: ["24h", "7d", "30d", "year"].includes(date)
      ? (date as SearchFilters["date"])
      : "any",
    author: searchParams.get("author")?.trim() || "",
    readingTime: ["under-3", "3-5", "5-10", "10-plus"].includes(readingTime)
      ? (readingTime as SearchFilters["readingTime"])
      : "any",
    trending: parseBoolean(searchParams.get("trending")),
    ai: parseBoolean(searchParams.get("ai"))
  };
}

export function filtersFromRecord(record: Record<string, string | string[] | undefined>): SearchFilters {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(record)) {
    if (Array.isArray(value)) {
      if (value[0]) params.set(key, value[0]);
    } else if (value) {
      params.set(key, value);
    }
  }
  return filtersFromSearchParams(params);
}

async function loadSearchCandidates() {
  return safeDbQuery("search_candidates_query_failed", [] as SearchCandidate[], async () => {
    const posts = await prisma.post.findMany({
      where: { status: "published" },
      include: {
        category: { select: { name: true, slug: true } },
        trend: { select: { category: true } },
        sourceStory: { include: { feed: { select: { title: true } } } }
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 320
    });

    return posts.map((post): SearchCandidate => {
      const category = post.category?.name || post.trend?.category || "Latest";
      const tags = parseStringArray(post.tags);
      const author = "Daily Signal Wire Desk";
      const source = post.sourceStory?.feed?.title || siteName;
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        summary: post.summary,
        content: post.content,
        imageUrl: normalizeEditorialImageUrl(
          post.featuredImageUrl ||
            post.featuredImage ||
            post.imageUrl ||
            post.thumbnailImage ||
            placeholderImageForCategory(category),
          category
        ),
        imageAlt: post.imageAlt || post.title,
        category,
        categorySlug: post.category?.slug || slugify(category),
        tags,
        author,
        source,
        aiGenerated: post.aiGenerated,
        trendId: post.trendId,
        publishedAt: post.publishedAt?.toISOString() || null,
        createdAt: post.createdAt.toISOString()
      };
    });
  });
}

export async function runSearch(filters: SearchFilters) {
  const candidates = await loadSearchCandidates();
  return buildSearchResponse(candidates, filters);
}

