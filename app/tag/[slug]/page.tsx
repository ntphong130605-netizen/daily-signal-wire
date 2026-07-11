import type { Metadata } from "next";
import ArticleCard, { type ReaderPost } from "@/components/ArticleCard";
import ReaderShell from "@/components/ReaderShell";
import { placeholderImageForCategory } from "@/lib/aiImage";
import { parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { absoluteUrl, siteName } from "@/lib/site";

export const dynamic = "force-dynamic";

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const title = titleFromSlug(slug) || "Tag";
  const url = absoluteUrl(`/tag/${slug}`);
  return {
    title: `${title} news`,
    description: `Daily Signal Wire stories tagged ${title}.`,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} news | ${siteName}`,
      description: `Daily Signal Wire stories tagged ${title}.`,
      url,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} news | ${siteName}`,
      description: `Daily Signal Wire stories tagged ${title}.`
    }
  };
}

export default async function TagPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tagTitle = titleFromSlug(slug) || "Tag";
  const posts = await safeDbQuery(
    "tag_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: { status: "published" },
        include: {
          category: { select: { name: true } },
          trend: { select: { category: true } }
        },
        orderBy: { publishedAt: "desc" },
        take: 200
      })
  );

  const tagPosts: ReaderPost[] = posts
    .filter((post) =>
      parseStringArray(post.tags).some((tag) => slugify(tag) === slug)
    )
    .map((post) => {
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
        publishedAt: post.publishedAt,
        createdAt: post.createdAt
      };
    });

  return (
    <ReaderShell>
      <main className="category-page-shell">
        <section className="category-page-hero">
          <p className="section-kicker">Tag</p>
          <h1>{tagTitle}</h1>
          <p>
            Related Daily Signal Wire coverage, source-first analysis and
            editor-reviewed AI newsroom stories.
          </p>
        </section>

        {tagPosts.length ? (
          <section className="category-grid">
            {tagPosts.map((post) => (
              <ArticleCard key={post.id} post={post} />
            ))}
          </section>
        ) : (
          <section className="reader-empty-state compact">
            <div className="empty-signal">
              <span />
              <span />
              <span />
            </div>
            <h2>No published stories tagged {tagTitle} yet.</h2>
            <p>New coverage will appear here after editors publish matching stories.</p>
          </section>
        )}
      </main>
    </ReaderShell>
  );
}
