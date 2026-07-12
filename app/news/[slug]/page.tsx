import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/ads/AdSlot";
import ArticleBody, { extractArticleHeadings } from "@/components/ArticleBody";
import ArticleCard, { type ReaderPost } from "@/components/ArticleCard";
import ArticleComments from "@/components/ArticleComments";
import ArticleImageFrame from "@/components/ArticleImageFrame";
import ArticleRecommendations from "@/components/ArticleRecommendations";
import ArticleShareTools from "@/components/ArticleShareTools";
import ArticleToc from "@/components/ArticleToc";
import ReadingProgressBar from "@/components/ReadingProgressBar";
import ReaderShell from "@/components/ReaderShell";
import { isAdmin } from "@/lib/auth";
import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl, siteName } from "@/lib/site";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

type ArticleJsonLd = {
  "@context": string;
  "@graph": Array<Record<string, unknown>>;
};

type SerializedReaderPost = Omit<ReaderPost, "publishedAt" | "createdAt"> & {
  publishedAt: string | null;
  createdAt: string;
};

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function formatDateOnly(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function readingTime(content: string) {
  return Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 220));
}

function toReaderPost(
  item: {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    imageAlt: string | null;
    featuredImageUrl: string | null;
    featuredImage: string | null;
    imageUrl: string | null;
    thumbnailImage: string | null;
    publishedAt: Date | null;
    createdAt: Date;
    category?: { name: string } | null;
    trend?: { category: string | null } | null;
    sourceStory?: { feed?: { title: string } | null } | null;
  }
): ReaderPost {
  const category = item.category?.name || item.trend?.category || "Latest";
  return {
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: normalizeEditorialImageUrl(
      item.featuredImageUrl ||
        item.featuredImage ||
        item.imageUrl ||
        item.thumbnailImage ||
        placeholderImageForCategory(category),
      category
    ),
    imageAlt: item.imageAlt || item.title,
    category,
    source: item.sourceStory?.feed?.title || siteName,
    publishedAt: item.publishedAt,
    createdAt: item.createdAt
  };
}

function serializeReaderPost(post: ReaderPost): SerializedReaderPost {
  return {
    ...post,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString()
  };
}

