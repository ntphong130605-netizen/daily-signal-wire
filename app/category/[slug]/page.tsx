import type { Metadata } from "next";
import Link from "next/link";
import AdSlot from "@/components/ads/AdSlot";
import ArticleCard, {
  ArticleImage,
  estimateReadingTime,
  type ReaderPost
} from "@/components/ArticleCard";
import CategorySearchBox from "@/components/CategorySearchBox";
import InfinitePostFeed from "@/components/InfinitePostFeed";
import ReaderShell from "@/components/ReaderShell";
import {
  getCategoryMeta,
  matchesCategorySlug,
  newsroomCategories,
  titleFromCategorySlug
} from "@/lib/categoryLanding";
import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { absoluteUrl, siteName } from "@/lib/site";

export const dynamic = "force-dynamic";

type CategoryPostRecord = Awaited<ReturnType<typeof getPublishedPosts>>[number];

type SerializedReaderPost = Omit<ReaderPost, "publishedAt" | "createdAt"> & {
  publishedAt: string | null;
  createdAt: string;
};

function getCategoryDescription(slug: string) {
  const meta = getCategoryMeta(slug);
  return (
    meta?.description ||
    `Latest ${titleFromCategorySlug(slug)} news, source-first context and editor-reviewed Daily Signal Wire coverage.`
  );
}

function getCategoryImage(slug: string) {
  const meta = getCategoryMeta(slug);
  return meta?.image || placeholderImageForCategory(titleFromCategorySlug(slug));
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = titleFromCategorySlug(slug) || "Category";
  const description = getCategoryDescription(slug);
  const url = absoluteUrl(`/category/${slug}`);
  const image = absoluteUrl(getCategoryImage(slug));
  const keywords = [
    title,
    `${title} news`,
    `${title} latest`,
    `${title} analysis`,
    "Daily Signal Wire",
    ...(getCategoryMeta(slug)?.keywords || [])
  ];

  return {
    title: `${title} News`,
    description,
    keywords,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${title} News | ${siteName}`,
      description,
      url,
      type: "website",
      images: [
        {
          url: image,
          width: 1600,
          height: 900,
          alt: `${title} news coverage from ${siteName}`
        }
      ]
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} News | ${siteName}`,
      description,
      images: [image]
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1
      }
    }
  };
}

async function getPublishedPosts() {
  return prisma.post.findMany({
    where: { status: "published" },
    include: {
      category: { select: { name: true, slug: true } },
      trend: { select: { category: true } },
      sourceStory: { include: { feed: { select: { title: true } } } }
    },
    orderBy: { publishedAt: "desc" },
    take: 240
  });
}

function toReaderPost(post: CategoryPostRecord, fallbackCategory: string): ReaderPost {
  const category = post.category?.name || post.trend?.category || fallbackCategory;
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
    publishedAt: post.publishedAt,
    createdAt: post.createdAt
  };
}

function serializePost(post: ReaderPost): SerializedReaderPost {
  return {
    ...post,
    publishedAt: post.publishedAt?.toISOString() || null,
    createdAt: post.createdAt.toISOString()
  };
}

function timeAgo(date: Date | null | undefined) {
  if (!date) return "Just now";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function extractTopics(posts: ReaderPost[], fallbackTopics: string[]) {
  const counts = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags || []) {
      if (!tag || tag.length > 34) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [
    ...Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag),
    ...fallbackTopics
  ]
    .filter((topic, index, array) => array.findIndex((item) => slugify(item) === slugify(topic)) === index)
    .slice(0, 12);
}

