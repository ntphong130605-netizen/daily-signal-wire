import Link from "next/link";
import { estimatedRevenue } from "@/lib/growth";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatMoney(value: number | null) {
  if (value === null) return "Not configured";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);
}

export default async function AdminGrowthPage() {
  const today = startOfToday();
  const data = await safeDbQuery(
    "admin_growth_query_failed",
    {
      todayArticles: 0,
      scheduled: 0,
      published: 0,
      pendingReview: 0,
      aiQueue: 0,
      trendQueue: 0,
      pageviews: 0,
      sessions: 0,
      seoScore: null as number | null,
      discoverScore: null as number | null,
      factCheckNeedsReview: 0,
      distributionBlocked: 0,
      plannerUpcoming: 0,
      latestAlerts: [] as { id: string; title: string; message: string; severity: string }[]
    },
    async () => {
      const [
        todayArticles,
        scheduled,
        published,
        pendingReview,
        aiQueue,
        trendQueue,
        pageviews,
        sessions,
        latestSeo,
        latestDiscover,
        factCheckNeedsReview,
        distributionBlocked,
        plannerUpcoming,
        latestAlerts
      ] = await Promise.all([
        prisma.post.count({ where: { status: "published", publishedAt: { gte: today } } }),
        prisma.post.count({ where: { status: "scheduled" } }),
        prisma.post.count({ where: { status: "published" } }),
        prisma.post.count({ where: { status: { in: ["draft", "pending_review", "approved"] } } }),
        prisma.post.count({ where: { aiGenerated: true, status: { in: ["draft", "pending_review"] } } }),
        prisma.trend.count({ where: { generationStatus: { in: ["idle", "generating", "failed"] } } }),
        prisma.analyticsEvent.count({
          where: { eventName: "page_view", createdAt: { gte: today } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: "session_start", createdAt: { gte: today } }
        }),
        prisma.seoAudit.findFirst({ orderBy: { analyzedAt: "desc" }, select: { score: true } }),
        prisma.discoverAudit.findFirst({
          orderBy: { analyzedAt: "desc" },
          select: { score: true }
        }),
        prisma.post.count({
          where: {
            aiGenerated: true,
            OR: [
              { factCheckStatus: { not: "Verified" } },
              { trustScore: { lt: 75 } }
            ]
          }
        }),
        prisma.distributionPublish.count({ where: { status: { in: ["blocked", "failed"] } } }),
        prisma.contentPlanItem.count({ where: { plannedFor: { gte: today } } }),
        prisma.editorialNotification.findMany({
          orderBy: { createdAt: "desc" },
          select: { id: true, title: true, message: true, severity: true },
          take: 5
        })
      ]);

      return {
        todayArticles,
        scheduled,
        published,
        pendingReview,
        aiQueue,
        trendQueue,
        pageviews,
        sessions,
        seoScore: latestSeo?.score ?? null,
        discoverScore: latestDiscover?.score ?? null,
        factCheckNeedsReview,
        distributionBlocked,
        plannerUpcoming,
        latestAlerts
      };
    }
  );

  const revenue = estimatedRevenue(data.pageviews);
  const healthScore = Math.max(
    0,
    100 -
      data.factCheckNeedsReview * 6 -
      data.distributionBlocked * 4 -
      (data.seoScore === null ? 10 : Math.max(0, 75 - data.seoScore) / 2)
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Phase 4.0 · Growth & Revenue Platform</p>
          <h1>Business Command Center</h1>
          <p>
            One operating view for publishing velocity, traffic, SEO, Discover,
            revenue readiness and system health.
          </p>
        </div>
        <div className="header-badge">Health {Math.round(healthScore)}/100</div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid">
          <Link href="/admin/posts?status=published">
            <span>Today&apos;s articles</span>
            <strong>{formatNumber(data.todayArticles)}</strong>
            <small>{formatNumber(data.published)} total published</small>
          </Link>
          <Link href="/admin/publishing">
            <span>Scheduled</span>
            <strong>{formatNumber(data.scheduled)}</strong>
            <small>{formatNumber(data.pendingReview)} in review</small>
          </Link>
          <Link href="/admin/writer">
            <span>AI queue</span>
            <strong>{formatNumber(data.aiQueue)}</strong>
            <small>{formatNumber(data.trendQueue)} trend leads</small>
          </Link>
          <Link href="/admin/revenue">
            <span>Estimated revenue</span>
            <strong>{formatMoney(revenue.revenue)}</strong>
            <small>
              {revenue.rpm ? `$${revenue.rpm.toFixed(2)} RPM model` : "Add ADSENSE_ESTIMATED_RPM"}
            </small>
          </Link>
          <Link href="/admin/analytics">
            <span>Pageviews today</span>
            <strong>{formatNumber(data.pageviews)}</strong>
            <small>{formatNumber(data.sessions)} tracked sessions</small>
          </Link>
          <Link href="/admin/discover">
            <span>Discover score</span>
            <strong>{data.discoverScore ?? "—"}</strong>
            <small>Latest article audit</small>
          </Link>
          <Link href="/admin/seo">
            <span>SEO score</span>
            <strong>{data.seoScore ?? "—"}</strong>
            <small>Latest article audit</small>
          </Link>
          <Link href="/admin/fact-checker">
            <span>Fact-check status</span>
            <strong>{formatNumber(data.factCheckNeedsReview)}</strong>
            <small>Need review or low trust</small>
          </Link>
        </section>

        <section className="growth-hub-grid">
          <Link href="/admin/planner" className="growth-hub-card">
            <span>01</span>
            <h2>AI Content Planner</h2>
            <p>
              Build a seven-day publishing calendar from Google Trends,
              evergreen coverage and category balance.
            </p>
            <strong>{formatNumber(data.plannerUpcoming)} upcoming items →</strong>
          </Link>
          <Link href="/admin/distribution" className="growth-hub-card">
            <span>02</span>
            <h2>Distribution Center</h2>
            <p>
              Queue manual, scheduled and auto distribution across social,
              RSS and newsletter channels without hardcoding credentials.
            </p>
            <strong>{formatNumber(data.distributionBlocked)} blocked jobs →</strong>
          </Link>
          <Link href="/admin/social" className="growth-hub-card">
            <span>03</span>
            <h2>AI Social Platform</h2>
            <p>
              Generate platform-specific copy, UTM links, social images and
              retryable queue entries for every published article.
            </p>
            <strong>Open social queue →</strong>
          </Link>
          <Link href="/admin/seo" className="growth-hub-card">
            <span>04</span>
            <h2>SEO Intelligence</h2>
            <p>
              Audit headlines, metadata, slug quality, source links, image SEO,
              duplicate risk and content depth.
            </p>
            <strong>Analyze articles →</strong>
          </Link>
          <Link href="/admin/monitoring" className="growth-hub-card">
            <span>05</span>
            <h2>System Status</h2>
            <p>
              Check cron readiness, OpenAI, Blob Storage, database, search,
              AdSense and analytics configuration.
            </p>
            <strong>Run health checks →</strong>
          </Link>
        </section>

        <section className="panel growth-alert-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Operating signals</p>
              <h2>Latest newsroom alerts</h2>
            </div>
            <Link href="/admin/publishing" className="source-pill">
              Publishing Center →
            </Link>
          </div>
          {data.latestAlerts.length === 0 ? (
            <div className="empty-state compact">
              <h3>No alerts yet</h3>
              <p>Publishing, fact-check, image and distribution alerts will appear here.</p>
            </div>
          ) : (
            <div className="growth-alert-list">
              {data.latestAlerts.map((alert) => (
                <article key={alert.id} className={`growth-alert severity-${alert.severity}`}>
                  <span>{alert.severity}</span>
                  <div>
                    <strong>{alert.title}</strong>
                    <p>{alert.message}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