function uniquePosts(posts: ReaderPost[], excludeSlug: string) {
  const seen = new Set<string>();
  return posts.filter((post) => {
    if (post.slug === excludeSlug || seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await safeDbQuery("article_metadata_query_failed", null, () =>
    prisma.post.findUnique({
      where: { slug },
      select: {
        title: true,
        subtitle: true,
        status: true,
        seoTitle: true,
        seoDescription: true,
        openGraphDescription: true,
        tags: true,
        publishedAt: true,
        updatedAt: true,
        imageAlt: true,
        imageUrl: true,
        featuredImageUrl: true,
        featuredImage: true,
        openGraphImage: true,
        twitterImage: true,
        category: { select: { name: true } },
        trend: { select: { category: true } }
      }
    })
  );

  if (!post) return {};
  if (post.status !== "published") {
    return {
      title: post.seoTitle || post.title,
      description: post.seoDescription,
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const category = post.category?.name || post.trend?.category || "Latest";
  const tags = parseStringArray(post.tags);
  const description = post.openGraphDescription || post.seoDescription;
  const ogImage = normalizeEditorialImageUrl(
    post.openGraphImage || post.featuredImageUrl || post.featuredImage || post.imageUrl,
    category
  );
  const twitterImage = normalizeEditorialImageUrl(
    post.twitterImage || post.openGraphImage || post.featuredImageUrl || post.imageUrl,
    category
  );
  const canonical = absoluteUrl(`/news/${slug}`);

  return {
    title: post.seoTitle || post.title,
    description,
    keywords: tags.length ? tags : [category, siteName, "news", "AI newsroom"],
    authors: [{ name: "Daily Signal Wire Desk", url: absoluteUrl("/about") }],
    alternates: {
      canonical
    },
    openGraph: {
      title: post.seoTitle || post.title,
      description,
      url: canonical,
      siteName,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      authors: [siteName],
      section: category,
      tags,
      images: ogImage
        ? [
            {
              url: absoluteUrl(ogImage),
              width: 1600,
              height: 900,
              alt: post.imageAlt || post.title
            }
          ]
        : []
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle || post.title,
      description,
      images: twitterImage ? [absoluteUrl(twitterImage)] : []
    }
  };
}

export default async function NewsArticlePage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const post = await safeDbQuery("article_query_failed", null, () =>
    prisma.post.findUnique({
      where: { slug },
      include: {
        trend: { select: { category: true } },
        category: { select: { name: true } },
        sourceStory: { include: { feed: { select: { title: true } } } }
      }
    })
  );

  if (!post) notFound();

  const previewAllowed = post.status !== "published" && preview === "1" && (await isAdmin());
  if (post.status !== "published" && !previewAllowed) notFound();

  const categoryLabel = post.category?.name || post.trend?.category || "Latest";
  const sourceLabel = post.sourceStory?.feed?.title || siteName;
  const coverImage = normalizeEditorialImageUrl(
    post.featuredImageUrl ||
      post.featuredImage ||
      post.imageUrl ||
      post.thumbnailImage ||
      placeholderImageForCategory(categoryLabel),
    categoryLabel
  );
  const storedTags = parseStringArray(post.tags);
  const tags = storedTags.length
    ? storedTags
    : [categoryLabel, sourceLabel, siteName, "Source Review", "AI Newsroom"].filter(
        (item, index, list) => item && list.indexOf(item) === index
      );
  const storedFaq = parseJsonArray<{ question: string; answer: string }>(post.faq);
  const faq = storedFaq.length
    ? storedFaq
    : [
        {
          question: `What is this ${categoryLabel.toLowerCase()} story about?`,
          answer:
            post.summary ||
            post.excerpt ||
            `This Daily Signal Wire story covers ${post.title}.`
        },
        {
          question: "Why does it matter?",
          answer:
            "The story is part of Daily Signal Wire's source-first coverage, which highlights what happened, why it matters, relevant background and what may come next."
        },
        {
          question: "How was this article prepared?",
          answer:
            "Daily Signal Wire uses source review, editorial checks and human approval before publication. AI-assisted drafts are not published automatically."
        }
      ];
  const sourceUrls = parseStringArray(post.sourceUrls);
  const factCheckNotes = parseStringArray(post.factCheckNotes);
  const headings = extractArticleHeadings(post.content);
  const minutes = readingTime(post.content);
  const articleUrl = absoluteUrl(`/news/${post.slug}`);
  const categoryUrl = absoluteUrl(`/category/${slugify(categoryLabel)}`);
  const publishedDisplay = formatDateTime(post.publishedAt || post.createdAt);
  const updatedDisplay = formatDateTime(post.updatedAt);
  const publishedDateOnly = formatDateOnly(post.publishedAt || post.createdAt);
  const authorName = "Daily Signal Wire Desk";
  const editorName = "Daily Signal Wire Editorial Desk";
  const imageDisclosure =
    post.imageDisclosure ||
    (post.imageSourceType === "ai" ? "AI-generated editorial illustration" : null);
  const wordCount = post.content.split(/\s+/).filter(Boolean).length;

  const relatedCategoryFilters = [
    ...(post.category?.name ? [{ category: { name: post.category.name } }] : []),
    ...(post.trend?.category ? [{ trend: { category: post.trend.category } }] : [])
  ];
  const tagFilters = tags.slice(0, 4).map((tag) => ({ tags: { contains: tag } }));
  const publishedAt = post.publishedAt;
  const [relatedByCategory, relatedByTags, latestTrending, editorPicks, previousPost, nextPost] =
    await Promise.all([
      safeDbQuery("article_related_category_query_failed", [], () =>
        prisma.post.findMany({
          where: {
            status: "published",
            id: { not: post.id },
            ...(relatedCategoryFilters.length ? { OR: relatedCategoryFilters } : {})
          },
          include: {
            trend: { select: { category: true } },
            category: { select: { name: true } },
            sourceStory: { include: { feed: { select: { title: true } } } }
          },
          orderBy: { publishedAt: "desc" },
          take: 4
        })
      ),
      safeDbQuery("article_related_tags_query_failed", [], () =>
        prisma.post.findMany({
          where: {
            status: "published",
            id: { not: post.id },
            ...(tagFilters.length ? { OR: tagFilters } : {})
          },
          include: {
            trend: { select: { category: true } },
            category: { select: { name: true } },
            sourceStory: { include: { feed: { select: { title: true } } } }
          },
          orderBy: { updatedAt: "desc" },
          take: 4
        })
      ),
      safeDbQuery("article_trending_query_failed", [], () =>
        prisma.post.findMany({
          where: {
            status: "published",
            id: { not: post.id }
          },
          include: {
            trend: { select: { category: true } },
            category: { select: { name: true } },
            sourceStory: { include: { feed: { select: { title: true } } } }
          },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          take: 5
        })
      ),
      safeDbQuery("article_editor_picks_query_failed", [], () =>
        prisma.post.findMany({
          where: {
            status: "published",
            id: { not: post.id },
            aiGenerated: true
          },
          include: {
            trend: { select: { category: true } },
            category: { select: { name: true } },
            sourceStory: { include: { feed: { select: { title: true } } } }
          },
          orderBy: { updatedAt: "desc" },
          take: 4
        })
      ),
      publishedAt
        ? safeDbQuery("article_previous_query_failed", null, () =>
            prisma.post.findFirst({
              where: {
                status: "published",
                publishedAt: { lt: publishedAt },
                id: { not: post.id }
              },
              select: { slug: true, title: true },
              orderBy: { publishedAt: "desc" }
            })
          )
        : Promise.resolve(null),
      publishedAt
        ? safeDbQuery("article_next_query_failed", null, () =>
            prisma.post.findFirst({
              where: {
                status: "published",
                publishedAt: { gt: publishedAt },
                id: { not: post.id }
              },
              select: { slug: true, title: true },
              orderBy: { publishedAt: "asc" }
            })
          )
        : Promise.resolve(null)
    ]);

  const categoryPosts = relatedByCategory.map(toReaderPost);
  const tagPosts = uniquePosts(relatedByTags.map(toReaderPost), post.slug);
  const trendingPosts = uniquePosts(latestTrending.map(toReaderPost), post.slug);
  const editorPickPosts = uniquePosts(editorPicks.map(toReaderPost), post.slug);
  const recommendationPosts = uniquePosts(
    [...categoryPosts, ...tagPosts, ...trendingPosts, ...editorPickPosts],
    post.slug
  ).slice(0, 9);

  const structuredData: ArticleJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["NewsArticle", "Article"],
        headline: post.title,
        alternativeHeadline: post.subtitle || undefined,
        description: post.openGraphDescription || post.summary || post.excerpt,
        datePublished: (post.publishedAt || post.createdAt).toISOString(),
        dateModified: post.updatedAt.toISOString(),
        mainEntityOfPage: articleUrl,
        url: articleUrl,
        image: coverImage ? [absoluteUrl(coverImage)] : undefined,
        thumbnailUrl: coverImage ? absoluteUrl(coverImage) : undefined,
        author: {
          "@type": "Organization",
          name: authorName,
          url: absoluteUrl("/about")
        },
        editor: {
          "@type": "Organization",
          name: editorName,
          url: absoluteUrl("/editorial-policy")
        },
        publisher: {
          "@type": "Organization",
          name: siteName,
          url: absoluteUrl("/"),
          logo: {
            "@type": "ImageObject",
            url: absoluteUrl("/icon.svg")
          }
        },
        articleSection: categoryLabel,
        keywords: tags.length ? tags.join(", ") : undefined,
        citation: sourceUrls.length ? sourceUrls : undefined,
        wordCount,
        timeRequired: `PT${minutes}M`,
        isAccessibleForFree: true
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/")
          },
          {
            "@type": "ListItem",
            position: 2,
            name: categoryLabel,
            item: categoryUrl
          },
          {
            "@type": "ListItem",
            position: 3,
            name: post.title,
            item: articleUrl
          }
        ]
      }
    ]
  };

  if (faq.length) {
    structuredData["@graph"].push({
      "@type": "FAQPage",
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    });
  }

  return (
    <ReaderShell>
      <ReadingProgressBar />
      <ArticleShareTools title={post.title} slug={post.slug} variant="floating" />
      {previewAllowed && (
        <div className="preview-ribbon">Draft preview · This article is not public</div>
      )}

      <main className="article-page premium-article-page">
        <nav className="article-breadcrumb premium-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href={`/category/${slugify(categoryLabel)}`}>{categoryLabel}</Link>
          <span>/</span>
          <span aria-current="page">{post.title}</span>
        </nav>

        <div className="premium-article-grid">
          <aside className="premium-share-column" aria-label="Article sharing">
            <ArticleShareTools title={post.title} slug={post.slug} variant="rail" />
          </aside>

          <article className="reader-article premium-article">
            <header className="premium-article-hero">
              <div className="article-hero-copy">
                <div className="article-kicker-row">
                  <Link className="article-category" href={`/category/${slugify(categoryLabel)}`}>
                    {categoryLabel}
                  </Link>
                  <span>{sourceLabel}</span>
                </div>
                <h1>{post.title}</h1>
                {(post.subtitle || post.excerpt) && (
                  <p className="article-subheadline">{post.subtitle || post.excerpt}</p>
                )}
                {post.subtitle && post.excerpt && <p className="article-deck">{post.excerpt}</p>}

                <div className="article-meta-grid" aria-label="Article metadata">
                  <div className="article-meta-item">
                    <span>Author</span>
                    <strong>{authorName}</strong>
                  </div>
                  <div className="article-meta-item">
                    <span>Editor</span>
                    <strong>{editorName}</strong>
                  </div>
                  <div className="article-meta-item">
                    <span>Published</span>
                    <time dateTime={(post.publishedAt || post.createdAt).toISOString()}>
                      {publishedDisplay}
                    </time>
                  </div>
                  <div className="article-meta-item">
                    <span>Updated</span>
                    <time dateTime={post.updatedAt.toISOString()}>{updatedDisplay}</time>
                  </div>
                  <div className="article-meta-item">
                    <span>Reading time</span>
                    <strong>{minutes} min read</strong>
                  </div>
                  <div className="article-meta-item">
                    <span>Views</span>
                    <strong>Public count unavailable</strong>
                  </div>
                  <div className="article-meta-item">
                    <span>Fact checked</span>
                    <strong>{factCheckNotes.length || sourceUrls.length ? "Source review" : "Editorial review"}</strong>
                  </div>
                  <div className="article-meta-item">
                    <span>Source</span>
                    <strong>{sourceLabel}</strong>
                  </div>
                </div>

                <ArticleShareTools title={post.title} slug={post.slug} />
              </div>

              <ArticleImageFrame
                src={coverImage}
                alt={post.imageAlt || post.title}
                caption={post.imageCaption}
                credit={post.imageCredit}
                license={post.imageLicense}
                disclosure={imageDisclosure}
                priority
              />
            </header>

            <AdSlot position="top" className="article-top-ad" />

            {(sourceUrls.length > 0 || factCheckNotes.length > 0 || post.aiGenerated) && (
              <section className="article-source-panel" aria-label="Source and fact-check notes">
                <div>
                  <p className="section-kicker">Verification notes</p>
                  <h2>Source-first editorial review</h2>
                  <p>
                    This article was prepared for publication with source review and editorial
                    approval. AI-assisted drafts are never published automatically.
                  </p>
                </div>
                <div className="article-source-panel-grid">
                  {sourceUrls.length > 0 && (
                    <div>
                      <h3>Source URLs</h3>
                      <ul>
                        {sourceUrls.slice(0, 5).map((sourceUrl) => (
                          <li key={sourceUrl}>
                            <a href={sourceUrl} target="_blank" rel="noreferrer">
                              {sourceUrl}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {factCheckNotes.length > 0 && (
                    <div>
                      <h3>Fact-check notes</h3>
                      <ul>
                        {factCheckNotes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            <ArticleBody content={post.content} />

            {faq.length > 0 && (
              <section className="article-faq premium-article-card">
                <div className="article-section-heading">
                  <p className="section-kicker">FAQ</p>
                  <h2>Reader questions</h2>
                </div>
                {faq.map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
              </section>
            )}

            {tags.length > 0 && (
              <div className="article-tags" aria-label="Article tags">
                {tags.map((tag) => (
                  <Link key={tag} href={`/tag/${slugify(tag)}`}>
                    {tag}
                  </Link>
                ))}
              </div>
            )}

            <ArticleComments />

            <section className="article-newsletter-card" aria-labelledby="article-newsletter-heading">
              <p className="section-kicker">Daily briefing</p>
              <h2 id="article-newsletter-heading">Get the newsroom brief before the noise</h2>
              <p>
                Source-first updates, trend context and editor-reviewed AI newsroom drafts — sent
                when there is something worth reading.
              </p>
              <form action="/api/newsletter" method="post">
                <label htmlFor="article-newsletter-email">Email address</label>
                <div>
                  <input id="article-newsletter-email" name="email" type="email" placeholder="you@example.com" required />
                  <button type="submit">Subscribe</button>
                </div>
              </form>
            </section>

            <AdSlot position="bottom" />

            {(previousPost || nextPost) && (
              <nav className="article-prev-next" aria-label="Previous and next stories">
                {previousPost ? (
                  <Link href={`/news/${previousPost.slug}`}>
                    <span>Previous</span>
                    <strong>{previousPost.title}</strong>
                  </Link>
                ) : (
                  <span />
                )}
                {nextPost ? (
                  <Link href={`/news/${nextPost.slug}`}>
                    <span>Next</span>
                    <strong>{nextPost.title}</strong>
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}

            <section className="article-related-section" aria-labelledby="related-category-heading">
              <div className="article-section-heading">
                <p className="section-kicker">More context</p>
                <h2 id="related-category-heading">Related reporting</h2>
              </div>
              {categoryPosts.length ? (
                <div className="article-related-grid">
                  {categoryPosts.map((item) => (
                    <ArticleCard key={item.id} post={item} />
                  ))}
                </div>
              ) : (
                <p className="related-empty">More reporting in this topic will appear here.</p>
              )}
            </section>

            <ArticleRecommendations
              initialPosts={recommendationPosts.map(serializeReaderPost)}
              excludeSlug={post.slug}
            />

            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
          </article>

          <aside className="article-sidebar premium-article-sidebar">
            <ArticleToc headings={headings} />

            <section className="author-card premium-author-card">
              <div className="author-card-avatar">DS</div>
              <div>
                <p className="section-kicker">Author</p>
                <h2>{authorName}</h2>
                <p>
                  Source-first newsroom coverage prepared with editorial review, factual checks
                  and transparent AI-assisted workflow controls.
                </p>
                <Link href="/editorial-policy">Editorial policy</Link>
              </div>
            </section>

            <section className="article-metadata-card premium-article-card">
              <p className="section-kicker">Story file</p>
              <dl>
                <div>
                  <dt>Published</dt>
                  <dd>{publishedDateOnly}</dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>
                    <Link href={`/category/${slugify(categoryLabel)}`}>{categoryLabel}</Link>
                  </dd>
                </div>
                <div>
                  <dt>Reading time</dt>
                  <dd>{minutes} minutes</dd>
                </div>
                <div>
                  <dt>Image</dt>
                  <dd>{imageDisclosure || post.imageSourceType || "Editorial image"}</dd>
                </div>
              </dl>
            </section>

            <AdSlot position="sidebar" />

            {trendingPosts.length > 0 && (
              <section className="related-panel">
                <p className="section-kicker">Trending</p>
                <h2>Latest updates</h2>
                <div className="related-list">
                  {trendingPosts.slice(0, 4).map((item) => (
                    <ArticleCard key={item.id} post={item} variant="compact" />
                  ))}
                </div>
              </section>
            )}

            {editorPickPosts.length > 0 && (
              <section className="related-panel">
                <p className="section-kicker">Editors</p>
                <h2>Editor&apos;s picks</h2>
                <div className="related-list">
                  {editorPickPosts.slice(0, 4).map((item) => (
                    <ArticleCard key={item.id} post={item} variant="compact" />
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </ReaderShell>
  );
}
