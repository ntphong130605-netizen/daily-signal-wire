import Link from "next/link";
import { CopyTextButton } from "@/components/AdminGrowthActions";
import { SocialPostActionButton, SocialQueueCreateForm } from "@/components/AdminSocialActions";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import {
  socialAnalyticsSummary,
  socialPlatforms,
  socialReadiness
} from "@/lib/socialDistribution";

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

function statusClass(status: string) {
  if (status === "published") return "excellent";
  if (status === "queued" || status === "scheduled" || status === "publishing") return "good";
  if (status === "waiting_credentials" || status === "waiting_audience") return "warn";
  return "bad";
}

export default async function AdminSocialPage() {
  const data = await safeDbQuery(
    "admin_social_query_failed",
    {
      posts: [] as { id: string; title: string; slug: string }[],
      socialPosts: [] as {
        id: string;
        platform: string;
        status: string;
        scheduledAt: Date | null;
        publishedAt: Date | null;
        retryCount: number;
        errorMessage: string | null;
        copy: string | null;
        hashtags: string;
        shortSummary: string | null;
        callToAction: string | null;
        utmUrl: string | null;
        trackingUrl: string | null;
        openGraphImage: string | null;
        squareImage: string | null;
        verticalImage: string | null;
        payload: string;
        logs: string;
        externalPostId: string | null;
        clicks: number;
        impressions: number;
        shares: number;
        likes: number;
        comments: number;
        article: { title: string; slug: string; status: string } | null;
      }[]
    },
    async () => {
      const [posts, socialPosts] = await Promise.all([
        prisma.post.findMany({
          where: { status: "published" },
          orderBy: { publishedAt: "desc" },
          select: { id: true, title: true, slug: true },
          take: 100
        }),
        prisma.socialPost.findMany({
          include: { article: { select: { title: true, slug: true, status: true } } },
          orderBy: [{ updatedAt: "desc" }],
          take: 120
        })
      ]);
      return { posts, socialPosts };
    }
  );

  const readiness = socialReadiness();
  const analytics = socialAnalyticsSummary(data.socialPosts);
  const byStatus = data.socialPosts.reduce<Record<string, number>>((accumulator, job) => {
    accumulator[job.status] = (accumulator[job.status] || 0) + 1;
    return accumulator;
  }, {});
  const platformStats = data.socialPosts.reduce<
    Record<string, { jobs: number; clicks: number; shares: number; likes: number; comments: number }>
  >((accumulator, job) => {
    accumulator[job.platform] ||= { jobs: 0, clicks: 0, shares: 0, likes: 0, comments: 0 };
    accumulator[job.platform].jobs += 1;
    accumulator[job.platform].clicks += job.clicks;
    accumulator[job.platform].shares += job.shares;
    accumulator[job.platform].likes += job.likes;
    accumulator[job.platform].comments += job.comments;
    return accumulator;
  }, {});
  const topPlatform = Object.entries(platformStats).sort((a, b) => b[1].clicks - a[1].clicks)[0];

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">AI Social Distribution Platform</p>
          <h1>Social Queue</h1>
          <p>
            Queue published articles across Facebook, X, Threads, LinkedIn,
            Pinterest, Bluesky, newsletters and RSS with credential-safe retries.
          </p>
        </div>
        <div className="header-badge">{data.socialPosts.length} social jobs</div>
      </header>

      <main className="admin-content growth-dashboard">
        <section className="growth-metric-grid social-metric-grid" aria-label="Social metrics">
          <div>
            <p className="eyebrow">Queued</p>
            <h2>{byStatus.queued || 0}</h2>
            <p>Ready to publish when due.</p>
          </div>
          <div>
            <p className="eyebrow">Scheduled</p>
            <h2>{byStatus.scheduled || 0}</h2>
            <p>Waiting for scheduled distribution time.</p>
          </div>
          <div>
            <p className="eyebrow">Published</p>
            <h2>{byStatus.published || 0}</h2>
            <p>Successfully distributed or live through RSS.</p>
          </div>
          <div>
            <p className="eyebrow">Failed / Waiting</p>
            <h2>
              {(byStatus.failed || 0) +
                (byStatus.waiting_credentials || 0) +
                (byStatus.waiting_audience || 0)}
            </h2>
            <p>Retryable failures or missing official credentials.</p>
          </div>
        </section>

        <section className="growth-metric-grid social-metric-grid" aria-label="Social analytics">
          <div>
            <p className="eyebrow">Clicks</p>
            <h2>{analytics.clicks}</h2>
            <p>Tracked through internal redirect URLs.</p>
          </div>
          <div>
            <p className="eyebrow">CTR</p>
            <h2>{analytics.ctr}%</h2>
            <p>Calculated when impression data is available.</p>
          </div>
          <div>
            <p className="eyebrow">Top platform</p>
            <h2>{topPlatform?.[0] || "—"}</h2>
            <p>{topPlatform ? `${topPlatform[1].clicks} tracked clicks` : "No social clicks yet."}</p>
          </div>
          <div>
            <p className="eyebrow">Top article</p>
            <h2>
              {data.socialPosts
                .slice()
                .sort((a, b) => b.clicks - a.clicks)[0]?.article?.title
                ? "Tracked"
                : "—"}
            </h2>
            <p>
              {data.socialPosts.slice().sort((a, b) => b.clicks - a.clicks)[0]?.article?.title ||
                "Traffic back to the website appears here."}
            </p>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Create</p>
              <h2>Queue published article</h2>
            </div>
            <Link href="/admin/settings" className="source-pill">
              Configure credentials →
            </Link>
          </div>
          {data.posts.length === 0 ? (
            <div className="empty-state compact">
              <h3>No published articles</h3>
              <p>Publish an article before creating social queue entries.</p>
            </div>
          ) : (
            <SocialQueueCreateForm
              posts={data.posts}
              platforms={socialPlatforms.map((platform) => platform.platform)}
            />
          )}
        </section>

        <section className="growth-hub-grid">
          {readiness.map((platform) => (
            <article className="growth-channel-card" key={platform.platform}>
              <span className={`growth-status-dot ${platform.configured ? "ok" : "warn"}`} />
              <div>
                <h2>{platform.label}</h2>
                <p>{platform.configured ? "Ready to publish" : "Waiting for credentials"}</p>
                <small>
                  {platform.configured
                    ? "Configured"
                    : `Missing ${platform.missing.join(", ")}`}
                </small>
              </div>
            </article>
          ))}
        </section>

        <section className="panel social-queue-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>Social posts</h2>
            </div>
          </div>
          {data.socialPosts.length === 0 ? (
            <div className="empty-state">
              <h3>No social queue yet</h3>
              <p>Published articles will automatically create social queue entries.</p>
            </div>
          ) : (
            <div className="growth-table social-table">
              <div className="growth-table-head social">
                <span>Article</span>
                <span>Platform</span>
                <span>Status</span>
                <span>Analytics</span>
                <span>Preview / Actions</span>
              </div>
              {data.socialPosts.map((job) => {
                const logs = parseJsonArray<{ at?: string; status?: string; note?: string }>(
                  job.logs
                );
                const hashtags = parseJsonArray<string>(job.hashtags);
                return (
                  <article className="growth-table-row social" key={job.id}>
                    <div>
                      <strong>{job.article?.title || "Article removed"}</strong>
                      <small>
                        /news/{job.article?.slug || "removed"} · retries {job.retryCount}
                      </small>
                      {job.errorMessage && <small className="growth-error">{job.errorMessage}</small>}
                    </div>
                    <span>{job.platform}</span>
                    <span className={`growth-score mini ${statusClass(job.status)}`}>
                      {job.status.replace(/_/g, " ")}
                    </span>
                    <div className="growth-signal-grid">
                      <span>{job.clicks} clicks</span>
                      <span>{job.shares} shares</span>
                      <span>{job.likes} likes</span>
                      <span>{job.comments} comments</span>
                    </div>
                    <div className="social-preview-actions">
                      <details>
                        <summary>Preview</summary>
                        <p>{job.copy || job.shortSummary || "No copy generated yet."}</p>
                        {hashtags.length > 0 && <small>{hashtags.join(" ")}</small>}
                        <small>Scheduled: {formatDate(job.scheduledAt)}</small>
                        {job.publishedAt && <small>Published: {formatDate(job.publishedAt)}</small>}
                        {job.trackingUrl && (
                          <a href={job.trackingUrl} target="_blank" rel="noreferrer">
                            Tracking link
                          </a>
                        )}
                        {job.squareImage && (
                          <a href={job.squareImage} target="_blank" rel="noreferrer">
                            Square image
                          </a>
                        )}
                        {job.verticalImage && (
                          <a href={job.verticalImage} target="_blank" rel="noreferrer">
                            Vertical image
                          </a>
                        )}
                        {logs.slice(0, 4).map((log) => (
                          <small key={`${log.at}-${log.status}`}>
                            {log.status}: {log.note}
                          </small>
                        ))}
                      </details>
                      <div className="growth-row-actions">
                        {job.copy && <CopyTextButton text={job.copy} label="Copy" />}
                        <SocialPostActionButton id={job.id} action="publish_now" label="Publish Now" />
                        <SocialPostActionButton id={job.id} action="retry" label="Retry" />
                        <SocialPostActionButton id={job.id} action="cancel" label="Cancel" />
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
