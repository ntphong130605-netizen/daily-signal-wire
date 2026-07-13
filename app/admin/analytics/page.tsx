import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function maskId(value: string) {
  if (!value) return "Not configured";
  if (value.length <= 8) return value;
  return `${value.slice(0, 5)}…${value.slice(-4)}`;
}

function parseMetadata(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return parsed;
  } catch {
    return {};
  }
}

function topSearches(events: { metadata: string }[]) {
  const counts = new Map<string, number>();
  for (const event of events) {
    const query = parseMetadata(event.metadata).query;
    if (typeof query === "string" && query.trim().length > 1) {
      const normalized = query.trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([query, count]) => ({ query, count }));
}

function RankedPanel({
  title,
  rows
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  return (
    <article className="panel">
      <div className="panel-heading compact">
        <h2>{title}</h2>
      </div>
      {rows.length === 0 ? (
        <div className="empty-state compact">
          <h3>No data yet</h3>
          <p>Events appear here as traffic is recorded.</p>
        </div>
      ) : (
        <ol className="growth-ranked-list">
          {rows.map((row) => (
            <li key={`${title}-${row.label}`}>
              <span>{row.label}</span>
              <strong>{formatNumber(row.count)}</strong>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export default async function AdminAnalyticsPage() {
  const since = daysAgo(30);
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
  const gscVerification =
    process.env.NEXT_PUBLIC_GSC_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION || "";
  const sitemapUrls = [
    absoluteUrl("/sitemap.xml"),
    absoluteUrl("/news-sitemap.xml"),
    absoluteUrl("/image-sitemap.xml"),
    absoluteUrl("/video-sitemap.xml"),
    absoluteUrl("/rss.xml"),
    absoluteUrl("/robots.txt")
  ];
  const data = await safeDbQuery(
    "admin_analytics_query_failed",
    {
      pageviews: 0,
      articleViews: 0,
      visitors: [] as { visitorId: string | null }[],
      returningVisitors: [] as { visitorId: string | null; _count: { _all: number } }[],
      sessionPageviews: [] as { sessionId: string | null }[],
      timeEvents: [] as { durationSeconds: number | null }[],
      searches: [] as { metadata: string }[],
      copyEvents: 0,
      outboundEvents: 0,
      newsletterEvents: 0,
      publishEvents: 0,
      aiArticleEvents: 0,
      aiImageEvents: 0,
      scrollEvents: [] as { metadata: string }[],
      devices: [] as { device: string | null; _count: { _all: number } }[],
      sources: [] as { source: string | null; _count: { _all: number } }[],
      countries: [] as { country: string | null; _count: { _all: number } }[],
      categories: [] as { category: string | null; _count: { _all: number } }[]
    },
    async () => {
      const [
        pageviews,
        articleViews,
        visitors,
        returningVisitors,
        sessionPageviews,
        timeEvents,
        searches,
        copyEvents,
        outboundEvents,
        newsletterEvents,
        publishEvents,
        aiArticleEvents,
        aiImageEvents,
        scrollEvents,
        devices,
        sources,
        countries,
        categories
      ] = await Promise.all([
        prisma.analyticsEvent.count({
          where: { eventName: "page_view", createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: "article_view", createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.findMany({
          where: {
            eventName: "page_view",
            createdAt: { gte: since },
            visitorId: { not: null }
          },
          distinct: ["visitorId"],
          select: { visitorId: true }
        }),
        prisma.analyticsEvent.groupBy({
          by: ["visitorId"],
          where: {
            eventName: "session_start",
            createdAt: { gte: since },
            visitorId: { not: null }
          },
          _count: { _all: true },
          having: { visitorId: { _count: { gt: 1 } } }
        }),
        prisma.analyticsEvent.findMany({
          where: {
            eventName: "page_view",
            createdAt: { gte: since },
            sessionId: { not: null }
          },
          select: { sessionId: true },
          take: 5000
        }),
        prisma.analyticsEvent.findMany({
          where: {
            eventName: { in: ["session_time", "time_on_page"] },
            createdAt: { gte: since },
            durationSeconds: { not: null }
          },
          select: { durationSeconds: true },
          take: 5000
        }),
        prisma.analyticsEvent.findMany({
          where: { eventName: "search", createdAt: { gte: since } },
          select: { metadata: true },
          take: 300
        }),
        prisma.analyticsEvent.count({
          where: { eventName: "copy_facebook_post", createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: "outbound_click", createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: "newsletter_signup", createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: { in: ["ai_publish", "publish_article"] }, createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: "generate_ai_article", createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.count({
          where: { eventName: { in: ["image_generation", "generate_ai_image"] }, createdAt: { gte: since } }
        }),
        prisma.analyticsEvent.findMany({
          where: { eventName: "scroll_depth", createdAt: { gte: since } },
          select: { metadata: true },
          take: 400
        }),
        prisma.analyticsEvent.groupBy({
          by: ["device"],
          where: { eventName: { in: ["page_view", "article_view"] }, createdAt: { gte: since } },
          _count: { _all: true },
          orderBy: { _count: { device: "desc" } },
          take: 8
        }),
        prisma.analyticsEvent.groupBy({
          by: ["source"],
          where: { eventName: { in: ["page_view", "article_view"] }, createdAt: { gte: since } },
          _count: { _all: true },
          orderBy: { _count: { source: "desc" } },
          take: 8
        }),
        prisma.analyticsEvent.groupBy({
          by: ["country"],
          where: { eventName: { in: ["page_view", "article_view"] }, createdAt: { gte: since } },
          _count: { _all: true },
          orderBy: { _count: { country: "desc" } },
          take: 8
        }),
        prisma.analyticsEvent.groupBy({
          by: ["category"],
          where: { eventName: { in: ["page_view", "article_view"] }, createdAt: { gte: since } },
          _count: { _all: true },
          orderBy: { _count: { category: "desc" } },
          take: 8
        })
      ]);
      return {
        pageviews,
        articleViews,
        visitors,
        returningVisitors,
        sessionPageviews,
        timeEvents,
        searches,
        copyEvents,
        outboundEvents,
        newsletterEvents,
        publishEvents,
        aiArticleEvents,
        aiImageEvents,
        scrollEvents,
        devices,
        sources,
        countries,
        categories
      };
    }
  );
  const popularSearches = topSearches(data.searches);
  const sessionCounts = new Map<string, number>();
  for (const view of data.sessionPageviews) {
    if (!view.sessionId) continue;
    sessionCounts.set(view.sessionId, (sessionCounts.get(view.sessionId) || 0) + 1);
  }
  const bouncedSessions = [...sessionCounts.values()].filter((count) => count <= 1).length;
  const bounceRate =
    sessionCounts.size > 0 ? Math.round((bouncedSessions / sessionCounts.size) * 100) : null;
  const averageTime =
    data.timeEvents.length > 0
      ? Math.round(
          data.timeEvents.reduce((sum, event) => sum + (event.durationSeconds || 0), 0) /
            data.timeEvents.length
        )
      : null;
  const depthValues = data.scrollEvents
    .map((event) => parseMetadata(event.metadata).percent_scrolled)
    .filter((value): value is number => typeof value === "number");
  const averageScroll =
    depthValues.length > 0
      ? Math.round(depthValues.reduce((sum, value) => sum + value, 0) / depthValues.length)
      : null;
  const eventCards = [
    ["Pageviews", data.pageviews],
    ["Visitors", data.visitors.length],
    ["Returning visitors", data.returningVisitors.length],
    ["Article views", data.articleViews],
    ["Bounce rate", bounceRate === null ? "—" : `${bounceRate}%`],
    ["Avg. time on page", averageTime === null ? "—" : `${averageTime}s`],
    ["Searches", data.searches.length],
    ["Outbound clicks", data.outboundEvents],
    ["Newsletter signups", data.newsletterEvents],
    ["Copy Facebook Post", data.copyEvents],
    ["AI publish events", data.publishEvents],
    ["AI articles generated", data.aiArticleEvents],
    ["Image generation events", data.aiImageEvents],
    ["Avg. scroll depth", averageScroll === null ? "—" : `${averageScroll}%`]
  ] as const;
  const deviceRows = data.devices.map((row) => ({
    label: row.device || "unknown",
    count: row._count._all
  }));
  const sourceRows = data.sources.map((row) => ({
    label: row.source || "direct",
    count: row._count._all
  }));
  const countryRows = data.countries.map((row) => ({
    label: row.country || "unknown",
    count: row._count._all
  }));
  const categoryRows = data.categories.map((row) => ({
    label: row.category || "unknown",
    count: row._count._all
  }));
  const indexingStatus = gscVerification
    ? "Ready for Search Console verification"
    : "Add NEXT_PUBLIC_GSC_VERIFICATION";

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Analytics Center</p>
          <h1>Audience and Engagement</h1>
          <p>
            Privacy-safe internal events plus optional GA4 hooks for visitors,
            traffic sources, devices, scroll depth, searches and newsroom actions.
          </p>
        </div>
        <div className="header-badge">
          {gaMeasurementId ? "GA4 configured" : "GA4 not configured"}
        </div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid compact">
          <div>
            <span>GA status</span>
            <strong>{gaMeasurementId ? "Active" : "Missing"}</strong>
            <small>Loads only in production after analytics consent</small>
          </div>
          <div>
            <span>Measurement ID detected</span>
            <strong>{maskId(gaMeasurementId)}</strong>
            <small>NEXT_PUBLIC_GA_MEASUREMENT_ID</small>
          </div>
          <div>
            <span>GSC verification</span>
            <strong>{gscVerification ? "Configured" : "Missing"}</strong>
            <small>{gscVerification ? maskId(gscVerification) : "NEXT_PUBLIC_GSC_VERIFICATION"}</small>
          </div>
          <div>
            <span>Indexing status</span>
            <strong>{gscVerification ? "Ready" : "Action needed"}</strong>
            <small>{indexingStatus}</small>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Search Console</p>
              <h2>Sitemaps and crawl surfaces</h2>
            </div>
          </div>
          <div className="analytics-sitemap-grid">
            {sitemapUrls.map((url) => (
              <a href={url} target="_blank" rel="noreferrer" key={url}>
                {url}
              </a>
            ))}
          </div>
        </section>

        <section className="growth-metric-grid">
          {eventCards.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{typeof value === "number" ? formatNumber(value) : value}</strong>
              <small>consent-based tracking</small>
            </div>
          ))}
        </section>

        <section className="growth-hub-grid revenue-panels">
          <article className="panel">
            <div className="panel-heading compact">
              <h2>Popular searches</h2>
            </div>
            {popularSearches.length === 0 ? (
              <div className="empty-state compact">
                <h3>No search events yet</h3>
                <p>Search terms are tracked only after analytics consent.</p>
              </div>
            ) : (
              <ol className="growth-ranked-list">
                {popularSearches.map((row) => (
                  <li key={row.query}>
                    <span>{row.query}</span>
                    <strong>{formatNumber(row.count)}</strong>
                  </li>
                ))}
              </ol>
            )}
          </article>
          <RankedPanel title="Traffic by device" rows={deviceRows} />
          <RankedPanel title="Traffic by source" rows={sourceRows} />
          <RankedPanel title="Traffic by country" rows={countryRows} />
          <RankedPanel title="Trending categories" rows={categoryRows} />
        </section>
      </main>
    </>
  );
}
