import Link from "next/link";
import AddFeedPanel from "@/components/AddFeedPanel";
import AdSlot from "@/components/ads/AdSlot";
import { ArticleImage, type ReaderPost } from "@/components/ArticleCard";
import InfinitePostFeed from "@/components/InfinitePostFeed";
import Logo from "@/components/Logo";
import NewsletterCard from "@/components/NewsletterCard";
import ReaderThemeToggle from "@/components/ReaderThemeToggle";
import StoryActions from "@/components/StoryActions";

export type ReaderFolder = {
  id: string;
  name: string;
  color: string | null;
  feeds: {
    id: string;
    title: string;
    fetchStatus: string;
    unreadCount: number;
    storyCount: number;
  }[];
};

export type ReaderStory = {
  id: string;
  title: string;
  excerpt: string;
  content: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  publishedAt: Date | null;
  fetchedAt: Date;
  isRead: boolean;
  isSaved: boolean;
  feedTitle: string;
  feedId: string;
  folderId: string | null;
  tags: string[];
};

type ReaderFilters = {
  filter: string;
  feed?: string;
  folder?: string;
  story?: string;
  q?: string;
  view: "list" | "grid" | "split" | "magazine";
};

function timeAgo(date: Date | null | undefined) {
  if (!date) return "No date";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function withQuery(filters: ReaderFilters, patch: Partial<ReaderFilters>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...patch };
  for (const [key, value] of Object.entries(next)) {
    if (value && value !== "all" && value !== "list") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export default function NewsReaderLayout({
  folders,
  stories,
  selectedStory,
  filters,
  counts,
  draftCount,
  aiConfigured,
  publishedPosts
}: {
  folders: ReaderFolder[];
  stories: ReaderStory[];
  selectedStory: ReaderStory | null;
  filters: ReaderFilters;
  counts: {
    all: number;
    unread: number;
    saved: number;
    trending: number;
  };
  draftCount: number;
  aiConfigured: boolean;
  publishedPosts: ReaderPost[];
}) {
  const folderOptions = folders.map((folder) => ({ id: folder.id, name: folder.name }));
  const story = selectedStory || stories[0] || null;
  const activeStoryId = story?.id;
  const featuredPost = publishedPosts[0] || null;
  const secondaryPosts = publishedPosts.slice(1, 4);
  const latestUpdates = stories.slice(0, 5);
  const mostRead = publishedPosts.slice(0, 5);
  const breakingItems = (publishedPosts.length
    ? publishedPosts.slice(0, 5).map((post) => ({
        id: post.id,
        title: post.title,
        href: `/news/${post.slug}`,
        label: post.category
      }))
    : stories.slice(0, 5).map((item) => ({
        id: item.id,
        title: item.title,
        href: withQuery(filters, { story: item.id }),
        label: item.feedTitle
      })));
  const trendingTopics = [
    ...new Set([
      ...publishedPosts.map((post) => post.category),
      ...stories.flatMap((item) => item.tags),
      "US News",
      "Technology",
      "Business",
      "World"
    ])
  ].filter(Boolean).slice(0, 14);
  const categories = [
    "US Trending",
    "Technology",
    "Business",
    "Science",
    "World",
    "Sports",
    "Entertainment"
  ];
  const categorySections = categories
    .map((category) => ({
      category,
      posts: publishedPosts.filter((post) => {
        const value = post.category.toLowerCase();
        const target = category.toLowerCase();
        if (target === "us trending") return value.includes("us") || value.includes("trend");
        return value.includes(target);
      })
    }))
    .filter((section) => section.posts.length > 0);
  const serializedPublishedPosts = publishedPosts.map((post) => ({
    ...post,
    publishedAt: post.publishedAt?.toISOString() || null,
    createdAt: post.createdAt.toISOString()
  }));

  return (
    <div className="news-reader-app">
      <header className="reader-app-header">
        <Logo href="/" />
        <div className="reader-header-meta">
          <span>US signals · RSS reader · AI drafts</span>
          <strong>Source-first newsroom</strong>
        </div>
        <form className="reader-global-search" action="/">
          <input type="search" name="q" defaultValue={filters.q || ""} placeholder="Search stories…" />
          <input type="hidden" name="filter" value={filters.filter} />
          <button>Search</button>
        </form>
        <ReaderThemeToggle />
        <Link className="reader-admin-link" href="/admin">
          Admin
        </Link>
      </header>

      <AdSlot position="top" className="reader-top-ad" />

      {breakingItems.length > 0 && (
        <section className="breaking-ticker" aria-label="Breaking news ticker">
          <strong>Breaking</strong>
          <div className="breaking-track">
            {[...breakingItems, ...breakingItems].map((item, index) => (
              <Link key={`${item.id}-${index}`} href={item.href}>
                <span>{item.label}</span>
                {item.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      {featuredPost && (
        <section className="published-wire-hero">
          <div className="published-wire-copy">
            <p className="reader-mini-label">Published AI Wire</p>
            <h1>
              <Link href={`/news/${featuredPost.slug}`}>{featuredPost.title}</Link>
            </h1>
            <div className="published-wire-meta">
              <span>{featuredPost.source || "Daily Signal Wire"}</span>
              <time>{timeAgo(featuredPost.publishedAt || featuredPost.createdAt)}</time>
              <span>{featuredPost.relatedCount ?? secondaryPosts.length} related</span>
            </div>
            <p>{featuredPost.excerpt}</p>
            <Link className="read-story-link" href={`/news/${featuredPost.slug}`}>
              Read the full story <span>→</span>
            </Link>
          </div>
          <Link className="published-wire-image-link" href={`/news/${featuredPost.slug}`}>
            <ArticleImage post={featuredPost} className="published-wire-image" />
          </Link>
          {secondaryPosts.length > 0 && (
            <div className="published-wire-strip">
              {secondaryPosts.map((post) => (
                <Link key={post.id} href={`/news/${post.slug}`}>
                  <span>{post.category}</span>
                  <strong>{post.title}</strong>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="reader-news-sections">
        <div className="reader-section-heading">
          <div>
            <p className="reader-mini-label">Trending section</p>
            <h2>What readers are following</h2>
          </div>
          <Link href="/?filter=trending">View US trending</Link>
        </div>
        <div className="trending-topic-carousel" aria-label="Trending topics">
          {trendingTopics.map((topic) => (
            <Link key={topic} href={`/?q=${encodeURIComponent(topic)}`}>
              <span>#</span>
              {topic}
            </Link>
          ))}
        </div>
        <div className="reader-topic-grid">
          {(publishedPosts.length ? publishedPosts.slice(0, 6) : secondaryPosts).map((post) => (
            <Link key={post.id} href={`/news/${post.slug}`} className="topic-card">
              <span>{post.category}</span>
              <strong>{post.title}</strong>
              <small>{timeAgo(post.publishedAt || post.createdAt)}</small>
            </Link>
          ))}
        </div>
        {categorySections.map((section) => (
          <div className="category-rail" key={section.category}>
            <div className="reader-section-heading compact">
              <h2>{section.category}</h2>
              <Link href={`/category/${section.category.toLowerCase().replaceAll(" ", "-")}`}>
                More
              </Link>
            </div>
            <div className="category-rail-list">
              {section.posts.slice(0, 4).map((post) => (
                <Link key={post.id} href={`/news/${post.slug}`}>
                  <ArticleImage post={post} />
                  <strong>{post.title}</strong>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <main className="news-reader-grid">
        <aside className="reader-source-column">
          <section className="reader-filter-card">
            <p className="reader-mini-label">Filters</p>
            <Link className={filters.filter === "all" ? "active" : ""} href={withQuery(filters, { filter: "all", feed: undefined, folder: undefined, story: undefined })}>
              <span>All</span>
              <strong>{counts.all}</strong>
            </Link>
            <Link className={filters.filter === "unread" ? "active" : ""} href={withQuery(filters, { filter: "unread", story: undefined })}>
              <span>Unread</span>
              <strong>{counts.unread}</strong>
            </Link>
            <Link className={filters.filter === "saved" ? "active" : ""} href={withQuery(filters, { filter: "saved", story: undefined })}>
              <span>Saved</span>
              <strong>{counts.saved}</strong>
            </Link>
            <Link className={filters.filter === "trending" ? "active" : ""} href={withQuery(filters, { filter: "trending", story: undefined })}>
              <span>Trending</span>
              <strong>{counts.trending}</strong>
            </Link>
            <Link href="/admin/posts?status=draft">
              <span>AI Drafts</span>
              <strong>{draftCount}</strong>
            </Link>
          </section>

          <AddFeedPanel folders={folderOptions} />

          <section className="reader-folders">
            <div className="reader-section-heading">
              <p className="reader-mini-label">Folders & sources</p>
              <Link href="/admin/feeds">Manage</Link>
            </div>
            {folders.length === 0 ? (
              <div className="reader-empty-mini">No feeds yet. Add one above or run seed.</div>
            ) : (
              folders.map((folder) => (
                <div className="reader-folder" key={folder.id}>
                  <Link
                    className={`reader-folder-name ${filters.folder === folder.id ? "active" : ""}`}
                    href={withQuery(filters, { folder: folder.id, feed: undefined, story: undefined })}
                  >
                    <span style={{ background: folder.color || "#22a6b3" }} />
                    {folder.name}
                  </Link>
                  <div className="reader-feed-list">
                    {folder.feeds.map((feed) => (
                      <Link
                        className={filters.feed === feed.id ? "active" : ""}
                        href={withQuery(filters, { feed: feed.id, folder: undefined, story: undefined })}
                        key={feed.id}
                      >
                        <span>{feed.title}</span>
                        <small>{feed.unreadCount || feed.storyCount}</small>
                      </Link>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        </aside>

        <section className="reader-story-column">
          <div className="story-column-toolbar">
            <div>
              <p className="reader-mini-label">Stories</p>
              <h1>{filters.q ? `Search: ${filters.q}` : "Latest from your feeds"}</h1>
            </div>
            <div className="view-mode-tabs">
              {(["list", "grid", "split", "magazine"] as const).map((view) => (
                <Link
                  className={filters.view === view ? "active" : ""}
                  href={withQuery(filters, { view })}
                  key={view}
                >
                  {view}
                </Link>
              ))}
            </div>
          </div>

          {stories.length === 0 ? (
            <div className="reader-empty-state compact">
              <div className="empty-signal">
                <span />
                <span />
                <span />
              </div>
              <h2>No stories match this view.</h2>
              <p>Add RSS feeds, import OPML, or clear the current filter.</p>
            </div>
          ) : (
            <div className={`story-list story-list-${filters.view}`}>
              {stories.map((item, index) => (
                <div key={item.id} className="story-row-wrapper">
                  {index === 6 && stories.length >= 9 && (
                    <AdSlot position="feed" className="reader-feed-ad" />
                  )}
                  <Link
                    className={`story-row ${item.id === activeStoryId ? "active" : ""} ${item.isRead ? "read" : "unread"}`}
                    href={withQuery(filters, { story: item.id })}
                  >
                    <div className="story-row-image">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span>DSW</span>
                      )}
                    </div>
                    <div className="story-row-copy">
                      <div className="story-row-meta">
                        <span>{item.feedTitle}</span>
                        <time>{timeAgo(item.publishedAt || item.fetchedAt)}</time>
                      </div>
                      <h2>{item.title}</h2>
                      <p>{item.excerpt || "Open the original source for more context."}</p>
                      <div className="story-row-tags">
                        {!item.isRead && <small>Unread</small>}
                        {item.isSaved && <small>Saved</small>}
                        {item.tags.slice(0, 2).map((tag) => (
                          <small key={tag}>{tag}</small>
                        ))}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        <article className="reader-detail-column">
          {!story ? (
            <div className="reader-detail-empty">
              <p className="reader-mini-label">Reader</p>
              <h2>Select a story</h2>
              <p>The full reading pane will appear here once a feed story is selected.</p>
            </div>
          ) : (
            <>
              <div className="reader-detail-source">
                <span>{story.feedTitle}</span>
                <time>{timeAgo(story.publishedAt || story.fetchedAt)}</time>
              </div>
              <h1>{story.title}</h1>
              {story.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="reader-detail-image"
                  src={story.imageUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              )}
              <p className="reader-detail-excerpt">
                {story.excerpt || "This feed supplied metadata only. Open the original story to read more."}
              </p>
              {story.content ? (
                <div className="reader-detail-content">{story.content}</div>
              ) : (
                <div className="reader-copyright-note">
                  Full article text is not stored unless the feed clearly allows redistribution.
                  Daily Signal Wire keeps source metadata and sends readers to the original publisher.
                </div>
              )}
              <a className="original-link" href={story.sourceUrl} target="_blank" rel="noreferrer">
                Open original story →
              </a>
              <StoryActions
                storyId={story.id}
                title={story.title}
                hook={story.excerpt || story.feedTitle}
                sourceUrl={story.sourceUrl}
                isSaved={story.isSaved}
                aiConfigured={aiConfigured}
              />
              <section className="reader-side-panel">
                <p className="reader-mini-label">Most read</p>
                {mostRead.length ? (
                  mostRead.map((post, index) => (
                    <Link key={post.id} href={`/news/${post.slug}`}>
                      <span>{index + 1}</span>
                      <strong>{post.title}</strong>
                    </Link>
                  ))
                ) : (
                  <p>No published stories yet.</p>
                )}
              </section>
              <section className="reader-side-panel">
                <p className="reader-mini-label">Latest updates</p>
                {latestUpdates.map((item) => (
                  <Link key={item.id} href={withQuery(filters, { story: item.id })}>
                    <span>{timeAgo(item.publishedAt || item.fetchedAt)}</span>
                    <strong>{item.title}</strong>
                  </Link>
                ))}
              </section>
              <section className="newsletter-panel">
                <NewsletterCard />
              </section>
              <AdSlot position="sidebar" className="reader-detail-ad" />
            </>
          )}
        </article>
      </main>
      <InfinitePostFeed initialPosts={serializedPublishedPosts} />
    </div>
  );
}
