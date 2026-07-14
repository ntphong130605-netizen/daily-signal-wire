import Link from "next/link";
import { SystemCheckButton } from "@/components/AdminGrowthActions";
import { getProductionReadiness, type OpsStatus } from "@/lib/opsReadiness";

export const dynamic = "force-dynamic";

function statusLabel(status: OpsStatus) {
  switch (status) {
    case "operational":
      return "Operational";
    case "degraded":
      return "Degraded";
    case "waiting":
      return "Waiting for credentials";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

function scoreClass(score: number) {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 45) return "warn";
  return "bad";
}

function renderCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts).filter(([, value]) => value > 0);
  if (entries.length === 0) return <small>No records yet</small>;
  return (
    <div className="growth-signal-grid">
      {entries.map(([key, value]) => (
        <span key={key}>
          {key}: <strong>{value}</strong>
        </span>
      ))}
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function AdminSystemPage() {
  const report = await getProductionReadiness();
  const failedOrWaiting = report.manualTasks.length;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Production Operations</p>
          <h1>Production Readiness Dashboard</h1>
          <p>
            Real-time operational readiness for application, database, AI,
            indexing, AdSense, social distribution, scheduler, cron and image generation.
          </p>
        </div>
        <div className="admin-header-actions">
          <SystemCheckButton />
          <div className={`growth-score ${scoreClass(report.healthScore)}`}>
            {report.healthScore}
          </div>
        </div>
      </header>

      <main className="admin-content growth-dashboard system-dashboard">
        <section className="growth-metric-grid compact">
          <div>
            <span>Health score</span>
            <strong>{report.healthScore}/100</strong>
            <small>{statusLabel(report.status)}</small>
          </div>
          <div>
            <span>Manual tasks</span>
            <strong>{failedOrWaiting}</strong>
            <small>Credentials or provider-side items still waiting.</small>
          </div>
          <div>
            <span>API failures</span>
            <strong>{report.monitoring.failures24h}</strong>
            <small>{report.monitoring.warnings24h} warnings in the last 24 hours.</small>
          </div>
          <div>
            <span>Social jobs</span>
            <strong>{report.costs.socialJobs}</strong>
            <small>Queued, scheduled, published and waiting jobs.</small>
          </div>
        </section>

        <section className="growth-hub-grid">
          {report.checks.map((check) => (
            <article className="growth-channel-card system-check-card" key={check.key}>
              <span
                className={`growth-status-dot ${
                  check.status === "operational" ? "ok" : check.status === "failed" ? "bad" : "warn"
                }`}
              />
              <div>
                <p className="eyebrow">{check.area}</p>
                <h2>{check.label}</h2>
                <p>{check.message}</p>
                <span className={`growth-status-pill status-${check.status}`}>
                  {statusLabel(check.status)}
                </span>
                {check.href && (
                  <Link className="admin-review-link inline" href={check.href}>
                    Open →
                  </Link>
                )}
              </div>
            </article>
          ))}
        </section>

        <div className="admin-two-column">
          <section className="panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Environment</p>
                <h2>Required configuration</h2>
              </div>
              <Link className="source-pill" href="/admin/settings">Settings</Link>
            </div>
            <div className="settings-list compact">
              {report.environment.required.map((item) => (
                <div key={item.key}>
                  <span>{item.key}</span>
                  <strong className={item.configured ? "configured" : "missing"}>
                    {item.configured ? "Configured" : "Waiting for credentials"}
                  </strong>
                  <small>{item.message}</small>
                </div>
              ))}
            </div>
          </section>

          <aside className="admin-side-stack">
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <h2>Cost tracking</h2>
              </div>
              <div className="settings-list compact">
                <div>
                  <span>OpenAI cost</span>
                  <strong>{report.costs.openAiCost}</strong>
                  <small>No fake billing values are generated.</small>
                </div>
                <div>
                  <span>AI writing count</span>
                  <strong>{report.costs.aiWritingCount}</strong>
                  <small>AI-generated articles stored in the database.</small>
                </div>
                <div>
                  <span>Image generations</span>
                  <strong>{report.costs.imageGenerationCount}</strong>
                  <small>{report.costs.estimatedImageCost}</small>
                </div>
                <div>
                  <span>Research jobs</span>
                  <strong>{report.costs.researchJobs}</strong>
                  <small>Research engine runs recorded.</small>
                </div>
                <div>
                  <span>Indexing jobs</span>
                  <strong>{report.costs.indexingJobs}</strong>
                  <small>Google Indexing queue records.</small>
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Queues</p>
              <h2>Operational queues</h2>
            </div>
            <Link className="source-pill" href="/admin/checklist">Launch checklist</Link>
          </div>
          <div className="system-queue-grid">
            <article>
              <h3>Posts</h3>
              {renderCounts(report.queues.posts)}
            </article>
            <article>
              <h3>Images</h3>
              {renderCounts(report.queues.images)}
            </article>
            <article>
              <h3>Indexing</h3>
              {renderCounts(report.queues.indexing)}
            </article>
            <article>
              <h3>Social</h3>
              {renderCounts(report.queues.social)}
            </article>
            <article>
              <h3>Distribution</h3>
              {renderCounts(report.queues.distribution)}
            </article>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Monitoring</p>
              <h2>Latest production signals</h2>
            </div>
            <span className="source-pill">Generated {formatDate(report.generatedAt)}</span>
          </div>
          <div className="growth-table">
            <div className="growth-table-head monitoring">
              <span>Signal</span>
              <span>Status</span>
              <span>Message</span>
              <span>Checked</span>
            </div>
            {report.monitoring.recentSystemChecks.length === 0 ? (
              <div className="empty-state">
                <h3>No monitoring snapshots yet</h3>
                <p>Open Monitoring and run System Check to save the first snapshot.</p>
              </div>
            ) : (
              report.monitoring.recentSystemChecks.map((item) => (
                <article className="growth-table-row monitoring" key={`${item.key}-${item.checkedAt}`}>
                  <strong>{item.key}</strong>
                  <span className={`growth-status-pill status-${item.status}`}>{item.status}</span>
                  <small>{item.message || "No message"}</small>
                  <time>{formatDate(item.checkedAt)}</time>
                </article>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
