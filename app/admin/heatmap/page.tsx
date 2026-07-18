import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminHeatmapPage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const data = await safeDbQuery("admin_heatmap_query_failed", { total: 0, clicks: [], depths: [], exits: [], durations: { _avg: { durationSeconds: null as number | null } }, pages: [] }, async () => {
    const [total, clicks, depths, exits, durations, pages] = await Promise.all([
      prisma.heatmapEvent.count({ where: { createdAt: { gte: since } } }),
      prisma.heatmapEvent.groupBy({ by: ["elementKey"], where: { eventType: "click", elementKey: { not: null }, createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { elementKey: "desc" } }, take: 15 }),
      prisma.heatmapEvent.groupBy({ by: ["scrollDepth"], where: { eventType: "scroll", scrollDepth: { not: null }, createdAt: { gte: since } }, _count: { _all: true }, orderBy: { scrollDepth: "asc" } }),
      prisma.heatmapEvent.groupBy({ by: ["exitPosition"], where: { eventType: "exit", exitPosition: { not: null }, createdAt: { gte: since } }, _count: { _all: true }, orderBy: { exitPosition: "asc" } }),
      prisma.heatmapEvent.aggregate({ where: { eventType: "exit", durationSeconds: { not: null }, createdAt: { gte: since } }, _avg: { durationSeconds: true } }),
      prisma.heatmapEvent.groupBy({ by: ["path"], where: { createdAt: { gte: since } }, _count: { _all: true }, orderBy: { _count: { path: "desc" } }, take: 10 })
    ]);
    return { total, clicks, depths, exits, durations, pages };
  });
  const averageDuration = Math.round(data.durations._avg?.durationSeconds || 0);
  return <>
    <header className="admin-header"><div><p className="eyebrow">Consent-aware Behavior Analytics</p><h1>Heatmap signals</h1><p>Aggregated click targets, scroll depth, reading time and exit position. Tracking starts only after analytics consent.</p></div><div className="header-badge">{data.total ? `${data.total} measured events` : "Waiting for consented traffic"}</div></header>
    <main className="admin-content growth-dashboard">
      <section className="growth-metric-grid compact"><div><span>Events · 30 days</span><strong>{data.total}</strong><small>Consented sessions only</small></div><div><span>Average session time</span><strong>{averageDuration ? `${averageDuration}s` : "—"}</strong><small>Measured exit events</small></div><div><span>Top scroll depth</span><strong>{data.depths.at(-1)?.scrollDepth ? `${data.depths.at(-1)?.scrollDepth}%` : "—"}</strong><small>Highest observed threshold</small></div><div><span>Top exit position</span><strong>{data.exits.sort((a, b) => b._count._all - a._count._all)[0]?.exitPosition !== undefined ? `${data.exits.sort((a, b) => b._count._all - a._count._all)[0]?.exitPosition}%` : "—"}</strong><small>Most common measured exit band</small></div></section>
      {!data.total ? <section className="panel empty-state"><h3>No behavior data yet</h3><p>The dashboard remains empty until a reader grants analytics consent and interacts with production pages.</p></section> : <section className="growth-hub-grid revenue-panels"><article className="panel"><div className="panel-heading compact"><h2>Most clicked sections</h2></div><ol className="growth-ranked-list">{data.clicks.map((row) => <li key={row.elementKey || "unknown"}><span>{row.elementKey}</span><strong>{row._count._all}</strong></li>)}</ol></article><article className="panel"><div className="panel-heading compact"><h2>Most active pages</h2></div><ol className="growth-ranked-list">{data.pages.map((row) => <li key={row.path}><span>{row.path}</span><strong>{row._count._all}</strong></li>)}</ol></article><article className="panel"><div className="panel-heading compact"><h2>Scroll thresholds</h2></div><ol className="growth-ranked-list">{data.depths.map((row) => <li key={row.scrollDepth}><span>{row.scrollDepth}%</span><strong>{row._count._all}</strong></li>)}</ol></article><article className="panel"><div className="panel-heading compact"><h2>Exit bands</h2></div><ol className="growth-ranked-list">{data.exits.map((row) => <li key={row.exitPosition}><span>{row.exitPosition}%</span><strong>{row._count._all}</strong></li>)}</ol></article></section>}
    </main>
  </>;
}
