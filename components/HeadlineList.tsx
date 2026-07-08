import Link from "next/link";
import type { ReaderPost } from "@/components/ArticleCard";

export default function HeadlineList({ posts }: { posts: ReaderPost[] }) {
  return (
    <section className="headline-list">
      <div className="section-kicker">
        <span className="pulse-dot" />
        News now
      </div>
      {posts.length === 0 ? (
        <p className="headline-list-empty">Fresh headlines will appear here.</p>
      ) : (
        <ol>
          {posts.map((post, index) => (
            <li key={post.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <Link href={`/news/${post.slug}`}>{post.title}</Link>
                <small>{post.category}</small>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
