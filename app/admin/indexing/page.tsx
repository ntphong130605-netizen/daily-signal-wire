import Link from "next/link";
import {
  AdminIndexingActions,
  RetryIndexingJobButton
} from "@/components/AdminIndexingActions";
import { googleIndexingReadiness } from "@/lib/googleIndexing";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null | undefined) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function maskEmail(value: string | undefined) {
  if (!value) return "Not configured";
  const [name, domain] = value.split("@");
  if (!domain) return "Configured";
  return `${name.slice(0, 3)}…@${domain}`;
}

export default async function AdminIndexingPage() {
  const readiness = googleIndexingReadiness();
  const data = await safeDbQuery(
    "admin_indexing_query_failed",
    {
      jobs: [],
      totals: { pending: 0, processing: 0, success: 0, failed: 0 },
      latestPublishedUrl: absoluteUrl("/")
    },
    async () => {
      const [jobs, grouped, latestPublished] = await Promise.all([
        prisma.indexingJob.findMany({
          orderBy: { updatedAt: "desc" },
          take: 80
        }),
        prisma.indexingJob.groupBy({
          by: ["status"],
          _count: { _all: true }
        }),
        prisma.post.findFirst({
          where: { status: "published" },
          orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
          select: { slug: true }
        })
      ]);
      const totals = grouped.reduce<Record<string, number>>(
        (accumulator, row) => {
          accumulator[row.status] = row._count._all;
          return accumulator;
        },
        { pending: 0, processing: 0, success: 0, failed: 0 }
      );
      return {
        jobs,
        totals,
        latestPublishedUrl: latestPublished
          ? absoluteUrl(`/news/${latestPublished.slug}`)
          : absoluteUrl("/")
      };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Phase 5.2 · Google Indexing</p>
          <h1>Indexing Center</h1>
          <p>
            Queue published URLs, retry failures and monitor Google Indexing API
            submissions without exposing service-account secrets.
          </p>
        </div>
        <div className={`header-badge ${readiness.configured ? "" : "warning"}`}>
          {readiness.configured ? "Google credentials ready" : readiness.message}
        </div>
      </header>

      <main className="admin-content growth-dashboard indexing-dashboard">
        <section className="growth-metric-grid compact">
          <div>
            <span>Pending</span>
            <strong>{data.totals.pending || 0}</strong>
            <small>Waiting for credentials or queue processing</small>
          </div>
          <div>
            <span>Processing</span>
            <strong>{data.totals.processing || 0}</strong>
            <small>Currently being submitted</small>
          </div>
          <div>
            <span>Success</span>
            <strong>{data.totals.success || 0}</strong>
            <small>Accepted by the Google endpoint</small>
          </div>
          <div>
            <span>Failed</span>
            <strong>{data.totals.failed || 0}</strong>
            <small>Eligible for retry up to five attempts</small>
          </div>
        </section>

        <div className="admin-two-column">
          <section className="panel">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Queue</p>
                <h2>Recent submissions</h2>
              </div>
              <Link className="admin-review-link" href="/api/indexing/status" target="_blank">
                API status →
              </Link>
            </div>
            {data.jobs.length === 0 ? (
              <div className="empty-state">
                <h3>No indexing jobs yet</h3>
                <p>
                  Publishing a post will automatically queue its canonical URL.
                  You can also submit a URL manually from the tools panel.
                </p>
              </div>
            ) : (
              <div className="growth-table indexing-table">
                <div className="growth-table-head indexing">
                  <span>URL</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Attempts</span>
                  <span>Updated</span>
                  <span>Action</span>
                </div>
                {data.jobs.map((job) => (
                  <article className="growth-table-row indexing" key={job.id}>
                    <div>
                      <strong>{job.url.replace(/^https?:\/\//, "")}</strong>
                      <small>{job.lastError || "No errors recorded"}</small>
                    </div>
                    <span>{job.type}</span>
                    <span className={`growth-status-pill status-${job.status}`}>
                      {job.status}
                    </span>
                    <span>{job.attempts}</span>
                    <time>{formatDate(job.updatedAt)}</time>
                    <RetryIndexingJobButton id={job.id} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="admin-side-stack">
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="eyebrow">Configuration</p>
                  <h2>Google credentials</h2>
                </div>
              </div>
              <div className="settings-list compact">
                <div>
                  <span>Status</span>
                  <strong className={readiness.configured ? "configured" : "missing"}>
                    {readiness.configured ? "Ready" : readiness.message}
                  </strong>
                </div>
                <div>
                  <span>Enabled</span>
                  <strong className={readiness.enabled ? "configured" : "missing"}>
                    {readiness.enabled ? "Enabled" : "Disabled"}
                  </strong>
                </div>
                <div>
                  <span>Service account</span>
                  <strong>
                    {readiness.serviceAccountEmailConfigured
                      ? maskEmail(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
                      : "Not configured"}
                  </strong>
                </div>
                <div>
                  <span>Private key</span>
                  <strong className={readiness.privateKeyConfigured ? "configured" : "missing"}>
                    {readiness.privateKeyConfigured ? "Configured" : "Not configured"}
                  </strong>
                </div>
              </div>
            </section>

            <AdminIndexingActions defaultUrl={data.latestPublishedUrl} />

            <section className="panel admin-form-panel settings-note">
              <h2>Important Google note</h2>
              <p>
                Google’s Indexing API is officially limited to JobPosting and
                livestream BroadcastEvent pages. Daily Signal Wire keeps a safe
                queue and submission history, but Google may reject or ignore
                ordinary news article URLs.
              </p>
              <p>
                Keep sitemap.xml, news-sitemap.xml and RSS healthy; those remain
                the primary discovery mechanisms for published articles.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
