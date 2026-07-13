import Link from "next/link";
import { AnalyzePostButton } from "@/components/AdminGrowthActions";
import { scoreDiscover } from "@/lib/growth";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function scoreClass(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

export default async function AdminDiscoverPage() {
  const data = await safeDbQuery(
    "admin_discover_query_failed",
    {
      posts: [] as {
        id: string;
        title: string;
        slug: string;
        status: string;
        excerpt: string;
        content: string;
        seoTitle: string;
        seoDescription: string;
        openGraphDescription: string | null;
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
        discoverAudits: {
          id: string;
          score: number;
          freshnessScore: number;
          entityScore: number;
          imageScore: number;
          largePreviewReady: boolean;
          headlineVariations: string;
          suggestions: string;
          analyzedAt: Date;
        }[];
      }[]
    },
    async () => {
      const posts = await prisma.post.findMany({
        include: {
          category: { select: { name: true, slug: true } },
          discoverAudits: {
            orderBy: { analyzedAt: "desc" },
            take: 1,
            select: {
              id: true,
              score: true,
              freshnessScore: true,
              entityScore: true,
              imageScore: true,
              largePreviewReady: true,
              headlineVariations: true,
              suggestions: true,
              analyzedAt: true
            }
          }
        },
        orderBy: { updatedAt: "desc" },
        take: 80
      });
      return { posts };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Google Discover Optimizer</p>
          <h1>Discover Readiness</h1>
          <p>
            Score freshness, entity clarity, large-preview image readiness and
            headline strength for mobile Discover-style discovery surfaces.
          </p>
        </div>
        <div className="header-badge">max-image-preview:large ready</div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Discover queue</p>
              <h2>Article readiness</h2>
            </div>
            <Link href="/admin/image-studio" className="source-pill">
              Image Studio →
            </Link>
          </div>
          {data.posts.length === 0 ? (
            <div className="empty-state">
              <h3>No posts available</h3>
              <p>Generate or import articles before Discover analysis.</p>
            </div>
          ) : (
            <div className="growth-table discover-table">
              <div className="growth-table-head discover">
                <span>Article</span>
                <span>Score</span>
                <span>Signals</span>
                <span>Action</span>
              </div>
              {data.posts.map((post) => {
                const computed = scoreDiscover(post);
                const audit = post.discoverAudits[0];
                const score = audit?.score ?? computed.score;
                const variations = audit
                  ? parseJsonArray<string>(audit.headlineVariations)
                  : computed.headlineVariations;
                const suggestions = audit
                  ? parseJsonArray<string>(audit.suggestions)
                  : computed.suggestions;
                return (
                  <article className="growth-table-row discover" key={post.id}>
                    <div>
                      <strong>{post.title}</strong>
                      <small>
                        {post.category?.name || "Latest"} · {post.status} · /news/{post.slug}
                      </small>
                      <div className="growth-suggestion-list compact">
                        {variations.slice(0, 2).map((variation) => (
                          <small key={variation}>Headline test: {variation}</small>
                        ))}
                      </div>
                    </div>
                    <span className={`growth-score ${scoreClass(score)}`}>{score}</span>
                    <div className="growth-signal-grid">
                      <span>Fresh {audit?.freshnessScore ?? computed.freshnessScore}</span>
                      <span>Entity {audit?.entityScore ?? computed.entityScore}</span>
                      <span>Image {audit?.imageScore ?? computed.imageScore}</span>
                      <span>
                        {audit?.largePreviewReady ?? computed.largePreviewReady
                          ? "Large image ready"
                          : "Needs large image"}
                      </span>
                      {suggestions.slice(0, 2).map((suggestion) => (
                        <small key={suggestion}>{suggestion}</small>
                      ))}
                    </div>
                    <AnalyzePostButton
                      endpoint="/api/admin/growth/discover/analyze"
                      postId={post.id}
                      label="Run Discover Audit"
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
