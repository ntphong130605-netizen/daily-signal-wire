import type { Metadata } from "next";
import ArticleCard, { type ReaderPost } from "@/components/ArticleCard";
import ReaderShell from "@/components/ReaderShell";
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
  const title = titleFromSlug(slug) || "Category";
  const url = absoluteUrl(`/category/${slug}`);
  return {
    title,
    description: `Latest Daily Signal Wire stories in ${title}.`,
    alternates: {
      canonical: url
    },
    openGraph: {
      title: `${title} | ${siteName}`,
      description: `Latest Daily Signal Wire stories in ${title}.`,
      url,
      type: "website"
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | ${siteName}`,
      description: `Latest Daily Signal Wire stories in ${title}.`
    }
  };
}

export default async function CategoryPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categoryTitle = titleFromSlug(slug) || "Category";
  const posts = await safeDbQuery(
    "category_posts_query_failed",
    [],
    () =>
      prisma.post.findMany({
        where: { status: "published" },
        include: {
          category: { select: { name: true, slug: true } },
          trend: { select: { category: true } }
        },
        orderBy: { publishedAt: "desc" },
        take: 80
      })
  );

  const categoryPosts: ReaderPost[] = posts
    .filter((post) => {
      const categoryName = post.category?.name || post.trend?.category || "Latest";
      const categorySlug = post.category?.slug || slugify(categoryName);
      return categorySlug === slug;
    })
    .map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      imageUrl: post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage,
      imageAlt: post.imageAlt || "",
      category: post.category?.name || post.trend?.category || categoryTitle,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt
    }));

  return (
    <ReaderShell>
      <main className="category-page-shell">
        <section className="category-page-hero">
          <p className="section-kicker">Category</p>
          <h1>{categoryTitle}</h1>
          <p>
            Source-first stories, RSS signals and editor-reviewed AI drafts in this
            topic.
          </p>
        </section>

        {categoryPosts.length ? (
          <section className="category-grid">
            {categoryPosts.map((post) => (
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
            <h2>No published stories in {categoryTitle} yet.</h2>
            <p>
              This route is ready. Stories will appear here after an editor
              publishes matching drafts.
            </p>
          </section>
        )}
      </main>
    </ReaderShell>
  );
}
