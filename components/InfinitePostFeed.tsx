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

export default function InfinitePostFeed({
  initialPosts,
  endpointQuery = "",
  kicker = "Latest news",
  title = "More from Daily Signal Wire",
  className = ""
}: {
  initialPosts: SerializedPost[];
  endpointQuery?: string;
  kicker?: string;
  title?: string;
  className?: string;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(2);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 6);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return;

    const observer = new IntersectionObserver(async (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setLoading(true);
      try {
        const query = endpointQuery ? `&${endpointQuery.replace(/^\?/, "")}` : "";
        const response = await fetch(`/api/posts?page=${page}&limit=6${query}`);
        const data = (await response.json()) as {
          posts?: SerializedPost[];
          nextPage?: number | null;
        };
        const nextPosts = data.posts || [];
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
    }, { rootMargin: "600px" });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [endpointQuery, hasMore, loading, page]);

  if (!posts.length) return null;

  return (
    <section className={`infinite-news-section ${className}`.trim()}>
      <div className="reader-section-heading">
        <div>
          <p className="reader-mini-label">{kicker}</p>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="infinite-news-grid">
        {posts.map((post, index) => (
          <div
            className={
              index % 9 === 0
                ? "infinite-news-item infinite-news-item-wide"
                : index % 7 === 0
                  ? "infinite-news-item infinite-news-item-tall"
                  : "infinite-news-item"
            }
            key={post.id}
          >
            <ArticleCard post={revive(post)} />
          </div>
        ))}
      </div>
      <div ref={sentinelRef} className="infinite-sentinel">
        {loading ? "Loading more stories…" : hasMore ? "Scroll for more" : "End of feed"}
      </div>
    </section>
  );
}
