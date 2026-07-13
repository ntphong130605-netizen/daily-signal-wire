import Link from "next/link";
import { AnalyzePostButton } from "@/components/AdminGrowthActions";
import { scoreSeo } from "@/lib/growth";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function scoreClass(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export default async function AdminSeoPage() {
  const data = await safeDbQuery(
    "admin_seo_query_failed",
    {
      posts: [] as {
        id: string;
        title: string;
        slug: string;
        status: string;
        seoTitle: string;
        seoDescription: string;
        content: string;
        excerpt: string;
        tags: string;
        faq: string;
        sourceUrls: string;
        internalLinkSuggestions: string;
        imageStatus: string;
        imageUrl: string | null;
        featuredImageUrl: string | null;
        featuredImage: string | null;
        thumbnailImage: string | null;
        openGraphImage: string | null;
        imageAlt: string | null;
        imageCaption: string | null;
        publishedAt: Date | null;
        updatedAt: Date;
        createdAt: Date;
        category: { name: string; slug: string } | null;
        seoAudits: { id: string; score: number; suggestions: string; analyzedAt: Date }[];
      }[],
      latestAudits: [] as { score: number }[]
    },
    async () => {
      const [posts, latestAudits] = await Promise.all([
        prisma.post.findMany({
          include: {
            category: { select: { name: true, slug: true } },
            seoAudits: {
              orderBy: { analyzedAt: "desc" },
              take: 1,
              select: { id: true, score: true, suggestions: true, analyzedAt: true }
            }
          },
          orderBy: { updatedAt: "desc" },
          take: 80
        }),
        prisma.seoAudit.findMany({
          orderBy: { analyzedAt: "desc" },
          select: { score: true },
          take: 50
        })
      ]);
      return { posts, latestAudits };
    }
  );
  const average =
    data.latestAudits.length > 0
      ? Math.round(
          data.latestAudits.reduce((sum, audit) => sum + audit.score, 0) /
            data.latestAudits.length
        )
      : null;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">SEO Intelligence</p>
          <h1>Article SEO Analyzer</h1>
          <p>
            Analyze headline quality, metadata, slug, links, schema inputs,
            keyword density, duplicate risk and image SEO before publishing.
          </p>
        </div>
        <div className="header-badge">
          Average {average === null ? "not analyzed" : `${average}/100`}
        </div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Optimization queue</p>
              <h2>Articles</h2>
            </div>
            <Link href="/admin/posts" className="source-pill">
              Posts →
            </Link>
          </div>
          {data.posts.length === 0 ? (
            <div className="empty-state">
              <h3>No articles to analyze</h3>
              <p>Create or import posts first. This page does not generate mock SEO data.</p>
            </div>
          ) : (
            <div className="growth-table seo-table">
              <div className="growth-table-head seo">
                <span>Article</span>
                <span>Score</span>
                <span>Issues</span>
                <span>Action</span>
              </div>
              {data.posts.map((post) => {
                const computed = scoreSeo(post);
                const audit = post.seoAudits[0];
                const score = audit?.score ?? computed.score;
                const suggestions = audit
                  ? parseJsonArray<string>(audit.suggestions)
                  : computed.suggestions;
                return (
                  <article className="growth-table-row seo" key={post.id}>
                    <div>
                      <strong>{post.title}</strong>
                      <small>
                        /news/{post.slug} · {post.status} ·{" "}
                        {post.category?.name || "Uncategorized"}
                      </small>
                    </div>
                    <span className={`growth-score ${scoreClass(score)}`}>{score}</span>
                    <div className="growth-suggestion-list">
                      {suggestions.length === 0 ? (
                        <small>Looks good from the current checks.</small>
                      ) : (
                        suggestions.slice(0, 3).map((suggestion) => (
                          <small key={suggestion}>{suggestion}</small>
                        ))
                      )}
                    </div>
                    <AnalyzePostButton
                      endpoint="/api/admin/growth/seo/analyze"
                      postId={post.id}
                      label="Run SEO Audit"
                    />
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
