import Link from "next/link";
import { prisma, safeDbQuery } from "@/lib/prisma";

const statusLabels: Record<string, string> = {
  idle: "Ready",
  generating: "Generating",
  completed: "Draft ready",
  failed: "Needs attention"
};

export default async function AdminDashboard() {
  const { trends, publishedCount, subscriberCount } = await safeDbQuery(
    "admin_dashboard_query_failed",
    { trends: [], publishedCount: 0, subscriberCount: 0 },
    async () => {
      const [trends, publishedCount, subscriberCount] = await Promise.all([
        prisma.trend.findMany({
          include: { post: { select: { status: true, title: true } } },
          orderBy: { discoveredAt: "desc" },
          take: 100
        }),
        prisma.post.count({ where: { status: "published" } }),
        prisma.newsletterSubscriber.count()
      ]);

      return { trends, publishedCount, subscriberCount };
    }
  );
  const draftCount = trends.filter((trend) => trend.post?.status === "draft").length;
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">{dateLabel} · Newsroom desk</p>
          <h1>Trend intelligence</h1>
          <p>Search demand becomes a reporting lead—not a finished story.</p>
        </div>
        <div className="header-badge">US · English</div>
      </header>
      <main className="admin-content">
        <section className="stats-row">
          <div className="stat-card">
            <span>Tracked signals</span>
            <strong>{trends.length}</strong>
            <small>Google Trends US</small>
          </div>
          <div className="stat-card">
            <span>Drafts to review</span>
            <strong>{draftCount}</strong>
            <small>Human approval required</small>
          </div>
          <div className="stat-card">
            <span>Published stories</span>
            <strong>{publishedCount}</strong>
            <small>{subscriberCount} newsletter subscribers</small>
          </div>
          <Link href="/admin/growth" className="stat-card">
            <span>Growth platform</span>
            <strong>Phase 4.0</strong>
            <small>Traffic, revenue, SEO, analytics</small>
          </Link>
        </section>
        <section className="panel trend-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Live queue</p>
              <h2>US search trends</h2>
            </div>
            <Link href="/admin/trends" className="source-pill">
              View all trends →
            </Link>
          </div>
          {trends.length === 0 ? (
            <div className="empty-state">
              <h3>No trends yet</h3>
              <p>Run the protected cron endpoint to import the latest US trends.</p>
            </div>
          ) : (
            <div className="trend-list">
              {trends.slice(0, 8).map((trend) => (
                <Link
                  href={`/admin/trends/${trend.id}`}
                  className="trend-row"
                  key={trend.id}
                >
                  <div className="trend-rank">↗</div>
                  <div className="trend-name">
                    <strong>{trend.keyword}</strong>
                    <span>{trend.post?.title || "No article generated yet"}</span>
                  </div>
                  <span className="category-tag">{trend.category || "Unclassified"}</span>
                  <span className="traffic">{trend.traffic || "New"}</span>
                  <span className={`status status-${trend.generationStatus}`}>
                    {statusLabels[trend.generationStatus] || trend.generationStatus}
                  </span>
                  <span className="arrow">→</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
