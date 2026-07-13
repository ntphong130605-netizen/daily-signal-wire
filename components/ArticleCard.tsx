import Link from "next/link";
import Image from "next/image";
import { normalizeEditorialImageUrl } from "@/lib/editorialImages";

const blurDataUrl =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMzInIGhlaWdodD0nMTgnIHZpZXdCb3g9JzAgMCAzMiAxOCcgeG1sbnM9J2h0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnJz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJyB4Mj0nMScgeTE9JzAnIHkyPScxJz48c3RvcCBzdG9wLWNvbG9yPScjZWFmN2Y4Jy8+PHN0b3Agb2Zmc2V0PScwLjUnIHN0b3AtY29sb3I9JyNmOGZiZmInLz48c3RvcCBvZmZzZXQ9JzEnIHN0b3AtY29sb3I9JyNkNmVlZjInLz48L2xpbmVhckdyYWRpZW50PjwvZGVmcz48cmVjdCB3aWR0aD0nMzInIGhlaWdodD0nMTgnIGZpbGw9J3VybCgjZyknLz48Y2lyY2xlIGN4PScyNScgY3k9JzQnIHI9JzYnIGZpbGw9JyMyMmE2YjMnIG9wYWNpdHk9JzAuMTgnLz48L3N2Zz4=";

export type ReaderPost = {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  imageUrl: string | null;
  imageAlt?: string | null;
  category: string;
  source?: string;
  tags?: string[];
  relatedCount?: number;
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

export function estimateReadingTime(text?: string | null) {
  const words = (text || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function ArticleImage({
  post,
  className = "",
  priority = false,
  sizes = "(max-width: 768px) 100vw, 33vw"
}: {
  post: ReaderPost;
  className?: string;
  priority?: boolean;
  sizes?: string;
}) {
  const imageUrl = normalizeEditorialImageUrl(post.imageUrl, post.category);
  return (
    <div className={`article-image ${className}`}>
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={post.imageAlt || post.title}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          quality={priority ? 88 : 78}
          placeholder="blur"
          blurDataURL={blurDataUrl}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
        />
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
          <time
            dateTime={(post.publishedAt || post.createdAt).toISOString()}
            suppressHydrationWarning
          >
            {relativeTime(post.publishedAt || post.createdAt)}
          </time>
          <span>{estimateReadingTime(`${post.title} ${post.excerpt}`)} min read</span>
        </div>
        <h3>
          <Link href={`/news/${post.slug}`}>{post.title}</Link>
        </h3>
        {variant === "standard" && <p>{post.excerpt}</p>}
      </div>
    </article>
  );
}
