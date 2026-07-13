import Link from "next/link";
import { estimatedRevenue } from "@/lib/growth";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return "Not configured";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export default async function AdminRevenuePage() {
  const since = daysAgo(30);
  const data = await safeDbQuery(
    "admin_revenue_query_failed",
    {
      pageviews: 0,
      sessions: 0,
      metrics: [] as {
        id: string;
        date: Date;
        source: string;
        pageviews: number;
        sessions: number;
        estimatedRevenue: number | null;
        ctr: number | null;
        rpm: number | null;
      }[],
      topArticles: [] as { articleSlug: string | null; _count: { _all: number } }[],
      topCategories: [] as { category: string | null; _count: { _all: number } }[],
      topCountries: [] as { country: string | null; _count: { _all: number } }[],
      trafficSources: [] as { source: string | null; _count: { _all: number } }[],
      publishedCount: 0
    },
    async () => {
      const [
        pageviews,
        sessions,
        metrics,
        topArticles,
        topCategories,
        topCountries,
        trafficSources,
        publishedCount
      ] = await Promise.all([
        prisma.analyticsEvent.count({
          where: { eventName: "page_view", createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: "session_start", createdAt: { gte: since } }
        }),
        prisma.revenueMetric.findMany({
          where: { date: { gte: since } },
          orderBy: { date: "desc" },
          take: 30
        }),
        prisma.analyticsEvent.groupBy({
          by: ["articleSlug"],
          where: {
            eventName: "article_view",
            createdAt: { gte: since },
            articleSlug: { not: null }
          },
          _count: { _all: true },
          orderBy: { _count: { articleSlug: "desc" } },
          take: 8
        }),
        prisma.analyticsEvent.groupBy({
          by: ["category"],
          where: {
            eventName: { in: ["page_view", "article_view"] },
            createdAt: { gte: since },
            category: { not: null }
          },
          _count: { _all: true },
          orderBy: { _count: { category: "desc" } },
          take: 8
        }),
        prisma.analyticsEvent.groupBy({
          by: ["country"],
          where: {
            eventName: { in: ["page_view", "article_view"] },
            createdAt: { gte: since },
            country: { not: null }
          },
          _count: { _all: true },
          orderBy: { _count: { country: "desc" } },
          take: 8
        }),
        prisma.analyticsEvent.groupBy({
          by: ["source"],
          where: {
            eventName: { in: ["page_view", "article_view"] },
            createdAt: { gte: since },
            source: { not: null }
          },
          _count: { _all: true },
          orderBy: { _count: { source: "desc" } },
          take: 8
        }),
        prisma.post.count({ where: { status: "published", publishedAt: { gte: since } } })
      ]);
      return {
        pageviews,
        sessions,
        metrics,
        topArticles,
        topCategories,
        topCountries,
        trafficSources,
        publishedCount
      };
    }
  );
  const revenue = estimatedRevenue(data.pageviews);
  const importedRevenue = data.metrics.reduce(
    (sum, row) => sum + (row.estimatedRevenue || 0),
    0
  );
  const displayRevenue = importedRevenue > 0 ? importedRevenue : revenue.revenue;
  const optimizerSignals = [
    data.topCategories[0]
      ? `Publish more high-quality coverage in ${data.topCategories[0].category || "the leading category"}; it has the strongest recent engagement.`
      : "",
    data.topArticles[0]
      ? `Update or follow up on /news/${data.topArticles[0].articleSlug}; it is the top article by tracked views.`
      : "",
    data.pageviews < 100
      ? "Collect more traffic before making revenue optimization decisions."
      : "",
    revenue.rpm
      ? "Use the configured RPM model only as an internal estimate until AdSense reporting is imported."
      : "Add ADSENSE_ESTIMATED_RPM or import AdSense reports to enable revenue estimates."
  ].filter(Boolean);

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Revenue Center</p>
          <h1>Advertising and Growth Revenue</h1>
          <p>
            Track pageviews, sessions, RPM assumptions, top content and imported
            AdSense metrics. The dashboard never invents earnings.
          </p>
        </div>
        <div className="header-badge">
          {revenue.rpm ? `$${revenue.rpm.toFixed(2)} RPM model` : "RPM not configured"}
        </div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid">
          <div>
            <span>Estimated AdSense revenue</span>
            <strong>{formatMoney(displayRevenue)}</strong>
            <small>{importedRevenue > 0 ? "Imported metrics" : "RPM-based estimate"}</small>
          </div>
          <div>
            <span>Pageviews</span>
            <strong>{formatNumber(data.pageviews)}</strong>
            <small>Last 30 days</small>
          </div>
          <div>
            <span>Sessions</span>
            <strong>{formatNumber(data.sessions)}</strong>
            <small>Tracked with consent</small>
          </div>
          <div>
            <span>Published frequency</span>
            <strong>{formatNumber(data.publishedCount)}</strong>
            <small>Articles in 30 days</small>
          </div>
        </section>

        <section className="growth-hub-grid revenue-panels">
          <article className="panel">
            <div className="panel-heading compact">
              <h2>Top articles</h2>
            </div>
            {data.topArticles.length === 0 ? (
              <div className="empty-state compact">
                <h3>No article views yet</h3>
                <p>Article view events appear after consented traffic is recorded.</p>
              </div>
            ) : (
              <ol className="growth-ranked-list">
                {data.topArticles.map((row) => (
                  <li key={row.articleSlug || "unknown"}>
                    <Link href={`/news/${row.articleSlug}`}>{row.articleSlug}</Link>
                    <span>{formatNumber(row._count._all)}</span>
                  </li>
                ))}
              </ol>
            )}
          </article>
          <article className="panel">
            <div className="panel-heading compact">
              <h2>Top categories</h2>
            </div>
            {data.topCategories.length === 0 ? (
              <div className="empty-state compact">
                <h3>No category traffic yet</h3>
                <p>Category events appear as readers browse the site.</p>
              </div>
            ) : (
              <ol className="growth-ranked-list">
                {data.topCategories.map((row) => (
                  <li key={row.category || "unknown"}>
                    <span>{row.category}</span>
                    <strong>{formatNumber(row._count._all)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </article>
          <article className="panel">
            <div className="panel-heading compact">
              <h2>Top countries</h2>
            </div>
            {data.topCountries.length === 0 ? (
              <div className="empty-state compact">
                <h3>No country data yet</h3>
                <p>Vercel geolocation headers will populate this in production.</p>
              </div>
            ) : (
              <ol className="growth-ranked-list">
                {data.topCountries.map((row) => (
                  <li key={row.country || "unknown"}>
                    <span>{row.country}</span>
                    <strong>{formatNumber(row._count._all)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </article>
          <article className="panel">
            <div className="panel-heading compact">
              <h2>Traffic sources</h2>
            </div>
            {data.trafficSources.length === 0 ? (
              <div className="empty-state compact">
                <h3>No source data yet</h3>
                <p>Referrer/source events will appear after analytics consent.</p>
              </div>
            ) : (
              <ol className="growth-ranked-list">
                {data.trafficSources.map((row) => (
                  <li key={row.source || "direct"}>
                    <span>{row.source || "direct"}</span>
                    <strong>{formatNumber(row._count._all)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </article>
        </section>

        <section className="panel revenue-optimizer-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">AI Revenue Optimizer</p>
              <h2>Recommendations</h2>
            </div>
          </div>
          <ul className="growth-check-list">
            {optimizerSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
