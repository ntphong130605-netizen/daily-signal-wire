"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type HomepageSuggestion = {
  label: string;
  href: string;
  meta?: string;
};

export default function HomepageSearchBox({
  defaultQuery = "",
  suggestions,
  topics
}: {
  defaultQuery?: string;
  suggestions: HomepageSuggestion[];
  topics: string[];
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool = needle
      ? suggestions.filter((item) =>
          `${item.label} ${item.meta || ""}`.toLowerCase().includes(needle)
        )
      : suggestions;
    return pool.slice(0, 6);
  }, [query, suggestions]);

  const topicMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics
      .filter((topic) => !needle || topic.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [query, topics]);

  return (
    <form
      className="news-home-search news-home-search-live"
      action="/"
      onFocus={() => setFocused(true)}
      onBlur={() => window.setTimeout(() => setFocused(false), 120)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m16.5 16.5 4 4" />
      </svg>
      <input
        type="search"
        name="q"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search stories, topics, sources"
        aria-label="Search Daily Signal Wire"
        autoComplete="off"
      />
      <button type="submit" aria-label="Search">
        Search
      </button>

      {focused && (matches.length > 0 || topicMatches.length > 0) && (
        <div className="news-home-search-popover" role="listbox">
          {matches.length > 0 && (
            <div>
              <p>Story suggestions</p>
              {matches.map((item) => (
                <Link key={item.href} href={item.href} role="option">
                  <strong>{item.label}</strong>
                  {item.meta && <span>{item.meta}</span>}
                </Link>
              ))}
            </div>
          )}
          {topicMatches.length > 0 && (
            <div>
              <p>Trending topics</p>
              <div className="news-home-search-topics">
                {topicMatches.map((topic) => (
                  <Link key={topic} href={`/?q=${encodeURIComponent(topic)}`}>
                    #{topic}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
