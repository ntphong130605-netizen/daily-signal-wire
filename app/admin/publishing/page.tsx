import Link from "next/link";
import AdminPublishingActions from "@/components/AdminPublishingActions";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { publishStatusLabel } from "@/lib/publishing";

export const dynamic = "force-dynamic";

function toInputDate(value: Date | null | undefined) {
  if (!value) return "";
  return new Date(value.getTime() - value.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(value);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function hasImage(post: {
  imageStatus: string;
  imageUrl: string | null;
  featuredImageUrl: string | null;
  featuredImage: string | null;
  thumbnailImage: string | null;
  openGraphImage: string | null;
}) {
  return (
    post.imageStatus === "accepted" &&
    Boolean(
      post.featuredImageUrl ||
        post.featuredImage ||
        post.imageUrl ||
        post.thumbnailImage ||
        post.openGraphImage
    )
  );
}

function metadataChecklist(post: {
  seoTitle: string;
  seoDescription: string;
  openGraphDescription: string | null;
  faq: string;
  slug: string;
}) {
  const faq = parseJsonArray(post.faq);
  return [
    ["SEO", Boolean(post.seoTitle && post.seoDescription)],
    ["OpenGraph", Boolean(post.openGraphDescription)],
    ["FAQ", faq.length >= 3],
    ["Canonical", Boolean(post.slug)]
  ] as const;
}

export default async function AdminPublishingPage() {
  const now = new Date();
  const today = startOfToday();
  const data = await safeDbQuery(
    "admin_publishing_query_failed",
    {
      posts: [],
      notifications: [],
      upcomingCount: 0,
      scheduledCount: 0,
      publishedTodayCount: 0,
      failedCount: 0,
      draftCount: 0,
      approvalQueueCount: 0
    },
    async () => {
      const [
        posts,
        notifications,
        upcomingCount,
        scheduledCount,
        publishedTodayCount,
        failedCount,
        draftCount,
        approvalQueueCount
      ] = await Promise.all([
        prisma.post.findMany({
          where: {
            status: {
              in: [
                "draft",
                "pending_review",
                "approved",
                "scheduled",
                "publishing",
                "rejected"
              ]
            }
          },
          include: {
            category: { select: { name: true } },
            statusEvents: {
              orderBy: { createdAt: "desc" },
              take: 6
            },
            approvalEvents: {
              orderBy: { createdAt: "desc" },
              take: 6
            }
          },
          orderBy: [{ publishAt: "asc" }, { updatedAt: "desc" }],
          take: 80
        }),
        prisma.editorialNotification.findMany({
          orderBy: { createdAt: "desc" },
          take: 8
        }),
        prisma.post.count({
          where: {
            status: "scheduled",
            OR: [{ publishAt: { gte: now } }, { scheduledAt: { gte: now } }]
          }
        }),
        prisma.post.count({ where: { status: "scheduled" } }),
        prisma.post.count({
          where: { status: "published", publishedAt: { gte: today } }
        }),
        prisma.post.count({ where: { publishError: { not: null } } }),
        prisma.post.count({ where: { status: { in: ["draft", "pending_review"] } } }),
        prisma.post.count({
          where: {
            status: { in: ["draft", "pending_review"] },
            approvalStatus: { not: "approved" }
          }
        })
      ]);
      return {
        posts,
        notifications,
        upcomingCount,
        scheduledCount,
        publishedTodayCount,
        failedCount,
        draftCount,
        approvalQueueCount
      };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Phase 3.5 · Auto Publisher</p>
          <h1>Publishing Center</h1>
          <p>
            Approve, schedule and publish AI newsroom drafts with fact-check,
            image, SEO and schema safety gates.
          </p>
        </div>
        <div className="header-badge">Editor approval required</div>
      </header>
      <main className="admin-content publishing-center">
        <section className="admin-post-stats publishing-stats">
          <Link href="/admin/publishing">
            <span>Upcoming posts</span>
            <strong>{data.upcomingCount}</strong>
          </Link>
          <Link href="/admin/publishing">
            <span>Scheduled queue</span>
            <strong>{data.scheduledCount}</strong>
          </Link>
          <Link href="/admin/posts?status=published">
            <span>Published today</span>
            <strong>{data.publishedTodayCount}</strong>
          </Link>
          <Link href="/admin/publishing">
            <span>Failed publishes</span>
            <strong>{data.failedCount}</strong>
          </Link>
          <Link href="/admin/posts?status=draft">
            <span>Draft count</span>
            <strong>{data.draftCount}</strong>
          </Link>
          <Link href="/admin/publishing">
            <span>Approval queue</span>
            <strong>{data.approvalQueueCount}</strong>
          </Link>
        </section>

        <section className="panel publishing-notifications">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Notifications</p>
              <h2>Editorial alerts</h2>
            </div>
            <span>{data.notifications.length} latest</span>
          </div>
          {data.notifications.length === 0 ? (
            <div className="empty-state compact">
              <h3>No publishing alerts yet</h3>
              <p>Draft, image, fact-check and publish events will appear here.</p>
            </div>
          ) : (
            <div className="publishing-alert-list">
              {data.notifications.map((notification) => (
                <article
                  className={`publishing-alert severity-${notification.severity}`}
                  key={notification.id}
                >
                  <span>{notification.severity}</span>
                  <div>
                    <strong>{notification.title}</strong>
                    <p>{notification.message}</p>
                    <small>{formatDate(notification.createdAt)}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel publishing-queue-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Queue</p>
              <h2>Editor review and schedule</h2>
            </div>
            <Link className="admin-review-link" href="/admin/posts">
              All posts →
            </Link>
          </div>
          {data.posts.length === 0 ? (
            <div className="empty-state">
              <h3>No posts in the publishing queue</h3>
              <p>Generate an AI draft from Research, Trends or RSS Stories to begin.</p>
            </div>
          ) : (
            <div className="publishing-queue-list">
              {data.posts.map((post) => {
                const checklist = metadataChecklist(post);
                const imageReady = hasImage(post);
                const factReady =
                  !post.aiGenerated ||
                  (post.factCheckStatus === "Verified" && (post.trustScore ?? 0) >= 75);
                return (
                  <article className="publishing-card" key={post.id}>
                    <div className="publishing-card-main">
                      <div className="publishing-card-header">
                        <div>
                          <p className="eyebrow">
                            {post.category?.name || "Latest"} ·{" "}
                            {post.aiGenerated ? "AI draft" : "Editorial"}
                          </p>
                          <Link className="research-title" href={`/admin/posts/${post.id}`}>
                            {post.title}
                          </Link>
                        </div>
                        <span className={`post-status post-status-${post.status}`}>
                          {publishStatusLabel(post.status)}
                        </span>
                      </div>
                      <p>{post.excerpt}</p>
                      <div className="publishing-meta-grid">
                        <span>
                          <strong>Publish at</strong>
                          {formatDate(post.publishAt || post.scheduledAt)}
                        </span>
                        <span>
                          <strong>Timezone</strong>
                          {post.timezone || "UTC"}
                        </span>
                        <span>
                          <strong>Approved</strong>
                          {post.approvedAt ? formatDate(post.approvedAt) : "Not approved"}
                        </span>
                        <span>
                          <strong>Fact check</strong>
                          {post.factCheckStatus} {post.trustScore ?? "—"}
                        </span>
                      </div>
                      {post.publishError && (
                        <div className="error-banner">{post.publishError}</div>
                      )}
                      <ul className="publish-checklist compact">
                        <li className={imageReady ? "done" : "needs-review"}>
                          <span>{imageReady ? "✓" : "!"}</span> Hero image
                        </li>
                        <li className={factReady ? "done" : "needs-review"}>
                          <span>{factReady ? "✓" : "!"}</span> Fact check
                        </li>
                        {checklist.map(([label, ok]) => (
                          <li key={label} className={ok ? "done" : "needs-review"}>
                            <span>{ok ? "✓" : "!"}</span> {label}
                          </li>
                        ))}
                      </ul>
                      <details className="publishing-history">
                        <summary>History</summary>
                        <div className="publishing-history-grid">
                          <div>
                            <h3>Status history</h3>
                            {post.statusEvents.length === 0 ? (
                              <p>No status events recorded yet.</p>
                            ) : (
                              <ol>
                                {post.statusEvents.map((event) => (
                                  <li key={event.id}>
                                    <strong>{publishStatusLabel(event.toStatus)}</strong>
                                    <span>
                                      {event.action} · {event.actor || "system"} ·{" "}
                                      {formatDate(event.createdAt)}
                                    </span>
                                    {event.note && <small>{event.note}</small>}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                          <div>
                            <h3>Approval history</h3>
                            {post.approvalEvents.length === 0 ? (
                              <p>No approval events recorded yet.</p>
                            ) : (
                              <ol>
                                {post.approvalEvents.map((event) => (
                                  <li key={event.id}>
                                    <strong>{event.action}</strong>
                                    <span>
                                      {event.actor || "system"} · {formatDate(event.createdAt)}
                                    </span>
                                    {event.note && <small>{event.note}</small>}
                                  </li>
                                ))}
                              </ol>
                            )}
                          </div>
                        </div>
                      </details>
                    </div>
                    <AdminPublishingActions
                      postId={post.id}
                      slug={post.slug}
                      title={post.title}
                      status={post.status}
                      initialScheduleAt={toInputDate(post.publishAt || post.scheduledAt)}
                      initialTimezone={post.timezone || "UTC"}
                    />
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
