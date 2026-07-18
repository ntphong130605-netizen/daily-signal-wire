import Link from "next/link";
import { RevenueImportForm } from "@/components/AdminMonetizationActions";
import { safeDbQuery } from "@/lib/prisma";
import { revenueIntelligence, revenueRecommendations } from "@/lib/revenue";

export const dynamic = "force-dynamic";

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "Waiting for data";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "Waiting for data" : `${value.toFixed(2)}%`;
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

const emptyData = {
  today: { impressions: 0, viewableImpressions: 0, clicks: 0, pageViews: 0, revenue: 0, ctr: null, viewability: null, rpm: null, cpc: null },
  yesterday: { impressions: 0, viewableImpressions: 0, clicks: 0, pageViews: 0, revenue: 0, ctr: null, viewability: null, rpm: null, cpc: null },
  sevenDays: { impressions: 0, viewableImpressions: 0, clicks: 0, pageViews: 0, revenue: 0, ctr: null, viewability: null, rpm: null, cpc: null },
  thirtyDays: { impressions: 0, viewableImpressions: 0, clicks: 0, pageViews: 0, revenue: 0, ctr: null, viewability: null, rpm: null, cpc: null },
  affiliateRevenue: 0,
  adRevenue: 0,
  newsletterRevenue: 0,
  totalRevenue: 0,
  subscribers: 0,
  newsletter: { sends: 0, delivered: 0, opens: 0, clicks: 0, affiliateClicks: 0, revenue: 0, openRate: null, ctr: null },
  topArticles: [], topCategories: [], topCountries: [], topPositions: [], topDevices: [], topTrafficSources: [], topAffiliateLinks: [],
  bestPublishHourUtc: null,
  importedRows: 0,
  hasRealRevenueData: false
} satisfies Awaited<ReturnType<typeof revenueIntelligence>>;

export default async function AdminRevenuePage() {
  const data = await safeDbQuery("admin_revenue_intelligence_failed", emptyData, revenueIntelligence);
  const recommendations = revenueRecommendations(data);
  const periodCards = [
    ["Today’s revenue", data.today.revenue, "Official imported data"],
    ["Yesterday", data.yesterday.revenue, "Official imported data"],
    ["Last 7 days", data.sevenDays.revenue, "Official imported data"],
    ["Last 30 days", data.thirtyDays.revenue, "Official imported data"]
  ] as const;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Revenue Intelligence</p>
          <h1>Measured revenue, not projections</h1>
          <p>Ad, affiliate and newsletter results appear only after an official report or conversion feed is imported.</p>
        </div>
        <div className="header-badge">{data.importedRows ? `${data.importedRows} report rows` : "Waiting for reporting data"}</div>
      </header>
      <main className="admin-content growth-dashboard">
        {!data.hasRealRevenueData && <section className="panel monetization-notice"><strong>No revenue has been reported yet.</strong><p>Configure publisher credentials and import official reporting data. Daily Signal Wire does not calculate or display fabricated earnings.</p></section>}

        <section className="growth-metric-grid" aria-label="Revenue totals">
          {periodCards.map(([label, value, note]) => <div key={label}><span>{label}</span><strong>{data.hasRealRevenueData ? money(value) : "—"}</strong><small>{note}</small></div>)}
        </section>

        <section className="growth-metric-grid compact" aria-label="Revenue channels">
          <div><span>Estimated RPM</span><strong>{data.thirtyDays.rpm === null ? "—" : money(data.thirtyDays.rpm)}</strong><small>Revenue per 1,000 measured pageviews</small></div>
          <div><span>Ad CTR</span><strong>{percent(data.thirtyDays.ctr)}</strong><small>{number(data.thirtyDays.clicks)} official ad clicks</small></div>
          <div><span>Ad revenue</span><strong>{data.hasRealRevenueData ? money(data.adRevenue) : "—"}</strong><small>AdSense import</small></div>
          <div><span>Affiliate revenue</span><strong>{data.hasRealRevenueData ? money(data.affiliateRevenue) : "—"}</strong><small>Confirmed commissions</small></div>
          <div><span>Newsletter revenue</span><strong>{data.hasRealRevenueData ? money(data.newsletterRevenue) : "—"}</strong><small>Imported campaign reports</small></div>
          <div><span>Newsletter subscribers</span><strong>{number(data.subscribers)}</strong><small>Active subscribers</small></div>
        </section>

        <section className="growth-hub-grid revenue-panels">
          {[
            ["Top articles", data.topArticles],
            ["Top categories", data.topCategories],
            ["Top countries", data.topCountries],
            ["Ad positions", data.topPositions]
          ].map(([title, rows]) => (
            <article className="panel" key={title as string}>
              <div className="panel-heading compact"><h2>{title as string}</h2></div>
              {(rows as typeof data.topArticles).length ? <ol className="growth-ranked-list">{(rows as typeof data.topArticles).map((row) => <li key={row.label}><span>{row.label}</span><strong>{money(row.revenue)}</strong></li>)}</ol> : <div className="empty-state compact"><h3>Waiting for data</h3><p>This ranking needs official report dimensions.</p></div>}
            </article>
          ))}
        </section>

        <section className="panel revenue-optimizer-panel">
          <div className="panel-heading compact"><div><p className="eyebrow">Revenue optimizer</p><h2>Evidence-based recommendations</h2></div></div>
          <ul className="growth-check-list">{recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Official data import</p><h2>AdSense, affiliate and newsletter reports</h2><p>Only upload data exported from the provider. Imports are schema-validated and replace same-source AdSense dates to avoid duplication.</p></div></div>
          <RevenueImportForm />
        </section>

        <section className="growth-hub-grid">
          <Link className="growth-hub-card" href="/admin/ads"><span>Ad Manager</span><h2>Placements and configuration</h2><p>Manage reserved space, responsive slots and page coverage.</p><strong>Open Ad Manager →</strong></Link>
          <Link className="growth-hub-card" href="/admin/affiliate"><span>Affiliate</span><h2>Programs and tracked links</h2><p>Control disclosures, links and confirmed conversions.</p><strong>Open Affiliate Manager →</strong></Link>
          <Link className="growth-hub-card" href="/admin/ab-testing"><span>Experiments</span><h2>A/B testing</h2><p>Run deterministic tests and select winners from measured results.</p><strong>Open experiments →</strong></Link>
          <Link className="growth-hub-card" href="/admin/heatmap"><span>Behavior</span><h2>Consent-aware heatmap</h2><p>Review clicks, reading depth and exit position.</p><strong>Open heatmap →</strong></Link>
        </section>
      </main>
    </>
  );
}
