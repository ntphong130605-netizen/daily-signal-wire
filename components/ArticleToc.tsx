"use client";

import { useEffect, useState } from "react";
import type { ArticleHeading } from "@/components/ArticleBody";

export default function ArticleToc({ headings }: { headings: ArticleHeading[] }) {
  const [activeId, setActiveId] = useState(headings[0]?.id || "");

  useEffect(() => {
    if (!headings.length) return;
    const elements = headings
      .map((heading) => document.getElementById(heading.id))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: [0, 1] }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  const renderList = () => (
    <ol>
      {headings.map((heading) => (
        <li key={heading.id} className={`toc-level-${heading.level}`}>
          <a
            className={activeId === heading.id ? "active" : ""}
            href={`#${heading.id}`}
          >
            {heading.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <nav className="premium-article-toc" aria-label="Table of contents">
      <div className="article-toc-desktop">
        <p className="section-kicker">In this story</p>
        <h2>Table of contents</h2>
        {renderList()}
      </div>
      <details className="article-toc-mobile">
        <summary>Table of contents</summary>
        {renderList()}
      </details>
    </nav>
  );
}
