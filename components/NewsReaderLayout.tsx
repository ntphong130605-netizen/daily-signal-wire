import Link from "next/link";
import AdSlot from "@/components/ads/AdSlot";
import type { ReaderPost } from "@/components/ArticleCard";
import BreakingNewsTicker, { type BreakingNewsItem } from "@/components/BreakingNewsTicker";
import HeroStory from "@/components/HeroStory";
import InfinitePostFeed from "@/components/InfinitePostFeed";
import Logo from "@/components/Logo";
import MobileMenu, { type MobileMenuLink } from "@/components/MobileMenu";
import MostRead from "@/components/MostRead";
import NewsSection from "@/components/NewsSection";
import NewsletterCard from "@/components/NewsletterCard";
import ReaderFooter from "@/components/ReaderFooter";
import ReaderThemeToggle from "@/components/ReaderThemeToggle";

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

const navLinks: MobileMenuLink[] = [
  { label: "Trending", href: "/?sort=trending" },
  { label: "Latest", href: "/?sort=latest" },
  { label: "US", href: "/category/us-news" },
  { label: "World", href: "/category/world" },
  { label: "Business", href: "/category/business" },
  { label: "Technology", href: "/category/technology" },
  { label: "Sports", href: "/category/sports" },
  { label: "Entertainment", href: "/category/entertainment" },
  { label: "Lifestyle", href: "/category/lifestyle" }
];

const categoryBlocks = ["Technology", "Business", "Sports", "Entertainment"];

