import type { Prisma } from "@prisma/client";
import Link from "next/link";
import AdminStoryActions from "@/components/AdminStoryActions";
import { prisma, safeDbQuery } from "@/lib/prisma";

function formatDate(date: Date | null) {
  if (!date) return "No date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export default async function AdminStoriesPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter = "all", q = "" } = await searchParams;
  const where: Prisma.FeedStoryWhereInput = {
    ...(filter === "unread" ? { isRead: false } : {}),
    ...(filter === "read" ? { isRead: true } : {}),
    ...(filter === "saved" ? { savedBy: { some: {} } } : {}),
    ...(q
      ? {
          OR: [
            { title: { contains: q } },
            { excerpt: { contains: q } },
            { feed: { title: { contains: q } } }
          ]
        }
      : {})
  };
  const { stories, counts } = await safeDbQuery(
    "admin_stories_query_failed",
    { stories: [], counts: [0, 0, 0] as [number, number, number] },
    async () => {
      const [stories, counts] = await Promise.all([
        prisma.feedStory.findMany({
          where,
          include: {
            feed: true,
            savedBy: true,
            tags: true,
            posts: { select: { id: true, slug: true, status: true } }
          },
          orderBy: [{ publishedAt: "desc" }, { fetchedAt: "desc" }],
          take: 200
        }),
        Promise.all([
          prisma.feedStory.count(),
          prisma.feedStory.count({ where: { isRead: false } }),
          prisma.feedStory.count({ where: { savedBy: { some: {} } } })
        ]) as Promise<[number, number, number]>
      ]);

      return { stories, counts };
    }
  );

  const [allCount, unreadCount, savedCount] = counts;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">RSS queue</p>
          <h1>Stories</h1>
          <p>Review RSS items and convert selected stories into original drafts.</p>
        </div>
        <div className="header-badge">{stories.length} shown</div>
      </header>
      <main className="admin-content">
        <section className="admin-post-stats">
          <Link href="/admin/stories">
            <span>All stories</span>
            <strong>{allCount}</strong>
          </Link>
          <Link href="/admin/stories?filter=unread">
            <span>Unread</span>
            <strong>{unreadCount}</strong>
          </Link>
          <Link href="/admin/stories?filter=saved">
            <span>Saved</span>
            <strong>{savedCount}</strong>
          </Link>
          <form action="/admin/stories">
            <input type="search" name="q" defaultValue={q} placeholder="Search stories…" />
            <button>Search</button>
          </form>
        </section>

        <section className="panel admin-story-panel">
          <div className="admin-story-head">
            <span>Story</span>
            <span>Source</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {stories.length === 0 ? (
            <div className="empty-state">
              <h3>No stories found</h3>
              <p>Add RSS feeds, import OPML or clear the current filter.</p>
            </div>
          ) : (
            <div className="admin-story-list">
              {stories.map((story) => (
                <article className="admin-story-row" key={story.id}>
                  <div className="admin-story-title">
                    <div className="admin-story-thumb">
                      {story.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={story.imageUrl} alt="" />
                      ) : (
                        <span>RSS</span>
                      )}
                    </div>
                    <div>
                      <strong>{story.title}</strong>
                      <p>{story.excerpt || "No excerpt supplied by this feed."}</p>
                      <div>
                        {story.tags.map((tag) => (
                          <small key={tag.id}>{tag.name}</small>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="admin-story-source">
                    <span>{story.feed.title}</span>
                    <small>{formatDate(story.publishedAt || story.fetchedAt)}</small>
                    <Link href={`/?story=${story.id}`}>Open in reader</Link>
                  </div>
                  <div className="admin-story-status">
                    <span className={`post-status ${story.isRead ? "post-status-published" : "post-status-draft"}`}>
                      {story.isRead ? "read" : "unread"}
                    </span>
                    {story.savedBy.length > 0 && <small>saved</small>}
                    {story.posts[0] && (
                      <Link href={`/news/${story.posts[0].slug}?preview=1`}>
                        {story.posts[0].status} draft
                      </Link>
                    )}
                  </div>
                  <AdminStoryActions
                    storyId={story.id}
                    title={story.title}
                    hook={story.excerpt || story.feed.title}
                    sourceUrl={story.sourceUrl}
                    aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
                  />
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
