"use client";

import Link from "next/link";
import { useState } from "react";

export type BreakingNewsItem = {
  id: string;
  title: string;
  href: string;
  label?: string;
};

export default function BreakingNewsTicker({
  items
}: {
  items: BreakingNewsItem[];
}) {
  const [paused, setPaused] = useState(false);

  if (items.length === 0) return null;

  const tickerItems = items.slice(0, 5);

  return (
    <section className="breaking-news-bar" aria-label="Breaking news">
      <div className="breaking-news-inner">
        <strong>Breaking</strong>
        <div className="breaking-news-track" aria-live="polite">
          <div
            className="breaking-news-marquee"
            data-paused={paused ? "true" : "false"}
          >
            {[...tickerItems, ...tickerItems].map((item, index) => (
              <Link key={`${item.id}-${index}`} href={item.href}>
                {item.label && <span>{item.label}</span>}
                {item.title}
              </Link>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="breaking-news-pause"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
        >
          {paused ? "Play" : "Pause"}
        </button>
      </div>
    </section>
  );
}
