"use client";

import { useEffect, useState } from "react";
import { trackArticleShare } from "@/lib/analytics";

export default function ShareButtons({
  title,
  slug
}: {
  title: string;
  slug: string;
}) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/news/${slug}`);
  }, [slug]);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return (
    <div className="share-buttons" aria-label="Share story">
      <span>Share</span>
      <a
        href={
          url ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` : "#"
        }
        target="_blank"
        rel="noreferrer"
        aria-label="Share on Facebook"
        onClick={() => trackArticleShare({ article_slug: slug, share_method: "facebook" })}
      >
        f
      </a>
      <a
        href={
          url
            ? `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`
            : "#"
        }
        target="_blank"
        rel="noreferrer"
        aria-label="Share on X"
        onClick={() => trackArticleShare({ article_slug: slug, share_method: "x" })}
      >
        𝕏
      </a>
      <a
        href={url ? `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` : "#"}
        target="_blank"
        rel="noreferrer"
        aria-label="Share on WhatsApp"
        onClick={() => trackArticleShare({ article_slug: slug, share_method: "whatsapp" })}
      >
        W
      </a>
    </div>
  );
}
