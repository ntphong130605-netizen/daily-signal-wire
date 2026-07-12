"use client";

import { useEffect, useMemo, useState } from "react";

type ShareVariant = "inline" | "rail" | "floating";

export default function ArticleShareTools({
  title,
  slug,
  variant = "inline"
}: {
  title: string;
  slug: string;
  variant?: ShareVariant;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const nextUrl = `${window.location.origin}/news/${slug}`;
    setUrl(nextUrl);
    setSaved(window.localStorage.getItem(`dsw-bookmark:${slug}`) === "1");
  }, [slug]);

  const links = useMemo(() => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    return [
      {
        label: "Facebook",
        short: "f",
        href: url ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` : "#"
      },
      {
        label: "X",
        short: "𝕏",
        href: url ? `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}` : "#"
      },
      {
        label: "LinkedIn",
        short: "in",
        href: url ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` : "#"
      },
      {
        label: "Reddit",
        short: "r",
        href: url ? `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}` : "#"
      },
      {
        label: "Email",
        short: "✉",
        href: url ? `mailto:?subject=${encodedTitle}&body=${encodedUrl}` : "#"
      }
    ];
  }, [title, url]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function toggleBookmark() {
    const next = !saved;
    setSaved(next);
    if (next) {
      window.localStorage.setItem(`dsw-bookmark:${slug}`, "1");
    } else {
      window.localStorage.removeItem(`dsw-bookmark:${slug}`);
    }
  }

  function printArticle() {
    window.print();
  }

  const content = (
    <>
      <span className="share-label">Share</span>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.label === "Email" ? undefined : "_blank"}
          rel={link.label === "Email" ? undefined : "noreferrer"}
          aria-label={`Share on ${link.label}`}
        >
          {link.short}
        </a>
      ))}
      <button type="button" onClick={copyLink} aria-label="Copy article link">
        {copied ? "✓" : "⛓"}
      </button>
      <button
        type="button"
        onClick={toggleBookmark}
        aria-pressed={saved}
        aria-label={saved ? "Remove bookmark" : "Bookmark article"}
      >
        {saved ? "★" : "☆"}
      </button>
      <button type="button" onClick={printArticle} aria-label="Print article">
        ⎙
      </button>
    </>
  );

  if (variant === "floating") {
    return (
      <div className="article-floating-share">
        <button
          className="article-floating-share-toggle"
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls="mobile-share-panel"
        >
          Share
        </button>
        {open && (
          <div id="mobile-share-panel" className="share-buttons share-buttons-floating">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`share-buttons share-buttons-${variant}`} aria-label="Article actions">
      {content}
    </div>
  );
}
