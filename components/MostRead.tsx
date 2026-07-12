import Link from "next/link";
import { estimateReadingTime, type ReaderPost } from "@/components/ArticleCard";

export default function MostRead({ posts }: { posts: ReaderPost[] }) {
  if (posts.length === 0) {
    return (
      <section className="news-home-panel">
        <p className="news-home-kicker">Most read</p>
        <p className="news-home-muted">No published stories yet.</p>
      </section>
    );
  }

  return (
    <section className="news-home-panel news-home-most-read">
      <div className="news-home-panel-heading">
        <p className="news-home-kicker">Most read</p>
        <span>24h</span>
      </div>
      <ol>
        {posts.slice(0, 10).map((post, index) => (
          <li key={post.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <Link href={`/news/${post.slug}`}>{post.title}</Link>
              <small>{post.category} · {estimateReadingTime(post.excerpt)} min read</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
