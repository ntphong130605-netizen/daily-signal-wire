import { ExperimentAction, ExperimentCreateForm } from "@/components/AdminMonetizationActions";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function rate(value: number, total: number) {
  return total ? `${((value / total) * 100).toFixed(2)}%` : "—";
}

export default async function AdminAbTestingPage() {
  const experiments = await safeDbQuery("admin_experiments_query_failed", [], () => prisma.revenueExperiment.findMany({ include: { variants: { orderBy: { key: "asc" } } }, orderBy: { createdAt: "desc" }, take: 100 }));
  const active = experiments.filter((item) => item.status === "active").length;
  const totalImpressions = experiments.reduce((sum, item) => sum + item.variants.reduce((variantSum, variant) => variantSum + variant.impressions, 0), 0);
  return <>
    <header className="admin-header"><div><p className="eyebrow">Revenue Experiments</p><h1>A/B testing</h1><p>Deterministic visitor assignment for headlines, calls to action, article images and placement strategies. Winners use measured results only.</p></div><div className="header-badge">{active} active tests</div></header>
    <main className="admin-content growth-dashboard">
      <section className="growth-metric-grid compact"><div><span>Experiments</span><strong>{experiments.length}</strong><small>All states</small></div><div><span>Active</span><strong>{active}</strong><small>Serving variants</small></div><div><span>Measured impressions</span><strong>{totalImpressions}</strong><small>One assignment per session</small></div><div><span>Winner threshold</span><strong>100+</strong><small>Impressions per eligible variant</small></div></section>
      <section className="panel"><div className="panel-heading compact"><div><p className="eyebrow">New test</p><h2>Create a controlled 50/50 experiment</h2></div></div><ExperimentCreateForm /></section>
      <section className="panel"><div className="panel-heading compact"><div><p className="eyebrow">Results</p><h2>Experiment performance</h2></div></div>{experiments.length ? <div className="experiment-list">{experiments.map((experiment) => <article className="experiment-card" key={experiment.id}><div className="panel-heading compact"><div><span className="growth-status-pill">{experiment.status}</span><h3>{experiment.name}</h3><p>{experiment.type} · {experiment.targetArticleSlug || experiment.targetCategory || "Site-wide"}</p></div><ExperimentAction id={experiment.id} status={experiment.status} /></div><div className="monetization-table"><div className="monetization-table-row monetization-table-head"><span>Variant</span><span>Weight</span><span>Impressions</span><span>CTR</span><span>Conversions</span><span>Revenue</span></div>{experiment.variants.map((variant) => <div className="monetization-table-row" key={variant.id}><div><strong>{variant.label}</strong><small>{variant.isWinner ? "Winner" : variant.key}</small></div><span>{variant.weight}%</span><span>{variant.impressions}</span><span>{rate(variant.clicks, variant.impressions)}</span><span>{variant.conversions}</span><span>${variant.revenue.toFixed(2)}</span></div>)}</div></article>)}</div> : <div className="empty-state"><h3>No experiments yet</h3><p>Create a draft and activate it only after reviewing both variants.</p></div>}</section>
    </main>
  </>;
}
