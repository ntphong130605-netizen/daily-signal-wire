import Link from "next/link";
import { CopyTextButton } from "@/components/AdminGrowthActions";
import {
  SocialPostActionButton,
  SocialQueueControlButton,
  SocialQueueCreateForm,
  SocialVariantSelect
} from "@/components/AdminSocialActions";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import {
  socialAnalyticsSummary,
  socialPlatforms,
  socialQueuePaused,
  socialReadiness
} from "@/lib/socialDistribution";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(value);
}

function statusClass(status: string) {
  if (status === "published") return "excellent";
  if (["queued", "scheduled", "publishing", "preparing"].includes(status)) return "good";
  if (["waiting_credentials", "waiting_audience", "paused", "retry"].includes(status)) return "warn";
  return "bad";
}

export default async function AdminDistributionPage() {
  const data = await safeDbQuery("admin_viral_distribution_query_failed", null, async () => {
    const [posts, socialPosts, paused] = await Promise.all([
      prisma.post.findMany({
        where: { status: "published" },
        orderBy: { publishedAt: "desc" },
        select: { id: true, title: true, slug: true },
        take: 120
      }),
      prisma.socialPost.findMany({
        include: {
          article: { select: { title: true, slug: true, status: true } },
          variants: { orderBy: { createdAt: "asc" } },
          actionLogs: { orderBy: { createdAt: "desc" }, take: 6 }
        },
        orderBy: [{ priority: "asc" }, { updatedAt: "desc" }],
        take: 160
      }),
      socialQueuePaused()
    ]);
    return { posts, socialPosts, paused };
  });

  const posts = data?.posts || [];
  const socialPosts = data?.socialPosts || [];
  const paused = data?.paused || false;
  const readiness = socialReadiness();
  const analytics = socialAnalyticsSummary(socialPosts);
  const byStatus = socialPosts.reduce<Record<string, number>>((accumulator, job) => {
    accumulator[job.status] = (accumulator[job.status] || 0) + 1;
    return accumulator;
  }, {});
  const queueCount = (byStatus.queued || 0) + (byStatus.preparing || 0);

  const cards = [
    ["Queue", queueCount, "Queued and preparing packages"],
    ["Scheduled", byStatus.scheduled || 0, "Timezone-aware future posts"],
    ["Publishing", byStatus.publishing || 0, "Connector requests in progress"],
    ["Published", byStatus.published || 0, "Successful platform deliveries"],
    ["Failed", byStatus.failed || 0, "Attempts that exhausted retries"],
    ["Retry Queue", byStatus.retry || 0, "Backoff retries waiting to run"],
    ["Engagement", analytics.engagement, `${analytics.reach} verified reach`],
    ["CTR", analytics.ctr === null ? "—" : `${analytics.ctr}%`, "Only shown with real impressions"],
    ["Clicks", analytics.clicks, "First-party tracked clicks"],
    ["Shares", analytics.shares, "Platform-reported shares"]
  ] as const;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Phase 5 · AI Viral Distribution Engine</p>
          <h1>Distribution Center</h1>
          <p>
            Prepare, schedule, publish and monitor every approved story across official platform APIs.
            Missing credentials block delivery and never create fake success records.
          </p>
        </div>
        <div className="distribution-header-actions">
          <span className={`header-badge ${paused ? "status-paused" : ""}`}>
            {paused ? "Queue paused" : "Queue active"}
          </span>
          <SocialQueueControlButton paused={paused} />
        </div>
      </header>

      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid distribution-metric-grid" aria-label="Distribution metrics">
          {cards.map(([label, value, note]) => (
            <div key={label}>
              <p className="eyebrow">{label}</p>
              <h2>{value}</h2>
              <p>{note}</p>
            </div>
          ))}
        </section>

        <section className="panel distribution-insight-strip" aria-label="Distribution insights">
          <div>
            <span>Best performing platform</span>
            <strong>{analytics.bestPlatform || "Not enough verified data"}</strong>
          </div>
          <div>
            <span>Best publish hour</span>
            <strong>
              {analytics.bestPublishHour ? `${analytics.bestPublishHour}:00 UTC` : "Not enough verified data"}
            </strong>
          </div>
          <div>
            <span>Waiting for credentials</span>
            <strong>{byStatus.waiting_credentials || 0}</strong>
          </div>
          <div>
            <span>Waiting for audience</span>
            <strong>{byStatus.waiting_audience || 0}</strong>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Automation</p>
              <h2>Prepare a distribution package</h2>
            </div>
            <Link href="/admin/settings" className="source-pill">
              Configure credentials →
            </Link>
          </div>
          {posts.length === 0 ? (
            <div className="empty-state compact">
              <h3>No published articles</h3>
              <p>Publishing an approved article automatically creates its platform packages.</p>
            </div>
          ) : (
            <SocialQueueCreateForm
              posts={posts}
              platforms={socialPlatforms.map((platform) => platform.platform)}
            />
          )}
        </section>

        <section className="growth-hub-grid" aria-label="Platform credentials">
          {readiness.map((platform) => (
            <article className="growth-channel-card" key={platform.platform}>
              <span className={`growth-status-dot ${platform.configured ? "ok" : "warn"}`} />
              <div>
                <h2>{platform.label}</h2>
                <p>{platform.configured ? "Ready to publish" : "Credential Missing"}</p>
                <small>
                  {platform.configured ? "Official connector configured" : platform.missing.join(", ")}
                </small>
              </div>
            </article>
          ))}
        </section>

        <section className="panel social-queue-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Priority queue</p>
              <h2>Distribution packages</h2>
            </div>
            <span className="source-pill">{socialPosts.length} jobs</span>
          </div>
          {socialPosts.length === 0 ? (
            <div className="empty-state">
              <h3>No distribution jobs</h3>
              <p>The first published article will create real queue entries for every platform.</p>
            </div>
          ) : (
            <div className="growth-table social-table distribution-v2-table">
              <div className="growth-table-head social">
                <span>Article</span>
                <span>Platform</span>
                <span>Status</span>
                <span>Performance</span>
                <span>Preview / Actions</span>
              </div>
              {socialPosts.map((job) => {
                const hashtags = parseJsonArray<string>(job.hashtags);
                return (
                  <article className="growth-table-row social" key={job.id}>
                    <div>
                      <strong>{job.article?.title || "Article removed"}</strong>
                      <small>
                        Priority {job.priority} · {job.timezone} · {job.recurrence}
                      </small>
                      <small>
                        Scheduled: {formatDate(job.scheduledAt)} · attempts {job.retryCount}/{job.maxRetries}
                      </small>
                      {job.errorMessage && <small className="growth-error">{job.errorMessage}</small>}
                    </div>
                    <span>{job.platform}</span>
                    <span className={`growth-score mini ${statusClass(job.status)}`}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                    <div className="growth-signal-grid">
                      <span>{job.clicks} clicks</span>
                      <span>{job.impressions} impressions</span>
                      <span>{job.reach} reach</span>
                      <span>{job.shares} shares</span>
                    </div>
                    <div className="social-preview-actions">
                      <SocialVariantSelect
                        id={job.id}
                        value={job.selectedVariantKey}
                        variants={job.variants.map((variant) => ({
                          variantKey: variant.variantKey,
                          label: `${variant.label}${variant.isWinner ? " · winner" : ""}`
                        }))}
                      />
                      <details>
                        <summary>Preview package</summary>
                        <p>{job.copy || job.shortSummary || "Copy is still preparing."}</p>
                        {hashtags.length > 0 && <small>{hashtags.join(" ")}</small>}
                        {job.facebookImage && <a href={job.facebookImage}>Facebook crop</a>}
                        {job.twitterImage && <a href={job.twitterImage}>X crop</a>}
                        {job.linkedinImage && <a href={job.linkedinImage}>LinkedIn crop</a>}
                        {job.pinterestImage && <a href={job.pinterestImage}>Pinterest crop</a>}
                        {job.variants.map((variant) => (
                          <small key={variant.id}>
                            {variant.label}: {variant.clicks} clicks
                            {variant.impressions > 0
                              ? ` · ${((variant.clicks / variant.impressions) * 100).toFixed(2)}% CTR`
                              : ""}
                          </small>
                        ))}
                        {job.actionLogs.map((log) => (
                          <small key={log.id}>
                            {log.action}: {log.message}
                          </small>
                        ))}
                      </details>
                      <div className="growth-row-actions">
                        {job.copy && <CopyTextButton text={job.copy} label="Copy" />}
                        {!['published', 'cancelled'].includes(job.status) && (
                          <SocialPostActionButton id={job.id} action="publish_now" label="Publish Now" />
                        )}
                        {job.status === "paused" ? (
                          <SocialPostActionButton id={job.id} action="resume" label="Resume" />
                        ) : !['published', 'cancelled'].includes(job.status) ? (
                          <SocialPostActionButton id={job.id} action="pause" label="Pause" />
                        ) : null}
                        {['failed', 'retry', 'waiting_credentials', 'waiting_audience'].includes(job.status) && (
                          <SocialPostActionButton id={job.id} action="retry" label="Retry" />
                        )}
                        {!['published', 'cancelled'].includes(job.status) && (
                          <SocialPostActionButton id={job.id} action="cancel" label="Cancel" />
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
