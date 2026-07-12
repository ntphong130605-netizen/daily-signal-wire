"use client";

import { useEffect, useRef, useState } from "react";
import ArticleCard, { type ReaderPost } from "@/components/ArticleCard";

type SerializedPost = Omit<ReaderPost, "publishedAt" | "createdAt"> & {
  publishedAt: string | null;
  createdAt: string;
};

function revive(post: SerializedPost): ReaderPost {
  return {
    ...post,
    publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
    createdAt: new Date(post.createdAt)
  };
}

export default function ArticleRecommendations({
  initialPosts,
  excludeSlug
}: {
  initialPosts: SerializedPost[];
  excludeSlug: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(2);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setLoading(true);
      try {
        const response = await fetch(`/api/posts?page=${page}&limit=6`);
        const data = (await response.json()) as {
          posts?: SerializedPost[];
          nextPage?: number | null;
        };
        const nextPosts = (data.posts || []).filter((post) => post.slug !== excludeSlug);
        setPosts((current) => {
          const seen = new Set(current.map((post) => post.id));
          return [...current, ...nextPosts.filter((post) => !seen.has(post.id))];
        });
        setPage(data.nextPage || page + 1);
        setHasMore(Boolean(data.nextPage));
      } catch {
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    }, { rootMargin: "700px" });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [excludeSlug, hasMore, loading, page]);

  if (!posts.length) return null;

  return (
    <section className="article-recommendations" aria-labelledby="more-recommendations-heading">
      <div className="article-section-heading">
        <p className="section-kicker">More reporting</p>
        <h2 id="more-recommendations-heading">Recommended for you</h2>
      </div>
      <div className="article-recommendation-grid">
        {posts.map((post) => (
          <ArticleCard key={post.id} post={revive(post)} />
        ))}
      </div>
      <div ref={sentinelRef} className="infinite-sentinel">
        {loading ? "Loading more recommendations…" : hasMore ? "Scroll for more" : "End of recommendations"}
      </div>
    </section>
  );
}