function timeAgo(date: Date | null | undefined) {
  if (!date) return "Just now";
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.round(diff / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function categorySlug(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function matchesCategory(post: ReaderPost, category: string) {
  const value = post.category.toLowerCase();
  const target = category.toLowerCase();
  if (target === "business") return value.includes("business") || value.includes("money");
  if (target === "technology") return value.includes("tech") || value.includes("ai");
  return value.includes(target);
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
  const featuredPost = publishedPosts[0] || null;
  const heroRelated = publishedPosts.slice(1, 4);
  const trendingPosts = publishedPosts.slice(1, 5);
  const latestPosts = publishedPosts.slice(1, 11);
  const mostReadPosts = publishedPosts.slice(0, 5);
  const feedCount = folders.reduce((total, folder) => total + folder.feeds.length, 0);
  const highlightedStory = selectedStory || stories[0] || null;
  const latestFeedStories = stories.slice(0, 8);
  const serializedPublishedPosts = publishedPosts.map((post) => ({
    ...post,
    publishedAt: post.publishedAt?.toISOString() || null,
    createdAt: post.createdAt.toISOString()
  }));
  const breakingItems: BreakingNewsItem[] = publishedPosts.slice(0, 5).map((post) => ({
    id: post.id,
    title: post.title,
    href: `/news/${post.slug}`,
    label: post.category
  }));
  const topics = [
    ...new Set([
      ...publishedPosts.map((post) => post.category),
      ...stories.flatMap((story) => story.tags),
      "US News",
      "World",
      "Business",
      "Technology",
      "Sports",
      "Entertainment"
    ])
  ]
    .filter(Boolean)
    .slice(0, 14);
  const categorySections = categoryBlocks.map((category) => ({
    category,
    posts: publishedPosts.filter((post) => matchesCategory(post, category)).slice(0, 4)
  }));

  return (
    <div className="news-home">
      <header className="news-home-header">
        <div className="news-home-header-inner">
          <Logo href="/" />
          <nav className="news-home-nav" aria-label="Primary navigation">
            {navLinks.map((link) => (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
          <form className="news-home-search" action="/">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={filters.q || ""}
              placeholder="Search Daily Signal Wire"
              aria-label="Search Daily Signal Wire"
            />
          </form>
          <ReaderThemeToggle />
          <Link className="news-home-admin-link" href="/admin">
            Admin
          </Link>
          <MobileMenu links={navLinks} />
        </div>
      </header>

      <BreakingNewsTicker items={breakingItems} />
      <AdSlot position="top" className="news-home-top-ad" />

      <main className="news-home-shell">
        {featuredPost ? (
          <>
            <HeroStory post={featuredPost} related={heroRelated} />

            <section className="news-home-topic-carousel" aria-label="Trending topics">
              <div>
                <p className="news-home-kicker">Trending topics</p>
                <h2>Signals readers are tracking</h2>
              </div>
              <div className="news-home-topic-track">
                {topics.map((topic) => (
                  <Link key={topic} href={`/?q=${encodeURIComponent(topic)}`}>
                    <span>#</span>
                    {topic}
                  </Link>
                ))}
              </div>
            </section>

            <div className="news-home-layout">
              <div className="news-home-primary">
                <NewsSection title="Trending Now" posts={trendingPosts} href="/?sort=trending" />

                <section className="news-home-section">
                  <div className="news-home-section-heading">
                    <div>
                      <p className="news-home-kicker">Updated continuously</p>
                      <h2>Latest news</h2>
                    </div>
                    <Link href="/?sort=latest">View all</Link>
                  </div>
                  <div className="news-home-latest-list">
                    {latestPosts.length ? (
                      latestPosts.slice(0, 10).map((post) => (
                        <article key={post.id} className="news-home-latest-row">
                          <div>
                            <div className="news-home-meta">
                              <span>{post.category}</span>
                              <time dateTime={(post.publishedAt || post.createdAt).toISOString()}>
                                {timeAgo(post.publishedAt || post.createdAt)}
                              </time>
                              <span>{post.source || "Daily Signal Wire"}</span>
                            </div>
                            <h3>
                              <Link href={`/news/${post.slug}`}>{post.title}</Link>
                            </h3>
                            <p>{post.excerpt}</p>
                          </div>
                        </article>
                      ))
                    ) : (
                      <div className="news-home-empty">No additional published stories yet.</div>
                    )}
                  </div>
                </section>

                <div className="news-home-category-grid">
                  {categorySections.map((section) => (
                    <NewsSection
                      key={section.category}
                      title={section.category}
                      posts={section.posts}
                      href={`/category/${categorySlug(section.category)}`}
                      compact
                    />
                  ))}
                </div>

                {latestFeedStories.length > 0 && (
                  <section className="news-home-section news-home-feed-section">
                    <div className="news-home-section-heading">
                      <div>
                        <p className="news-home-kicker">RSS reader</p>
                        <h2>Latest source updates</h2>
                      </div>
                      <Link href="/admin/feeds">Manage feeds</Link>
                    </div>
                    <div className="news-home-feed-list">
                      {latestFeedStories.map((story) => (
                        <Link key={story.id} href={withQuery(filters, { story: story.id })}>
                          <span>{story.feedTitle}</span>
                          <strong>{story.title}</strong>
                          <time>{timeAgo(story.publishedAt || story.fetchedAt)}</time>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}
              </div>

              <aside className="news-home-sidebar">
                <MostRead posts={mostReadPosts} />
                <section className="news-home-panel news-home-source-panel">
                  <p className="news-home-kicker">Newsroom status</p>
                  <div className="news-home-status-grid">
                    <span>
                      <strong>{counts.all}</strong>
                      Stories
                    </span>
                    <span>
                      <strong>{counts.unread}</strong>
                      Unread
                    </span>
                    <span>
                      <strong>{draftCount}</strong>
                      AI drafts
                    </span>
                    <span>
                      <strong>{feedCount}</strong>
                      Sources
                    </span>
                  </div>
                  <p className="news-home-muted">
                    AI drafting is {aiConfigured ? "configured" : "waiting for API configuration"}.
                    Admins review every AI story before publishing.
                  </p>
                </section>
                <NewsletterCard />
                <AdSlot position="sidebar" className="news-home-sidebar-ad" />
                <section className="news-home-panel">
                  <p className="news-home-kicker">Popular topics</p>
                  <div className="news-home-topic-cloud">
                    {topics.slice(0, 10).map((topic) => (
                      <Link key={topic} href={`/?q=${encodeURIComponent(topic)}`}>
                        {topic}
                      </Link>
                    ))}
                  </div>
                </section>
                {highlightedStory && (
                  <section className="news-home-panel news-home-source-panel">
                    <p className="news-home-kicker">Source watch</p>
                    <h3>{highlightedStory.title}</h3>
                    <p className="news-home-muted">
                      {highlightedStory.excerpt || "Metadata-only feed update from a source."}
                    </p>
                    <Link className="news-home-read-link" href={highlightedStory.sourceUrl}>
                      Original source <span>↗</span>
                    </Link>
                  </section>
                )}
              </aside>
            </div>
          </>
        ) : (
          <section className="news-home-empty-state">
            <div className="empty-signal">
              <span />
              <span />
              <span />
            </div>
            <p className="news-home-kicker">The wire is quiet</p>
            <h1>No published stories yet.</h1>
            <p>
              Editors are reviewing sourced drafts. Published reporting will appear here
              as soon as it clears the newsroom.
            </p>
            <Link className="news-home-primary-button" href="/admin">
              Open newsroom
            </Link>
          </section>
        )}
      </main>

      {publishedPosts.length > 0 && (
        <InfinitePostFeed initialPosts={serializedPublishedPosts.slice(10)} />
      )}

      <ReaderFooter />
    </div>
  );
}
