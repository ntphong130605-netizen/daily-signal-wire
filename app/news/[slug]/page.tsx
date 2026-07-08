import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdSlot from "@/components/AdSlot";
import ArticleBody from "@/components/ArticleBody";
import ArticleCard, { type ReaderPost } from "@/components/ArticleCard";
import ReaderShell from "@/components/ReaderShell";
import ShareButtons from "@/components/ShareButtons";
import { isAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await prisma.post.findUnique({
    where: { slug },
    select: {
      status: true,
      seoTitle: true,
      seoDescription: true,
      imageUrl: true,
      featuredImage: true,
      openGraphImage: true,
      twitterImage: true
    }
  });
  if (!post || post.status !== "published") return {};
  const ogImage = post.openGraphImage || post.featuredImage || post.imageUrl;
  const twitterImage = post.twitterImage || post.openGraphImage || post.imageUrl;
  return {
    title: post.seoTitle,
    description: post.seoDescription,
    openGraph: {
      title: post.seoTitle,
      description: post.seoDescription,
      type: "article",
      images: ogImage ? [ogImage] : []
    },
    twitter: {
      card: "summary_large_image",
      title: post.seoTitle,
      description: post.seoDescription,
      images: twitterImage ? [twitterImage] : []
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
  const post = await prisma.post.findUnique({
    where: { slug },
    include: { trend: { select: { category: true } } }
  });
  if (!post) notFound();

  const previewAllowed =
    post.status !== "published" && preview === "1" && (await isAdmin());
  if (post.status !== "published" && !previewAllowed) notFound();

  const related = await prisma.post.findMany({
    where: {
      status: "published",
      id: { not: post.id },
      ...(post.trend?.category
        ? { trend: { category: post.trend.category } }
        : {})
    },
    include: { trend: { select: { category: true } } },
    orderBy: { publishedAt: "desc" },
    take: 4
  });
  const relatedPosts: ReaderPost[] = related.map((item) => ({
    id: item.id,
    slug: item.slug,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: item.imageUrl,
    category: item.trend?.category || "Latest",
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

  return (
    <ReaderShell>
      {previewAllowed && (
        <div className="preview-ribbon">
          Draft preview · This article is not public
        </div>
      )}
      <main className="article-page">
        <AdSlot position="top" />
        <div className="article-page-grid">
          <article className="reader-article">
            <div className="article-breadcrumb">
              <Link href="/">Home</Link>
              <span>/</span>
              <Link href={`/?topic=${encodeURIComponent(post.trend?.category || "Latest")}`}>
                {post.trend?.category || "Latest"}
              </Link>
            </div>
            <header className="article-title-block">
              <span className="article-category">
                {post.trend?.category || "Latest"}
              </span>
              <h1>{post.title}</h1>
              <p>{post.excerpt}</p>
              <div className="article-byline">
                <div className="author-avatar">DS</div>
                <div>
                  <strong>Daily Signal Wire</strong>
                  <span>Published {date}</span>
                </div>
                <ShareButtons title={post.title} slug={post.slug} />
              </div>
            </header>

            <figure className="article-cover">
              {post.featuredImage || post.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.featuredImage || post.imageUrl || ""} alt="" />
              ) : (
                <div className="article-cover-fallback">
                  <svg viewBox="0 0 100 60" aria-hidden="true">
                    <path d="M7 32h16l8-19 13 37 11-29 8 16h30" />
                  </svg>
                  <span>Editorial coverage · Daily Signal Wire</span>
                </div>
              )}
              {(post.imageCredit || post.imageLicense) && (
                <figcaption>
                  {post.imageModel && (
                    <>
                      <span>Illustration generated with AI.</span>
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
            <AdSlot position="bottom" />
            <div className="article-end-note">
              <strong>Daily Signal Wire editorial standards</strong>
              <p>
                This report was reviewed by an editor. Corrections and clarifications
                are added transparently.
              </p>
            </div>
          </article>

          <aside className="article-sidebar">
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
