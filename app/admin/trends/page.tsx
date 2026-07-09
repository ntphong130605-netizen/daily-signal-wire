import Link from "next/link";
import GenerateDraftButton from "@/components/GenerateDraftButton";
import RefreshTrendsButton from "@/components/RefreshTrendsButton";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { parseStringArray } from "@/lib/json";

export default async function AdminTrendsPage() {
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const trends = await safeDbQuery(
    "admin_trends_query_failed",
    [],
    () =>
      prisma.trend.findMany({
        include: { post: { select: { id: true, status: true, title: true } } },
        orderBy: { discoveredAt: "desc" },
        take: 200
      })
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Google Trends · United States</p>
          <h1>Trend queue</h1>
          <p>Use demand as an idea signal, then verify every reported claim.</p>
        </div>
        <div className="admin-header-actions">
          <RefreshTrendsButton />
          <div className="header-badge">{trends.length} signals</div>
        </div>
      </header>
      <main className="admin-content">
        {!aiConfigured && (
          <div className="api-config-banner">
            <strong>AI generation is paused</strong>
            <span>
              Add <code>OPENAI_API_KEY</code> to <code>.env</code>, then restart
              the dev server.
            </span>
          </div>
        )}
        <div className="warning-banner">
          <span>!</span>
          <div>
            <strong>Drafts never publish automatically</strong>
            <p>
              Generate, edit, fact-check and explicitly approve each story.
            </p>
          </div>
        </div>
        <section className="panel admin-trends-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Fresh signals</p>
              <h2>US trend keywords</h2>
            </div>
              <span className="source-pill">Manual refresh + protected cron</span>
          </div>
          {trends.length === 0 ? (
            <div className="empty-state">
              <h3>No trends imported</h3>
              <p>The next protected cron run will populate this queue.</p>
            </div>
          ) : (
            <div className="admin-trends-list">
              {trends.map((trend) => {
                const related = parseStringArray(trend.relatedQueries);
                return (
                  <article className="admin-trend-item" key={trend.id}>
                    <div className="trend-rank">↗</div>
                    <div className="admin-trend-copy">
                      <Link href={`/admin/trends/${trend.id}`}>
                        {trend.keyword}
                      </Link>
                      <p>
                        {related.slice(0, 2).join(" · ") ||
                          "No related queries available"}
                      </p>
                    </div>
                    <span className="category-tag">
                      {trend.category || "Unclassified"}
                    </span>
                    <span className={`status status-${trend.generationStatus}`}>
                      {trend.generationStatus}
                    </span>
                    <GenerateDraftButton
                      trendId={trend.id}
                      hasDraft={Boolean(trend.post)}
                      aiConfigured={aiConfigured}
                    />
                    <Link
                      className="admin-review-link"
                      href={`/admin/trends/${trend.id}`}
                    >
                      Review →
                    </Link>
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
