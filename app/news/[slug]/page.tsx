import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/ads/AdSlot";
import ArticleBody from "@/components/ArticleBody";
import ArticleCard, { type ReaderPost } from "@/components/ArticleCard";
import ReaderShell from "@/components/ReaderShell";
import ShareButtons from "@/components/ShareButtons";
import { placeholderImageForCategory } from "@/lib/aiImage";
import { isAdmin } from "@/lib/auth";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { absoluteUrl, siteName } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await safeDbQuery(
    "article_metadata_query_failed",
    null,
    () =>
      prisma.post.findUnique({
        where: { slug },
        select: {
          status: true,
          seoTitle: true,
          seoDescription: true,
          openGraphDescription: true,
          imageUrl: true,
          featuredImageUrl: true,
          featuredImage: true,
          openGraphImage: true,
          twitterImage: true
        }
      })
  );
  if (!post) return {};
  if (post.status !== "published") {
    return {
      robots: {
        index: false,
        follow: false
      }
    };
  }
  const ogImage =
    post.openGraphImage || post.featuredImageUrl || post.featuredImage || post.imageUrl;
  const twitterImage =
    post.twitterImage || post.openGraphImage || post.featuredImageUrl || post.imageUrl;
  const canonical = absoluteUrl(`/news/${slug}`);
  return {
    title: post.seoTitle,
    description: post.openGraphDescription || post.seoDescription,
    alternates: {
      canonical
    },
    openGraph: {
      title: post.seoTitle,
      description: post.openGraphDescription || post.seoDescription,
      url: canonical,
      siteName,
      type: "article",
      images: ogImage ? [absoluteUrl(ogImage)] : []
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle,
      description: post.openGraphDescription || post.seoDescription,
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
  const post = await safeDbQuery(
    "article_query_failed",
    null,
    () =>
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

  const previewAllowed =
    post.status !== "published" && preview === "1" && (await isAdmin());
  if (post.status !== "published" && !previewAllowed) notFound();

  const relatedCategoryFilters = [
    ...(post.category?.name ? [{ category: { name: post.category.name } }] : []),
    ...(post.trend?.category ? [{ trend: { category: post.trend.category } }] : [])
  ];
  const publishedAt = post.publishedAt;
  const [related, previousPost, nextPost] = await Promise.all([
    safeDbQuery(
    "article_related_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: {
          status: "published",
          id: { not: post.id },
          ...(relatedCategoryFilters.length ? { OR: relatedCategoryFilters } : {})
        },
        include: {
          trend: { select: { category: true } },
          category: { select: { name: true } }
        },
        orderBy: { publishedAt: "desc" },
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
  const relatedPosts: ReaderPost[] = related.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl:
      item.featuredImageUrl ||
      item.featuredImage ||
      item.imageUrl ||
      item.thumbnailImage ||
      placeholderImageForCategory(item.category?.name || item.trend?.category || "Latest"),
    imageAlt: item.imageAlt || "",
    category: item.category?.name || item.trend?.category || "Latest",
    publishedAt: item.publishedAt,
    createdAt: item.createdAt
  }));
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(post.publishedAt || post.updatedAt);
  const categoryLabel = post.category?.name || post.trend?.category || "Latest";
  const coverImage =
    post.featuredImageUrl ||
    post.featuredImage ||
    post.imageUrl ||
    post.thumbnailImage ||
    placeholderImageForCategory(categoryLabel);
  const tags = parseStringArray(post.tags);
  const faq = parseJsonArray<{ question: string; answer: string }>(post.faq);
  const headings = [...post.content.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1]);
  const readingMinutes = Math.max(
    1,
    Math.ceil(post.content.split(/\s+/).filter(Boolean).length / 220)
  );
  const sourceLabel = post.sourceStory?.feed?.title || "Daily Signal Wire";
  const articleUrl = absoluteUrl(`/news/${post.slug}`);
  const categoryUrl = absoluteUrl(`/category/${slugify(categoryLabel)}`);
  const structuredData: {
    "@context": string;
    "@graph": Array<Record<string, unknown>>;
  } = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["NewsArticle", "Article"],
        headline: post.title,
        alternativeHeadline: post.subtitle || undefined,
        description: post.openGraphDescription || post.excerpt,
        datePublished: (post.publishedAt || post.createdAt).toISOString(),
        dateModified: post.updatedAt.toISOString(),
        mainEntityOfPage: articleUrl,
        url: articleUrl,
        image: coverImage ? [absoluteUrl(coverImage)] : undefined,
        author: {
          "@type": "Organization",
          name: siteName,
          url: absoluteUrl("/")
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
      {previewAllowed && (
        <div className="preview-ribbon">
          Draft preview · This article is not public
        </div>
      )}
      <main className="article-page">
        <div className="article-page-grid">
          <article className="reader-article">
            <div className="article-breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <Link href={`/category/${slugify(categoryLabel)}`}>{categoryLabel}</Link>
            </div>
            <header className="article-title-block">
              <span className="article-category">{categoryLabel}</span>
              <h1>{post.title}</h1>
              {post.subtitle && <p className="article-subtitle">{post.subtitle}</p>}
              <p>{post.excerpt}</p>
              <div className="article-byline">
                <div className="author-avatar">DS</div>
                <div>
                  <strong>{sourceLabel}</strong>
                  <span>
                    By Daily Signal Wire · Published {date} · {readingMinutes} min read
                  </span>
                </div>
                <ShareButtons title={post.title} slug={post.slug} />
              </div>
            </header>

            <AdSlot position="top" className="article-top-ad" />

            <figure className="article-cover">
              {coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverImage} alt={post.imageAlt || post.title} />
              ) : (
                <div className="article-cover-fallback">
                  <svg viewBox="0 0 100 60" aria-hidden="true">
                    <path d="M7 32h16l8-19 13 37 11-29 8 16h30" />
                  </svg>
                  <span>Editorial coverage · Daily Signal Wire</span>
                </div>
              )}
              {(post.imageCaption ||
                post.imageDisclosure ||
                post.imageCredit ||
                post.imageLicense) && (
                <figcaption>
                  {post.imageCaption && (
                    <>
                      <span>{post.imageCaption}</span>
                      <br />
                    </>
                  )}
                  {post.imageDisclosure && (
                    <>
                      <span>{post.imageDisclosure}</span>
                      <br />
                    </>
                  )}
                  {post.imageCredit}
                  {post.imageCredit && post.imageLicense ? " · " : ""}
                  {post.imageLicense}
                </figcaption>
              )}
            </figure>

            <ArticleBody content={post.content} />
            {faq.length > 0 && (
              <section className="article-faq">
                <p className="section-kicker">FAQ</p>
                <h2>Reader questions</h2>
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
                  <Link key={tag} href={`/?q=${encodeURIComponent(tag)}`}>
                    {tag}
                  </Link>
                ))}
              </div>
            )}
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
            <AdSlot position="bottom" />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
            />
            <div className="article-end-note">
              <strong>Daily Signal Wire editorial standards</strong>
              <p>
                This report was reviewed by an editor. Corrections and clarifications
                are added transparently.
              </p>
            </div>
          </article>

          <aside className="article-sidebar">
            <div className="sticky-share-rail">
              <ShareButtons title={post.title} slug={post.slug} />
            </div>
            {headings.length > 0 && (
              <section className="article-toc">
                <p className="section-kicker">In this story</p>
                <h2>Table of contents</h2>
                {headings.map((heading) => (
                  <Link key={heading} href={`#${slugify(heading)}`}>
                    {heading}
                  </Link>
                ))}
              </section>
            )}
            <AdSlot position="sidebar" />
            <section className="related-panel">
              <p className="section-kicker">Keep reading</p>
              <h2>Related stories</h2>
              {relatedPosts.length ? (
                <div className="related-list">
                  {relatedPosts.map((item) => (
                    <ArticleCard key={item.id} post={item} variant="compact" />
                  ))}
                </div>
              ) : (
                <p className="related-empty">
                  More reporting in this topic will appear here.
                </p>
              )}
            </section>
          </aside>
        </div>
      </main>
    </ReaderShell>
  );
}
