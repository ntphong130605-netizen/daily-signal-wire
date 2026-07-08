import Link from "next/link";
import ArticleCard, {
  ArticleImage,
  type ReaderPost
} from "@/components/ArticleCard";
import HeadlineList from "@/components/HeadlineList";
import HomeSidebar from "@/components/HomeSidebar";

export default function HomeNewsLayout({ posts }: { posts: ReaderPost[] }) {
  if (posts.length === 0) {
    return (
      <section className="reader-empty-state">
        <div className="empty-signal">
          <span />
          <span />
          <span />
        </div>
        <p className="section-kicker">The wire is quiet</p>
        <h1>No published stories yet.</h1>
        <p>
          Editors are reviewing sourced drafts. Published reporting will appear here
          as soon as it clears the newsroom.
        </p>
        <Link href="/admin" className="reader-primary-button">
          Open newsroom
        </Link>
      </section>
    );
  }

  const featured = posts[0];
  const headlines = posts.slice(1, 5);
  const cards = posts.slice(5, 11).length
    ? posts.slice(5, 11)
    : posts.slice(1, 7);

  return (
    <>
      <section className="lead-layout">
        <article className="lead-copy">
          <div className="section-kicker">
            <span className="pulse-dot" />
            Top story · {featured.category}
          </div>
          <h1>
            <Link href={`/news/${featured.slug}`}>{featured.title}</Link>
          </h1>
          <p>{featured.excerpt}</p>
          <Link className="read-story-link" href={`/news/${featured.slug}`}>
            Read the full story <span>→</span>
          </Link>
        </article>
        <Link className="lead-image-link" href={`/news/${featured.slug}`}>
          <ArticleImage post={featured} className="lead-image" />
        </Link>
        <HeadlineList posts={headlines} />
      </section>

      <div className="home-content-grid">
        {cards.length > 0 && (
          <section className="latest-section">
            <div className="reader-section-title">
              <div>
                <p className="section-kicker">Across the wire</p>
                <h2>Latest stories</h2>
              </div>
              <Link href="/?sort=latest">View all →</Link>
            </div>
            <div className="news-card-grid">
              {cards.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          </section>
        )}
        <HomeSidebar posts={posts.slice(1)} />
      </div>
    </>
  );
}
