import Link from "next/link";
import AdminPostActions from "@/components/AdminPostActions";
import { prisma, safeDbQuery } from "@/lib/prisma";

export default async function AdminPostsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { status = "all", q = "" } = await searchParams;
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const { posts, draftCount, publishedCount, rejectedCount, scheduledCount } = await safeDbQuery(
    "admin_posts_query_failed",
    {
      posts: [],
      draftCount: 0,
      publishedCount: 0,
      rejectedCount: 0,
      scheduledCount: 0
    },
    async () => {
      const posts = await prisma.post.findMany({
        where: {
          ...(status !== "all" ? { status } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q } },
                  { excerpt: { contains: q } },
                  { slug: { contains: q } }
                ]
              }
            : {})
        },
        include: { trend: { select: { category: true } } },
        orderBy: { updatedAt: "desc" },
        take: 200
      });
      const [draftCount, publishedCount, rejectedCount, scheduledCount] = await Promise.all([
        prisma.post.count({ where: { status: "draft" } }),
        prisma.post.count({ where: { status: "published" } }),
        prisma.post.count({ where: { status: "rejected" } }),
        prisma.post.count({ where: { status: "scheduled" } })
      ]);

      return { posts, draftCount, publishedCount, rejectedCount, scheduledCount };
    }
  );
  const totalCount = draftCount + publishedCount + rejectedCount + scheduledCount;

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Editorial inventory</p>
          <h1>Posts</h1>
          <p>Review, preview and publish every story from one place.</p>
        </div>
        <div className="header-badge">{posts.length} shown</div>
      </header>
      <main className="admin-content">
        <section className="admin-post-stats">
          <Link href="/admin/posts?status=all">
            <span>All posts</span>
            <strong>{totalCount}</strong>
          </Link>
          <Link href="/admin/posts?status=draft">
            <span>Drafts</span>
            <strong>{draftCount}</strong>
          </Link>
          <Link href="/admin/posts?status=published">
            <span>Published</span>
            <strong>{publishedCount}</strong>
          </Link>
          <Link href="/admin/posts?status=rejected">
            <span>Rejected</span>
            <strong>{rejectedCount}</strong>
          </Link>
          <Link href="/admin/posts?status=scheduled">
            <span>Scheduled</span>
            <strong>{scheduledCount}</strong>
          </Link>
          <form action="/admin/posts">
            <input type="search" name="q" defaultValue={q} placeholder="Search posts…" />
            <button>Search</button>
          </form>
        </section>

        <section className="panel admin-posts-panel">
          <div className="admin-posts-head">
            <span>Story</span>
            <span>Status</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          {posts.length === 0 ? (
            <div className="empty-state">
              <h3>No matching posts</h3>
              <p>Try a different status or search term.</p>
            </div>
          ) : (
            <div className="admin-posts-list">
              {posts.map((post) => (
                <article className="admin-post-row" key={post.id}>
                  <div className="admin-post-story">
                    <div className="admin-post-thumb">
                      {post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            post.featuredImageUrl ||
                            post.featuredImage ||
                            post.imageUrl ||
                            post.thumbnailImage ||
                            ""
                          }
                          alt={post.imageAlt || post.title}
                        />
                      ) : (
                        <span>DS</span>
                      )}
                    </div>
                    <div>
                      <span>{post.trend?.category || "Latest"}</span>
                      <strong>{post.title}</strong>
                      <small>
                        {post.slug} · Fact-check: {post.factCheckStatus}
                        {post.trustScore !== null ? ` · ${post.trustScore}` : ""}
                      </small>
                    </div>
                  </div>
                  <span className={`post-status post-status-${post.status}`}>
                    {post.status}
                  </span>
                  <time dateTime={post.updatedAt.toISOString()}>
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit"
                    }).format(post.updatedAt)}
                  </time>
                  <AdminPostActions
                    id={post.id}
                    slug={post.slug}
                    title={post.title}
                    hook={post.facebookCaption || post.excerpt}
                    status={post.status}
                    aiConfigured={aiConfigured}
                    imageStatus={post.imageStatus}
                    hasImage={Boolean(
                      post.imageUrl ||
                        post.featuredImageUrl ||
                        post.featuredImage ||
                        post.thumbnailImage ||
                        post.openGraphImage ||
                        post.twitterImage
                    )}
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
