import { AdSlotToggle, InitializeAdManagerButton } from "@/components/AdminMonetizationActions";
import {
  adPlacementDefinitions,
  adsenseAutoAdsEnabled,
  adsenseClientId,
  adsenseSlotFor,
  hasAdsTxtConfiguration,
  maskPublicId
} from "@/lib/ads";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminAdsPage() {
  const slots = await safeDbQuery("admin_ads_slots_failed", [], () =>
    prisma.adSlot.findMany({ orderBy: { placement: "asc" } })
  );
  const byKey = new Map(slots.map((slot) => [slot.key, slot]));
  const client = adsenseClientId();
  const configuredCount = adPlacementDefinitions.filter((placement) =>
    Boolean(byKey.get(placement.position)?.slotId || adsenseSlotFor(placement.position))
  ).length;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Centralized Ad Manager</p>
          <h1>Google AdSense placements</h1>
          <p>Responsive, consent-aware inventory with lazy loading and reserved dimensions to protect layout stability.</p>
        </div>
        <div className="header-badge">{client ? `${configuredCount}/${adPlacementDefinitions.length} slots configured` : "Waiting for AdSense client ID"}</div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid compact">
          <div><span>AdSense client</span><strong>{client ? "Configured" : "Missing"}</strong><small>{maskPublicId(client)}</small></div>
          <div><span>ads.txt</span><strong>{hasAdsTxtConfiguration() ? "Configured" : "Missing"}</strong><small>/ads.txt</small></div>
          <div><span>Auto ads</span><strong>{adsenseAutoAdsEnabled() ? "On" : "Off"}</strong><small>NEXT_PUBLIC_ADSENSE_AUTO_ADS</small></div>
          <div><span>Placement registry</span><strong>{slots.length}/{adPlacementDefinitions.length}</strong><small>Database-managed placements</small></div>
        </section>

        <section className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Inventory</p><h2>Placement registry</h2><p>Environment ad unit IDs remain the default. Database records can disable a placement or override its public slot ID and reserved size without changing article code.</p></div><InitializeAdManagerButton /></div>
          <div className="monetization-table" role="table" aria-label="Ad placements">
            <div className="monetization-table-row monetization-table-head" role="row"><span>Placement</span><span>Routes</span><span>Loading</span><span>Reserved space</span><span>Status</span><span>Action</span></div>
            {adPlacementDefinitions.map((placement) => {
              const managed = byKey.get(placement.position);
              const enabled = managed?.enabled ?? true;
              const configured = Boolean(managed?.slotId || adsenseSlotFor(placement.position));
              return <div className="monetization-table-row" role="row" key={placement.position}>
                <div><strong>{placement.label}</strong><small>{placement.position}</small></div>
                <span>{managed?.routeScope || placement.routeScope}</span>
                <span>{managed?.lazy ?? placement.lazy ? "Lazy" : "Priority"}{managed?.sticky ?? placement.sticky ? " · Sticky" : ""}</span>
                <span>{managed?.minHeightDesktop ?? placement.minHeightDesktop}px / {managed?.minHeightMobile ?? placement.minHeightMobile}px</span>
                <span className={`growth-status-pill ${configured && enabled ? "" : "status-paused"}`}>{!enabled ? "Disabled" : configured ? "Ready" : "Slot ID missing"}</span>
                {managed ? <AdSlotToggle slotKey={managed.key} enabled={enabled} /> : <small>Synchronize first</small>}
              </div>;
            })}
          </div>
        </section>

        <section className="panel monetization-policy-note">
          <div className="panel-heading compact"><div><p className="eyebrow">Traffic integrity</p><h2>Safe measurement boundary</h2></div></div>
          <p>Daily Signal Wire records when Google marks an ad unit as filled and when at least half of it remains visible for one second. The site never listens for or simulates clicks inside AdSense units. Official clicks, CPC, RPM and revenue must come from Google reporting.</p>
        </section>
      </main>
    </>
  );
}
