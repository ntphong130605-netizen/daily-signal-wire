import AddFeedPanel from "@/components/AddFeedPanel";
import AdminFeedActions from "@/components/AdminFeedActions";
import OpmlImportForm from "@/components/OpmlImportForm";
import Link from "next/link";
import { prisma, safeDbQuery } from "@/lib/prisma";

function dateLabel(date: Date | null) {
  if (!date) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export default async function AdminFeedsPage() {
  const { folders, feeds, storyCount, unreadCount } = await safeDbQuery(
    "admin_feeds_query_failed",
    { folders: [], feeds: [], storyCount: 0, unreadCount: 0 },
    async () => {
      const [folders, feeds, storyCount, unreadCount] = await Promise.all([
        prisma.feedFolder.findMany({ orderBy: { name: "asc" } }),
        prisma.feed.findMany({
          include: {
            folder: true,
            category: true,
            _count: { select: { stories: true } }
          },
          orderBy: { updatedAt: "desc" }
        }),
        prisma.feedStory.count(),
        prisma.feedStory.count({ where: { isRead: false } })
      ]);

      return { folders, feeds, storyCount, unreadCount };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">RSS reader</p>
          <h1>Feeds</h1>
          <p>Add RSS sources, import OPML and fetch metadata safely.</p>
        </div>
        <div className="header-badge">{feeds.length} sources</div>
      </header>
      <main className="admin-content admin-reader-content">
        <section className="admin-post-stats">
          <Link href="/admin/feeds">
            <span>RSS feeds</span>
            <strong>{feeds.length}</strong>
          </Link>
          <Link href="/admin/stories">
            <span>Stories</span>
            <strong>{storyCount}</strong>
          </Link>
          <Link href="/admin/stories?filter=unread">
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </Link>
          <Link href="/api/admin/opml" prefetch={false}>
            <span>Export</span>
            <strong>OPML</strong>
          </Link>
        </section>

        <div className="admin-two-column">
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Sources</p>
                <h2>Feed library</h2>
              </div>
              <span className="source-pill">Cron: every 30 min</span>
            </div>
            {feeds.length === 0 ? (
              <div className="empty-state">
                <h3>No feeds yet</h3>
                <p>Add a feed URL or run the seed command.</p>
              </div>
            ) : (
              <div className="admin-feed-list">
                {feeds.map((feed) => (
                  <article className="admin-feed-row" key={feed.id}>
                    <div>
                      <span>{feed.folder?.name || "Unfoldered"}</span>
                      <strong>{feed.title}</strong>
                      <small>{feed.feedUrl}</small>
                    </div>
                    <div>
                      <span className={`status status-${feed.fetchStatus}`}>
                        {feed.fetchStatus}
                      </span>
                      <small>{feed._count.stories} stories</small>
                    </div>
                    <div>
                      <span>{feed.category?.name || "General"}</span>
                      <small>Fetched {dateLabel(feed.lastFetchedAt)}</small>
                      {feed.lastError && <em>{feed.lastError}</em>}
                    </div>
                    <AdminFeedActions feedId={feed.id} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="admin-side-stack">
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <h2>Add source</h2>
              </div>
              <AddFeedPanel folders={folders.map((folder) => ({ id: folder.id, name: folder.name }))} />
            </section>
            <section className="panel admin-form-panel">
              <div className="panel-heading compact">
                <h2>Import OPML</h2>
              </div>
              <OpmlImportForm />
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
