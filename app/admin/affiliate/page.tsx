import {
  AffiliateLinkForm,
  AffiliateProgramForm,
  AffiliateStatusButton
} from "@/components/AdminMonetizationActions";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { affiliateReadiness } from "@/lib/revenue";

export const dynamic = "force-dynamic";

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
}

export default async function AdminAffiliatePage() {
  const data = await safeDbQuery("admin_affiliate_query_failed", { programs: [], links: [], clicks30d: 0, conversions30d: 0 }, async () => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [programs, links, clicks30d, conversions30d] = await Promise.all([
      prisma.affiliateProgram.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.affiliateLink.findMany({ include: { program: { select: { name: true, network: true } } }, orderBy: [{ revenue: "desc" }, { clicks: "desc" }] }),
      prisma.affiliateClick.count({ where: { createdAt: { gte: since } } }),
      prisma.affiliateConversion.count({ where: { occurredAt: { gte: since } } })
    ]);
    return { programs, links, clicks30d, conversions30d };
  });
  const readiness = affiliateReadiness();
  const revenue = data.links.reduce((sum, link) => sum + link.revenue, 0);
  const activePrograms = data.programs.filter((program) => program.status === "active");

  return <>
    <header className="admin-header"><div><p className="eyebrow">Affiliate Engine</p><h1>Programs, disclosures and tracked links</h1><p>Insert only relevant active offers. Every link uses a sponsored disclosure and a first-party click redirect.</p></div><div className="header-badge">{activePrograms.length} active programs</div></header>
    <main className="admin-content growth-dashboard">
      <section className="growth-metric-grid compact">
        <div><span>Programs</span><strong>{data.programs.length}</strong><small>{activePrograms.length} active</small></div>
        <div><span>Tracked links</span><strong>{data.links.length}</strong><small>Contextual insertion eligible</small></div>
        <div><span>Clicks · 30 days</span><strong>{data.clicks30d}</strong><small>First-party redirect events</small></div>
        <div><span>Confirmed conversions</span><strong>{data.conversions30d}</strong><small>Imported from affiliate reports</small></div>
        <div><span>Confirmed revenue</span><strong>{money(revenue)}</strong><small>No projected commissions</small></div>
      </section>

      <section className="panel"><div className="panel-heading compact"><div><p className="eyebrow">Credential readiness</p><h2>Affiliate networks</h2></div></div><div className="growth-hub-grid">{readiness.map((item) => <div className="growth-channel-card" key={item.network}><span>{item.network}</span><h2>{item.configured ? "Configured" : "Waiting for credentials"}</h2><p>{item.configured ? "Server credential detected." : item.missing.join(", ")}</p></div>)}</div></section>

      <section className="growth-hub-grid revenue-panels">
        <article className="panel"><div className="panel-heading compact"><h2>Add program</h2></div><AffiliateProgramForm /></article>
        <article className="panel"><div className="panel-heading compact"><h2>Add tracked link</h2></div><AffiliateLinkForm programs={activePrograms.map(({ id, name }) => ({ id, name }))} /></article>
      </section>

      <section className="panel"><div className="panel-heading compact"><div><p className="eyebrow">Inventory</p><h2>Affiliate links</h2></div></div>{data.links.length ? <div className="monetization-table"><div className="monetization-table-row monetization-table-head"><span>Offer</span><span>Network</span><span>Category</span><span>Clicks</span><span>Conversions</span><span>Revenue</span></div>{data.links.map((link) => <div className="monetization-table-row" key={link.id}><div><strong>{link.label}</strong><small>{link.status}</small></div><span>{link.program.name} · {link.program.network}</span><span>{link.category || "Contextual keywords"}</span><span>{link.clicks}</span><span>{link.conversions}</span><div><strong>{money(link.revenue, link.currency)}</strong><AffiliateStatusButton entity="link" id={link.id} status={link.status} /></div></div>)}</div> : <div className="empty-state"><h3>No affiliate links</h3><p>Add an approved program and its official tracking URL. Nothing is inserted until a relevant active link exists.</p></div>}</section>
    </main>
  </>;
}
