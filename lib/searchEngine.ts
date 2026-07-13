import { getCategoryMeta, matchesCategorySlug, newsroomCategories } from "@/lib/categoryLanding";
import { slugify } from "@/lib/slug";

export type SearchFilters = {
  q?: string;
  category?: string;
  tag?: string;
  date?: "any" | "24h" | "7d" | "30d" | "year";
  author?: string;
  readingTime?: "any" | "under-3" | "3-5" | "5-10" | "10-plus";
  trending?: boolean;
  ai?: boolean;
};

export type SearchCandidate = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  content?: string | null;
  imageUrl: string | null;
  imageAlt?: string | null;
  category: string;
  categorySlug: string;
  tags: string[];
  author: string;
  source: string;
  aiGenerated: boolean;
  trendId?: string | null;
  publishedAt: string | null;
  createdAt: string;
};

export type SearchResult = SearchCandidate & {
  readingMinutes: number;
  score: number;
  matchedFields: string[];
  views: number | null;
};

export type SearchSuggestion = {
  type: "article" | "category" | "tag" | "topic";
  label: string;
  href: string;
  meta?: string;
};

export type SearchResponse = {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  suggestions: SearchSuggestion[];
  relatedSearches: string[];
  popularSearches: string[];
  trendingTopics: string[];
  facets: {
    categories: Array<{ label: string; value: string; count: number }>;
    tags: Array<{ label: string; value: string; count: number }>;
    authors: Array<{ label: string; value: string; count: number }>;
  };
  total: number;
};

const popularFallbackSearches = [
  "AI",
  "Business",
  "Technology",
  "US News",
  "Climate",
  "Sports",
  "OpenAI",
  "Markets"
];

export function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value: string) {
  return normalizeSearchText(value).split(/\s+/).filter(Boolean);
}

function readingMinutes(candidate: SearchCandidate) {
  const source = [
    candidate.title,
    candidate.subtitle,
    candidate.excerpt,
    candidate.summary,
    candidate.content
  ]
    .filter(Boolean)
    .join(" ");
  return Math.max(1, Math.ceil(source.split(/\s+/).filter(Boolean).length / 220));
}

