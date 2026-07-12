import Link from "next/link";
import ArticleCard, {
  ArticleImage,
  estimateReadingTime,
  type ReaderPost
} from "@/components/ArticleCard";

function categorySlug(category: string) {
  return category.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function NewsSection({
  title,
  posts,
  href,
  compact = false
}: {
  title: string;
  posts: ReaderPost[];
  href?: string;
  compact?: boolean;
}) {
  const [featured, ...rest] = posts;
  const sectionHref = href || `/category/${categorySlug(title)}`;

  return (
    <section className={`news-home-section${compact ? " news-home-section-compact" : ""}`}>
      <div className="news-home-section-heading">
        <div>
          <p className="news-home-kicker">Daily Signal Wire</p>
          <h2>{title}</h2>
        </div>
        <Link href={sectionHref}>View all</Link>
      </div>

      {posts.length === 0 ? (
        <div className="news-home-empty">No published {title.toLowerCase()} stories yet.</div>
      ) : compact && featured ? (
        <div className="news-home-category-block">
          <Link className="news-home-category-feature" href={`/news/${featured.slug}`}>
            <ArticleImage
              post={featured}
              sizes="(max-width: 768px) 100vw, 24vw"
            />
            <span>{featured.category} · {estimateReadingTime(featured.excerpt)} min read</span>
            <strong>{featured.title}</strong>
          </Link>
          <div className="news-home-category-list">
            {rest.slice(0, 4).map((post) => (
              <Link key={post.id} href={`/news/${post.slug}`}>
                <span>{post.category}</span>
                {post.title}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="news-home-card-grid">
          {posts.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  );
}
