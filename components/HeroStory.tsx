import Link from "next/link";
import {
  ArticleImage,
  estimateReadingTime,
  type ReaderPost
} from "@/components/ArticleCard";

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

export default function HeroStory({
  post,
  related = []
}: {
  post: ReaderPost;
  related?: ReaderPost[];
}) {
  const storyDate = post.publishedAt || post.createdAt;
  const subtitle = post.subtitle || post.summary || post.excerpt;

  return (
    <section className="news-home-hero" aria-labelledby="top-story-heading">
      <article className="news-home-hero-copy">
        <div className="news-home-hero-badges">
          <p className="news-home-kicker">{post.category}</p>
          <span>Top story</span>
        </div>
        <h1 id="top-story-heading">
          <Link href={`/news/${post.slug}`}>{post.title}</Link>
        </h1>
        <div className="news-home-meta">
          <span>{post.source || "Daily Signal Wire"}</span>
          <time dateTime={storyDate.toISOString()} suppressHydrationWarning>
            {timeAgo(storyDate)}
          </time>
          <span>{estimateReadingTime(`${post.title} ${post.excerpt}`)} min read</span>
          <span>{post.relatedCount ?? related.length} related</span>
        </div>
        <p>{subtitle}</p>
        <Link className="news-home-read-link" href={`/news/${post.slug}`}>
          Read full story <span>→</span>
        </Link>
      </article>

      <Link className="news-home-hero-image-link" href={`/news/${post.slug}`}>
        <ArticleImage
          post={post}
          className="news-home-hero-image"
          priority
          sizes="(max-width: 768px) 100vw, 66vw"
        />
        <span className="news-home-hero-image-label">
          Premium editorial image
        </span>
      </Link>

      {related.length > 0 && (
        <div className="news-home-hero-related" aria-label="Related headlines">
          {related.slice(0, 3).map((item) => (
            <Link key={item.id} href={`/news/${item.slug}`}>
              <span>{item.category}</span>
              <strong>{item.title}</strong>
              <small>{estimateReadingTime(`${item.title} ${item.excerpt}`)} min read</small>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