function levenshtein(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i += 1) matrix[i] = [i];
  for (let j = 0; j <= a.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i += 1) {
    for (let j = 1; j <= a.length; j += 1) {
      matrix[i][j] =
        b.charAt(i - 1) === a.charAt(j - 1)
          ? matrix[i - 1][j - 1]
          : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyTokenScore(fieldText: string, token: string) {
  const normalized = normalizeSearchText(fieldText);
  if (!token) return 0;
  if (normalized.includes(token)) return 1;
  const fieldWords = normalized.split(/\s+/).filter(Boolean);
  if (fieldWords.some((word) => word.startsWith(token) || token.startsWith(word))) return 0.74;
  if (token.length >= 4 && fieldWords.some((word) => levenshtein(word, token) <= 1)) return 0.58;
  if (token.length >= 6 && fieldWords.some((word) => levenshtein(word, token) <= 2)) return 0.42;
  return 0;
}

function datePasses(value: string | null, date: SearchFilters["date"]) {
  if (!date || date === "any") return true;
  if (!value) return false;
  const published = new Date(value).getTime();
  const diff = Date.now() - published;
  const hours = diff / 3_600_000;
  if (date === "24h") return hours <= 24;
  if (date === "7d") return hours <= 24 * 7;
  if (date === "30d") return hours <= 24 * 30;
  if (date === "year") return hours <= 24 * 365;
  return true;
}

function readingPasses(value: number, range: SearchFilters["readingTime"]) {
  if (!range || range === "any") return true;
  if (range === "under-3") return value < 3;
  if (range === "3-5") return value >= 3 && value <= 5;
  if (range === "5-10") return value > 5 && value <= 10;
  if (range === "10-plus") return value > 10;
  return true;
}

function isTrending(candidate: SearchCandidate) {
  const published = candidate.publishedAt ? new Date(candidate.publishedAt).getTime() : 0;
  return Boolean(candidate.trendId) || (published > 0 && Date.now() - published <= 72 * 3_600_000);
}

function scoreCandidate(candidate: SearchCandidate, query: string) {
  const tokens = words(query);
  const phrase = normalizeSearchText(query);
  const fields = [
    { name: "title", value: candidate.title, weight: 46 },
    { name: "subtitle", value: candidate.subtitle || "", weight: 30 },
    { name: "summary", value: candidate.summary || "", weight: 24 },
    { name: "excerpt", value: candidate.excerpt, weight: 22 },
    { name: "category", value: candidate.category, weight: 20 },
    { name: "tags", value: candidate.tags.join(" "), weight: 18 },
    { name: "source", value: `${candidate.source} ${candidate.author}`, weight: 10 },
    { name: "content", value: candidate.content || "", weight: 6 }
  ];

  if (!tokens.length) {
    const published = candidate.publishedAt ? new Date(candidate.publishedAt).getTime() : 0;
    return {
      score: published / 10_000_000_000 + (isTrending(candidate) ? 14 : 0),
      matchedFields: [] as string[]
    };
  }

  let score = 0;
  const matchedFields = new Set<string>();
  for (const field of fields) {
    const normalized = normalizeSearchText(field.value);
    if (phrase && normalized.includes(phrase)) {
      score += field.weight * 1.8;
      matchedFields.add(field.name);
    }
    for (const token of tokens) {
      const tokenScore = fuzzyTokenScore(field.value, token);
      if (tokenScore > 0) {
        score += field.weight * tokenScore;
        matchedFields.add(field.name);
      }
    }
  }

  if (isTrending(candidate)) score += 8;
  if (candidate.aiGenerated) score += 2;
  return { score, matchedFields: Array.from(matchedFields) };
}

export function buildFacets(candidates: SearchCandidate[]) {
  const categories = new Map<string, { label: string; count: number }>();
  const tags = new Map<string, { label: string; count: number }>();
  const authors = new Map<string, { label: string; count: number }>();

  for (const candidate of candidates) {
    categories.set(candidate.categorySlug, {
      label: candidate.category,
      count: (categories.get(candidate.categorySlug)?.count || 0) + 1
    });
    authors.set(slugify(candidate.author), {
      label: candidate.author,
      count: (authors.get(slugify(candidate.author))?.count || 0) + 1
    });
    for (const tag of candidate.tags) {
      const key = slugify(tag);
      if (!key) continue;
      tags.set(key, { label: tag, count: (tags.get(key)?.count || 0) + 1 });
    }
  }

  const toFacet = (map: Map<string, { label: string; count: number }>, limit: number) =>
    Array.from(map.entries())
      .map(([value, item]) => ({ value, label: item.label, count: item.count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, limit);

  return {
    categories: toFacet(categories, 14),
    tags: toFacet(tags, 24),
    authors: toFacet(authors, 10)
  };
}

export function buildSearchResponse(
  candidates: SearchCandidate[],
  filters: SearchFilters
): SearchResponse {
  const query = filters.q?.trim() || "";
  const candidateFacets = buildFacets(candidates);
  const filtered = candidates
    .map((candidate) => {
      const minutes = readingMinutes(candidate);
      const scored = scoreCandidate(candidate, query);
      return {
        ...candidate,
        readingMinutes: minutes,
        score: scored.score,
        matchedFields: scored.matchedFields,
        views: null
      } satisfies SearchResult;
    })
    .filter((result) => {
      if (query && result.score <= 0) return false;
      if (
        filters.category &&
        !matchesCategorySlug({
          slug: filters.category,
          categoryName: result.category,
          categorySlug: result.categorySlug,
          trendCategory: result.category,
          tags: result.tags
        })
      ) {
        return false;
      }
      if (filters.tag && !result.tags.some((tag) => slugify(tag) === slugify(filters.tag || ""))) {
        return false;
      }
      if (filters.author && slugify(result.author) !== slugify(filters.author)) return false;
      if (!datePasses(result.publishedAt, filters.date)) return false;
      if (!readingPasses(result.readingMinutes, filters.readingTime)) return false;
      if (filters.trending && !isTrending(result)) return false;
      if (filters.ai && !result.aiGenerated) return false;
      return true;
    })
    .sort((a, b) => b.score - a.score || new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime());

  const allTags = candidateFacets.tags.map((tag) => tag.label);
  const trendingTopics = [
    ...new Set([
      ...filtered.filter(isTrending).flatMap((item) => [item.category, ...item.tags]),
      ...candidates.flatMap((item) => item.tags),
      ...newsroomCategories.map((category) => category.name)
    ])
  ]
    .filter(Boolean)
    .slice(0, 14);

  const suggestions: SearchSuggestion[] = [
    ...filtered.slice(0, 6).map((item) => ({
      type: "article" as const,
      label: item.title,
      href: `/news/${item.slug}`,
      meta: `${item.category} · ${item.readingMinutes} min read`
    })),
    ...newsroomCategories
      .filter((category) => {
        if (!query) return true;
        const haystack = normalizeSearchText(`${category.name} ${category.description} ${category.keywords.join(" ")}`);
        return words(query).some((token) => fuzzyTokenScore(haystack, token) > 0);
      })
      .slice(0, 4)
      .map((category) => ({
        type: "category" as const,
        label: category.name,
        href: `/category/${category.slug}`,
        meta: "Category"
      })),
    ...allTags.slice(0, 5).map((tag) => ({
      type: "tag" as const,
      label: tag,
      href: `/tag/${slugify(tag)}`,
      meta: "Tag"
    }))
  ].slice(0, 14);

  const relatedSearches = [
    ...new Set([
      ...(query ? words(query).map((token) => `${token} latest`) : []),
      ...filtered.slice(0, 8).flatMap((item) => [
        `${item.category} ${query || "news"}`,
        ...item.tags.slice(0, 2)
      ]),
      ...trendingTopics
    ])
  ]
    .filter(Boolean)
    .slice(0, 12);

  return {
    query,
    filters,
    results: filtered,
    suggestions,
    relatedSearches,
    popularSearches: [...new Set([...popularFallbackSearches, ...candidateFacets.tags.map((tag) => tag.label)])].slice(0, 12),
    trendingTopics,
    facets: candidateFacets,
    total: filtered.length
  };
}

export function categorySuggestionFromSlug(slug: string) {
  const meta = getCategoryMeta(slug);
  return meta?.name || slug;
}

