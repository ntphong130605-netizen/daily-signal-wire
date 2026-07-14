import Link from "next/link";
import { getProductionReadiness, productionChecklist } from "@/lib/opsReadiness";

export const dynamic = "force-dynamic";

const docsBase =
  "https://github.com/ntphong130605-netizen/daily-signal-wire/blob/main";

function groupByArea<T extends { area: string }>(items: T[]) {
  return items.reduce<Record<string, T[]>>((accumulator, item) => {
    accumulator[item.area] ||= [];
    accumulator[item.area].push(item);
    return accumulator;
  }, {});
}

function label(status: string) {
  if (status === "operational") return "Ready";
  if (status === "degraded") return "Review";
  if (status === "failed") return "Failed";
  if (status === "waiting") return "Waiting";
  return "Unknown";
}

export default async function AdminProductionChecklistPage() {
  const report = await getProductionReadiness();
  const checklist = productionChecklist(report);
  const grouped = groupByArea([...checklist]);
  const ready = checklist.filter((item) => item.status === "operational").length;
  const waiting = checklist.length - ready;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Launch Operations</p>
          <h1>Production Checklist</h1>
          <p>
            A live launch checklist for environment variables, database, Blob
            storage, AI, AdSense, Google, scheduler, cron, RSS, sitemaps and social distribution.
          </p>
        </div>
        <div className="header-badge">
          {ready}/{checklist.length} ready · {waiting} waiting
        </div>
      </header>

      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid compact">
          <Link href="/admin/system">
            <span>Readiness score</span>
            <strong>{report.healthScore}</strong>
            <small>Open production system dashboard.</small>
          </Link>
          <Link href="/api/health" target="_blank">
            <span>Health endpoint</span>
            <strong>{report.status}</strong>
            <small>Verify runtime health payload.</small>
          </Link>
          <Link href="/admin/settings">
            <span>Credentials</span>
            <strong>{waiting}</strong>
            <small>Missing credentials remain visible, not simulated.</small>
          </Link>
          <Link href="/admin/monitoring">
            <span>Monitoring</span>
            <strong>{report.monitoring.failures24h}</strong>
            <small>Failures recorded in the last 24 hours.</small>
          </Link>
        </section>

        {Object.entries(grouped).map(([area, items]) => (
          <section className="panel" key={area}>
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Checklist</p>
                <h2>{area}</h2>
              </div>
              <span className="source-pill">
                {items.filter((item) => item.status === "operational").length}/{items.length} ready
              </span>
            </div>
            <ul className="publish-checklist compact production-checklist">
              {items.map((item) => (
                <li
                  className={item.status === "operational" ? "done" : "needs-review"}
                  key={`${area}-${item.label}`}
                >
                  <span>{item.status === "operational" ? "✓" : "!"}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.message}</p>
                    <small className={`growth-status-pill status-${item.status}`}>
                      {label(item.status)}
                    </small>
                    {"href" in item && item.href && (
                      <Link className="admin-review-link inline" href={item.href}>
                        Open →
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Runbooks</p>
              <h2>Production documents</h2>
            </div>
          </div>
          <div className="growth-hub-grid">
            <Link href={`${docsBase}/DEPLOYMENT.md`} className="growth-hub-card" target="_blank">
              <span>Deploy</span>
              <h2>DEPLOYMENT.md</h2>
              <p>Environment variables, Vercel deploy and post-deploy checks.</p>
            </Link>
            <Link href={`${docsBase}/OPERATIONS.md`} className="growth-hub-card" target="_blank">
              <span>Operate</span>
              <h2>OPERATIONS.md</h2>
              <p>Daily newsroom operations, monitoring and incident response.</p>
            </Link>
            <Link href={`${docsBase}/BACKUP.md`} className="growth-hub-card" target="_blank">
              <span>Recover</span>
              <h2>BACKUP.md</h2>
              <p>Database, media and configuration backup/restore plan.</p>
            </Link>
            <Link href={`${docsBase}/TROUBLESHOOTING.md`} className="growth-hub-card" target="_blank">
              <span>Fix</span>
              <h2>TROUBLESHOOTING.md</h2>
              <p>Common production failures and safe recovery steps.</p>
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
