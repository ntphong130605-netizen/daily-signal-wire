import Link from "next/link";
import type { ReaderPost } from "@/components/ArticleCard";

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
      <p className="news-home-kicker">Most read</p>
      <ol>
        {posts.slice(0, 5).map((post, index) => (
          <li key={post.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <Link href={`/news/${post.slug}`}>{post.title}</Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
