"use client";

import Image from "next/image";
import { useState } from "react";

const blurDataUrl =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0nMTYnIGhlaWdodD0nOScgdmlld0JveD0nMCAwIDE2IDknIHhtbG5zPSdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zyc+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzknIGZpbGw9JyNlZWY3ZjgnLz48Y2lyY2xlIGN4PScxMicgY3k9JzInIHI9JzUnIGZpbGw9JyNjZmU4ZWInIG9wYWNpdHk9Jy44Jy8+PC9zdmc+";

export default function ArticleImageFrame({
  src,
  alt,
  caption,
  credit,
  license,
  disclosure,
  priority = false
}: {
  src: string;
  alt: string;
  caption?: string | null;
  credit?: string | null;
  license?: string | null;
  disclosure?: string | null;
  priority?: boolean;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <>
      <figure className="article-cover premium-article-image">
        <button
          type="button"
          className="article-image-preview-button"
          onClick={() => setPreviewOpen(true)}
          aria-label="Open image preview"
        >
          <span className="article-image-canvas">
            <Image
              src={src}
              alt={alt}
              fill
              priority={priority}
              sizes="(max-width: 900px) 100vw, 980px"
              placeholder="blur"
              blurDataURL={blurDataUrl}
              quality={priority ? 90 : 82}
              fetchPriority={priority ? "high" : "auto"}
              decoding="async"
            />
          </span>
          <span className="article-image-zoom">Fullscreen</span>
        </button>
        {(caption || disclosure || credit || license) && (
          <figcaption>
            {caption && <span>{caption}</span>}
            {caption && (disclosure || credit || license) ? " " : ""}
            {disclosure && <em>{disclosure}</em>}
            {disclosure && (credit || license) ? " " : ""}
            {credit}
            {credit && license ? " · " : ""}
            {license}
          </figcaption>
        )}
      </figure>

      {previewOpen && (
        <div
          className="article-image-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Article image preview"
        >
          <button type="button" onClick={() => setPreviewOpen(false)}>
            Close
          </button>
          <Image
            src={src}
            alt={alt}
            width={1600}
            height={900}
            sizes="100vw"
            placeholder="blur"
            blurDataURL={blurDataUrl}
            quality={92}
          />
        </div>
      )}
    </>
  );
}
