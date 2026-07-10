import Link from "next/link";
import AdSlot from "@/components/ads/AdSlot";
import type { ReaderPost } from "@/components/ArticleCard";
import NewsletterCard from "@/components/NewsletterCard";

export default function HomeSidebar({ posts }: { posts: ReaderPost[] }) {
  const mostRead = posts.slice(0, 4);
  const trending = posts.slice(4, 8);

  return (
    <aside className="home-sidebar">
      <section className="sidebar-module most-read-module">
        <div className="sidebar-module-title">
          <p className="section-kicker">Reader favorites</p>
          <h2>Most Read</h2>
        </div>
        <ol>
          {mostRead.map((post, index) => (
            <li key={post.id}>
              <span>{index + 1}</span>
              <Link href={`/news/${post.slug}`}>{post.title}</Link>
            </li>
          ))}
        </ol>
      </section>

      <section className="sidebar-module trending-module">
        <div className="sidebar-module-title">
          <p className="section-kicker">On the wire</p>
          <h2>Trending Now</h2>
        </div>
        <div className="trending-chips">
          {trending.map((post) => (
            <Link href={`/news/${post.slug}`} key={post.id}>
              <span>↗</span>
              {post.category}
            </Link>
          ))}
        </div>
      </section>

      <NewsletterCard />
      <AdSlot position="sidebar" className="home-ad-slot" />
    </aside>
  );
}
