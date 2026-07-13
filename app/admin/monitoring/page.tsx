import { SystemCheckButton } from "@/components/AdminGrowthActions";
import { systemChecks } from "@/lib/growth";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

export default async function AdminMonitoringPage() {
  const data = await safeDbQuery(
    "admin_monitoring_query_failed",
    {
      snapshot: [] as { key: string; label: string; status: string; message: string }[],
      history: [] as {
        id: string;
        key: string;
        label: string;
        status: string;
        message: string | null;
        checkedAt: Date;
      }[]
    },
    async () => {
      const [snapshot, history] = await Promise.all([
        systemChecks(),
        prisma.systemStatusCheck.findMany({
          orderBy: { checkedAt: "desc" },
          take: 80
        })
      ]);
      return { snapshot, history };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Monitoring</p>
          <h1>System Status</h1>
          <p>
            Operational checks for cron, publishing queue, OpenAI, Blob
            Storage, database, search index, AdSense and analytics.
          </p>
        </div>
        <SystemCheckButton />
      </header>
      <main className="admin-content growth-dashboard">
        <section className="growth-hub-grid">
          {data.snapshot.length === 0 ? (
            <article className="growth-channel-card">
              <span className="growth-status-dot warn" />
              <div>
                <h2>No database connection</h2>
                <p>Configure DATABASE_URL to store and view health checks.</p>
              </div>
            </article>
          ) : (
            data.snapshot.map((check) => (
              <article className="growth-channel-card" key={check.key}>
                <span
                  className={`growth-status-dot ${
                    ["healthy", "configured", "ready"].includes(check.status) ? "ok" : "warn"
                  }`}
                />
                <div>
                  <h2>{check.label}</h2>
                  <p>{check.message}</p>
                  <small>{check.status}</small>
                </div>
              </article>
            ))
          )}
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">History</p>
              <h2>Recorded checks</h2>
            </div>
          </div>
          {data.history.length === 0 ? (
            <div className="empty-state">
              <h3>No recorded checks</h3>
              <p>Run System Check to save the current status snapshot.</p>
            </div>
          ) : (
            <div className="growth-table">
              <div className="growth-table-head monitoring">
                <span>Service</span>
                <span>Status</span>
                <span>Message</span>
                <span>Checked</span>
              </div>
              {data.history.map((check) => (
                <article className="growth-table-row monitoring" key={check.id}>
                  <strong>{check.label}</strong>
                  <span className={`growth-status-pill status-${check.status}`}>
                    {check.status}
                  </span>
                  <small>{check.message || "No message"}</small>
                  <time>{formatDate(check.checkedAt)}</time>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
