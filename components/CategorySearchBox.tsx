"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type CategorySearchSuggestion = {
  label: string;
  href: string;
  meta?: string;
};

export default function CategorySearchBox({
  action,
  defaultQuery = "",
  suggestions,
  topics
}: {
  action: string;
  defaultQuery?: string;
  suggestions: CategorySearchSuggestion[];
  topics: string[];
}) {
  const [query, setQuery] = useState(defaultQuery);
  const [open, setOpen] = useState(false);

  const storyMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (needle
      ? suggestions.filter((item) =>
          `${item.label} ${item.meta || ""}`.toLowerCase().includes(needle)
        )
      : suggestions
    ).slice(0, 6);
  }, [query, suggestions]);

  const topicMatches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return topics
      .filter((topic) => !needle || topic.toLowerCase().includes(needle))
      .slice(0, 8);
  }, [query, topics]);

  return (
    <form
      className="category-search"
      action={action}
      onFocus={() => setOpen(true)}
      onBlur={() => window.setTimeout(() => setOpen(false), 120)}
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
        placeholder="Search inside this category"
        aria-label="Search inside this category"
        autoComplete="off"
      />
      <button type="submit">Search</button>

      {open && (storyMatches.length > 0 || topicMatches.length > 0) && (
        <div className="category-search-popover" role="listbox">
          {storyMatches.length > 0 && (
            <section>
              <p>Stories</p>
              {storyMatches.map((item) => (
                <Link key={item.href} href={item.href} role="option">
                  <strong>{item.label}</strong>
                  {item.meta && <span>{item.meta}</span>}
                </Link>
              ))}
            </section>
          )}
          {topicMatches.length > 0 && (
            <section>
              <p>Topics</p>
              <div className="category-search-topics">
                {topicMatches.map((topic) => (
                  <Link key={topic} href={`${action}?q=${encodeURIComponent(topic)}`}>
                    #{topic}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </form>
  );
}