function matchesSearch(post: ReaderPost, query?: string) {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [
    post.title,
    post.subtitle,
    post.excerpt,
    post.summary,
    post.category,
    post.source,
    ...(post.tags || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(needle);
}

export default async function CategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ slug }, queryParams] = await Promise.all([params, searchParams]);
  const searchQuery = queryParams.q?.trim() || "";
  const categoryMeta = getCategoryMeta(slug);
  const categoryTitle = titleFromCategorySlug(slug) || "Category";
  const categoryDescription = getCategoryDescription(slug);
  const categoryPath = `/category/${slug}`;

  const { posts, liveStories } = await safeDbQuery(
    "category_landing_query_failed",
    { posts: [], liveStories: [] } as {
      posts: CategoryPostRecord[];
      liveStories: Array<{
        id: string;
        title: string;
        excerpt: string | null;
        sourceUrl: string;
        publishedAt: Date | null;
        fetchedAt: Date;
        feed: { title: string };
      }>;
    },
    async () => {
      const [posts, liveStories] = await Promise.all([
        getPublishedPosts(),
        prisma.feedStory.findMany({
          where: {
            OR: [
              { title: { contains: categoryTitle } },
              { excerpt: { contains: categoryTitle } },
              ...(categoryMeta?.keywords.slice(0, 5).map((keyword) => ({
                title: { contains: keyword }
              })) || [])
            ]
          },
          include: { feed: { select: { title: true } } },
          orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
          take: 8
        })
      ]);
      return { posts, liveStories };
    }
  );

  const categoryPosts = posts
    .filter((post) =>
      matchesCategorySlug({
        slug,
        categoryName: post.category?.name,
        categorySlug: post.category?.slug,
        trendCategory: post.trend?.category,
        tags: parseStringArray(post.tags)
      })
    )
    .map((post) => toReaderPost(post, categoryTitle));

  const visiblePosts = categoryPosts.filter((post) => matchesSearch(post, searchQuery));
  const featuredPost = visiblePosts[0] || null;
  const latestPosts = visiblePosts.slice(1, 13);
  const trendingPosts = visiblePosts.slice(0, 6);
  const editorPicks = visiblePosts.slice(3, 7);
  const topics = extractTopics(visiblePosts, categoryMeta?.keywords || [categoryTitle]);
  const relatedCategories = (categoryMeta?.related || newsroomCategories.map((category) => category.slug))
    .map((relatedSlug) => getCategoryMeta(relatedSlug))
    .filter((category): category is NonNullable<typeof category> => Boolean(category))
    .slice(0, 6);
  const searchSuggestions = visiblePosts.slice(0, 10).map((post) => ({
    label: post.title,
    href: `/news/${post.slug}`,
    meta: `${post.category} · ${post.source || "Daily Signal Wire"}`
  }));
  const infiniteQuery = new URLSearchParams({
    category: slug,
    ...(searchQuery ? { q: searchQuery } : {})
  }).toString();
  const categoryJsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: `${categoryTitle} News`,
      url: absoluteUrl(categoryPath),
      description: categoryDescription,
      isPartOf: {
        "@type": "WebSite",
        name: siteName,
        url: absoluteUrl("/")
      },
      about: topics.slice(0, 8).map((topic) => ({ "@type": "Thing", name: topic }))
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        {
          "@type": "ListItem",
          position: 2,
          name: categoryTitle,
          item: absoluteUrl(categoryPath)
        }
      ]
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${categoryTitle} latest stories`,
      itemListElement: visiblePosts.slice(0, 12).map((post, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: absoluteUrl(`/news/${post.slug}`),
        name: post.title
      }))
    }
  ];

  return (
    <ReaderShell searchValue={searchQuery}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(categoryJsonLd) }}
      />
      <main
        className="category-landing"
        style={{ "--category-accent": categoryMeta?.accent || "#22a6b3" } as React.CSSProperties}
      >
        <nav className="category-sticky-nav" aria-label="Category navigation">
          {newsroomCategories.map((category) => (
            <Link
              key={category.slug}
              href={`/category/${category.slug}`}
              aria-current={category.slug === slug ? "page" : undefined}
            >
              {category.name}
            </Link>
          ))}
        </nav>

        <div className="category-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span aria-current="page">{categoryTitle}</span>
        </div>

        <AdSlot position="top" className="category-ad category-ad-hero" />

        {featuredPost ? (
          <section className="category-hero-premium" aria-labelledby="category-hero-title">
            <div className="category-hero-copy">
              <p className="category-kicker">{categoryTitle}</p>
              <h1 id="category-hero-title">
                <Link href={`/news/${featuredPost.slug}`}>{featuredPost.title}</Link>
              </h1>
              <p>{featuredPost.subtitle || featuredPost.summary || featuredPost.excerpt}</p>
              <div className="category-meta-row">
                <span>{featuredPost.source || "Daily Signal Wire"}</span>
                <time
                  dateTime={(featuredPost.publishedAt || featuredPost.createdAt).toISOString()}
                  suppressHydrationWarning
                >
                  {timeAgo(featuredPost.publishedAt || featuredPost.createdAt)}
                </time>
                <span>
                  {estimateReadingTime(
                    `${featuredPost.title} ${featuredPost.excerpt} ${featuredPost.summary || ""}`
                  )}{" "}
                  min read
                </span>
              </div>
              <Link className="category-read-link" href={`/news/${featuredPost.slug}`}>
                Read the full story <span>→</span>
              </Link>
            </div>
            <Link className="category-hero-image-link" href={`/news/${featuredPost.slug}`}>
              <ArticleImage
                post={featuredPost}
                className="category-hero-image"
                priority
                sizes="(max-width: 900px) 100vw, 58vw"
              />
            </Link>
          </section>
        ) : (
          <section className="category-empty-hero">
            <p className="category-kicker">{categoryTitle}</p>
            <h1>{categoryTitle} News</h1>
            <p>{categoryDescription}</p>
            <Link className="category-read-link" href="/admin/trends">
              Open newsroom trends <span>→</span>
            </Link>
          </section>
        )}

        <section className="category-discover-panel">
          <div>
            <p className="category-kicker">Discover-ready desk</p>
            <h2>{categoryTitle} signals, source context and fresh editor-reviewed coverage.</h2>
          </div>
          <CategorySearchBox
            action={categoryPath}
            defaultQuery={searchQuery}
            suggestions={searchSuggestions}
            topics={topics}
          />
        </section>

        <div className="category-layout">
          <div className="category-main-column">
            <section className="category-section">
              <div className="category-section-heading">
                <div>
                  <p className="category-kicker">Latest stories</p>
                  <h2>{searchQuery ? `Search results for “${searchQuery}”` : `Latest in ${categoryTitle}`}</h2>
                </div>
                <span>{visiblePosts.length} stories</span>
              </div>
              {latestPosts.length ? (
                <div className="category-latest-grid">
                  {latestPosts.map((post) => (
                    <ArticleCard key={post.id} post={post} />
                  ))}
                </div>
              ) : (
                <div className="category-empty-card">
                  <h3>No matching published stories yet.</h3>
                  <p>
                    Editors can publish sourced drafts into this category from the admin
                    dashboard. The page will fill automatically.
                  </p>
                </div>
              )}
            </section>

            <AdSlot position="feed" className="category-ad category-ad-between" />

            <section className="category-section">
              <div className="category-section-heading">
                <div>
                  <p className="category-kicker">Editor’s picks</p>
                  <h2>Premium reads selected by the desk</h2>
                </div>
              </div>
              {editorPicks.length ? (
                <div className="category-editor-grid">
                  {editorPicks.map((post) => (
                    <Link key={post.id} href={`/news/${post.slug}`}>
                      <ArticleImage
                        post={post}
                        sizes="(max-width: 800px) 100vw, 30vw"
                      />
                      <span>{post.category}</span>
                      <strong>{post.title}</strong>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="category-empty-card">More editor picks will appear here after publication.</div>
              )}
            </section>

            {liveStories.length > 0 && (
              <section className="category-section category-live-section">
                <div className="category-section-heading">
                  <div>
                    <p className="category-kicker">Live updates</p>
                    <h2>Source signals moving now</h2>
                  </div>
                  <Link href="/admin/stories">RSS reader</Link>
                </div>
                <ol>
                  {liveStories.map((story) => (
                    <li key={story.id}>
                      <time
                        dateTime={(story.publishedAt || story.fetchedAt).toISOString()}
                        suppressHydrationWarning
                      >
                        {timeAgo(story.publishedAt || story.fetchedAt)}
                      </time>
                      <div>
                        <span>{story.feed.title}</span>
                        <Link href={story.sourceUrl}>{story.title}</Link>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>

          <aside className="category-sidebar">
            <section className="category-side-panel category-trending-panel">
              <p className="category-kicker">Trending inside {categoryTitle}</p>
              {trendingPosts.length ? (
                <ol>
                  {trendingPosts.map((post, index) => (
                    <li key={post.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <Link href={`/news/${post.slug}`}>{post.title}</Link>
                        <small>
                          {estimateReadingTime(post.excerpt)} min read · Public count unavailable
                        </small>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="category-muted">No ranked stories yet.</p>
              )}
            </section>

            <AdSlot position="sidebar" className="category-ad category-ad-sidebar" />

            <section className="category-side-panel">
              <p className="category-kicker">Popular topics</p>
              <div className="category-topic-cloud">
                {topics.map((topic) => (
                  <Link key={topic} href={`${categoryPath}?q=${encodeURIComponent(topic)}`}>
                    {topic}
                  </Link>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {visiblePosts.length > 12 && (
          <InfinitePostFeed
            initialPosts={visiblePosts.slice(12, 24).map(serializePost)}
            endpointQuery={infiniteQuery}
            kicker="Infinite briefing"
            title={`More ${categoryTitle} coverage`}
            className="category-infinite-feed"
          />
        )}

        <section className="category-related-section">
          <div>
            <p className="category-kicker">Related categories</p>
            <div className="category-related-grid">
              {relatedCategories.map((category) => (
                <Link key={category.slug} href={`/category/${category.slug}`}>
                  <span>{category.name}</span>
                  <strong>{category.description}</strong>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="category-kicker">Related searches</p>
            <div className="category-topic-cloud">
              {topics.slice(0, 8).map((topic) => (
                <Link key={topic} href={`${categoryPath}?q=${encodeURIComponent(topic)}`}>
                  {categoryTitle} {topic}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <AdSlot position="bottom" className="category-ad category-ad-bottom" />
      </main>
    </ReaderShell>
  );
}
