import Link from "next/link";

export type ReaderPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  category: string;
  publishedAt: Date | null;
  createdAt: Date;
};

function relativeTime(date: Date | null) {
  if (!date) return "Just now";
  const minutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ArticleImage({
  post,
  className = ""
}: {
  post: ReaderPost;
  className?: string;
}) {
  return (
    <div className={`article-image ${className}`}>
      {post.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.imageUrl} alt="" />
      ) : (
        <div className="article-image-fallback" aria-label="No article image">
          <svg viewBox="0 0 80 52" aria-hidden="true">
            <path d="M7 28h12l6-14 11 29 9-22 6 12h22" />
          </svg>
          <span>Daily Signal Wire</span>
        </div>
      )}
    </div>
  );
}

export default function ArticleCard({
  post,
  variant = "standard"
}: {
  post: ReaderPost;
  variant?: "standard" | "compact";
}) {
  return (
    <article className={`news-card news-card-${variant}`}>
      <Link href={`/news/${post.slug}`} aria-label={post.title}>
        <ArticleImage post={post} />
      </Link>
      <div className="news-card-body">
        <div className="story-meta">
          <span>{post.category}</span>
          <time dateTime={(post.publishedAt || post.createdAt).toISOString()}>
            {relativeTime(post.publishedAt || post.createdAt)}
          </time>
        </div>
        <h3>
          <Link href={`/news/${post.slug}`}>{post.title}</Link>
        </h3>
        {variant === "standard" && <p>{post.excerpt}</p>}
      </div>
    </article>
  );
}
