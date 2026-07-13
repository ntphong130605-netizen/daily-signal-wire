import Link from "next/link";
import {
  CopyTextButton,
  DistributionCreateForm,
  DistributionJobButton
} from "@/components/AdminGrowthActions";
import {
  channelConfigured,
  distributionPlatforms,
  ensureDistributionChannels
} from "@/lib/growth";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

export default async function AdminDistributionPage() {
  const data = await safeDbQuery(
    "admin_distribution_query_failed",
    {
      posts: [] as { id: string; title: string; slug: string }[],
      jobs: [] as {
        id: string;
        platform: string;
        mode: string;
        status: string;
        scheduledAt: Date | null;
        publishedAt: Date | null;
        retryCount: number;
        lastError: string | null;
        message: string | null;
        post: { title: string; slug: string; status: string } | null;
      }[],
      channels: [] as {
        platform: string;
        label: string;
        enabled: boolean;
        status: string;
        configStatus: string;
      }[]
    },
    async () => {
      await ensureDistributionChannels();
      const [posts, jobs, channels] = await Promise.all([
        prisma.post.findMany({
          where: { status: { in: ["published", "approved", "scheduled"] } },
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, slug: true },
          take: 80
        }),
        prisma.distributionPublish.findMany({
          include: { post: { select: { title: true, slug: true, status: true } } },
          orderBy: { updatedAt: "desc" },
          take: 80
        }),
        prisma.distributionChannel.findMany({ orderBy: { platform: "asc" } })
      ]);
      return { posts, jobs, channels };
    }
  );
  const channelRows =
    data.channels.length > 0
      ? data.channels
      : distributionPlatforms.map((item) => ({
          platform: item.platform,
          label: item.label,
          enabled: channelConfigured(item.platform),
          status: channelConfigured(item.platform) ? "ready" : "not_configured",
          configStatus: channelConfigured(item.platform)
            ? "configured"
            : "missing_credentials"
        }));

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Traffic Engine</p>
          <h1>Distribution Center</h1>
          <p>
            Queue articles for Facebook, X, LinkedIn, Pinterest, Threads,
            Bluesky, RSS and newsletters. Missing credentials block external
            publishing instead of faking success.
          </p>
        </div>
        <div className="header-badge">{data.jobs.length} jobs</div>
      </header>
      <main className="admin-content growth-dashboard">
        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Create</p>
              <h2>New distribution job</h2>
            </div>
            <Link href="/admin/settings" className="source-pill">
              Configure env →
            </Link>
          </div>
          {data.posts.length === 0 ? (
            <div className="empty-state compact">
              <h3>No eligible articles</h3>
              <p>Publish, approve or schedule an article before distributing it.</p>
            </div>
          ) : (
            <DistributionCreateForm
              posts={data.posts}
              platforms={distributionPlatforms.map((item) => item.platform)}
            />
          )}
        </section>

        <section className="growth-hub-grid">
          {channelRows.map((channel) => (
            <article className="growth-channel-card" key={channel.platform}>
              <span className={`growth-status-dot ${channel.enabled ? "ok" : "warn"}`} />
              <div>
                <h2>{channel.label}</h2>
                <p>{channel.enabled ? "Ready for queueing" : "Credentials missing"}</p>
                <small>
                  {channel.status} · {channel.configStatus}
                </small>
              </div>
            </article>
          ))}
        </section>

        <section className="panel distribution-job-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">History</p>
              <h2>Publish jobs</h2>
            </div>
          </div>
          {data.jobs.length === 0 ? (
            <div className="empty-state">
              <h3>No distribution history</h3>
              <p>Create a job to track publish attempts, retries and blocked channels.</p>
            </div>
          ) : (
            <div className="growth-table">
              <div className="growth-table-head distribution">
                <span>Article</span>
                <span>Platform</span>
                <span>Status</span>
                <span>Schedule</span>
                <span>Actions</span>
              </div>
              {data.jobs.map((job) => (
                <article className="growth-table-row distribution" key={job.id}>
                  <div>
                    <strong>{job.post?.title || "Post removed"}</strong>
                    <small>{job.mode} · retries {job.retryCount}</small>
                    {job.lastError && <small className="growth-error">{job.lastError}</small>}
                  </div>
                  <span>{job.platform}</span>
                  <span className={`growth-status-pill status-${job.status}`}>
                    {job.status}
                  </span>
                  <span>
                    {formatDate(job.scheduledAt)}
                    {job.publishedAt ? ` · sent ${formatDate(job.publishedAt)}` : ""}
                  </span>
                  <div className="growth-row-actions">
                    {job.message && <CopyTextButton text={job.message} label="Copy post" />}
                    <DistributionJobButton id={job.id} action="retry" label="Retry" />
                    <DistributionJobButton id={job.id} action="mark_sent" label="Mark sent" />
                    <DistributionJobButton id={job.id} action="mark_failed" label="Mark failed" />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
