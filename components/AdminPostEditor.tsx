"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";

type EditablePost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  facebookCaption: string;
  imagePrompt: string;
  imageStatus: string;
  imageError: string;
  imageUrl: string;
  featuredImageUrl: string;
  featuredImage: string;
  thumbnailImage: string;
  openGraphImage: string;
  twitterImage: string;
  imageAlt: string;
  imageCaption: string;
  imageDisclosure: string;
  imageSourceType: string;
  imageLicense: string;
  imageCredit: string;
  factCheckNotes: string[];
  sourceUrls: string[];
  status: string;
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

export default function AdminPostEditor({
  initialPost,
  aiConfigured
}: {
  initialPost: EditablePost;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [post, setPost] = useState(initialPost);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [urlFields, setUrlFields] = useState({
    imageUrl: "",
    imageAlt: "",
    imageCaption: "",
    imageDisclosure: "",
    imageLicense: "",
    imageCredit: ""
  });

  function previewImageUrl() {
    return post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage || "";
  }

  function articleUrl() {
    return `${window.location.origin}/news/${post.slug}`;
  }

  function field<K extends keyof EditablePost>(key: K, value: EditablePost[K]) {
    setPost((current) => ({ ...current, [key]: value }));
  }

  async function call(url: string, init: RequestInit, label: string) {
    setBusy(label);
    setMessage("");
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setMessage(body.error || `${label} failed`);
      return null;
    }
    return body;
  }

  async function save() {
    const result = await call(
      `/api/admin/posts/${post.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          facebookCaption: post.facebookCaption,
          imagePrompt: post.imagePrompt,
          imageAlt: post.imageAlt,
          imageCaption: post.imageCaption,
          imageDisclosure: post.imageDisclosure,
          factCheckNotes: post.factCheckNotes,
          sourceUrls: post.sourceUrls
        })
      },
      "save"
    );
    if (result) {
      setMessage("Draft saved.");
      router.refresh();
    }
  }

  async function image(mode: "generate" | "regenerate" | "accept" | "reject" | "remove") {
    const result = await call(
      `/api/admin/posts/${post.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, imagePrompt: post.imagePrompt })
      },
      mode
    );
    if (result) {
      setPost((current) => ({
        ...current,
        imagePrompt: result.imagePrompt ?? current.imagePrompt,
        imageStatus: result.imageStatus ?? current.imageStatus,
        imageError: result.imageError ?? "",
        imageUrl: result.imageUrl ?? "",
        featuredImageUrl: result.featuredImageUrl ?? "",
        featuredImage: result.featuredImage ?? "",
        thumbnailImage: result.thumbnailImage ?? "",
        openGraphImage: result.openGraphImage ?? "",
        twitterImage: result.twitterImage ?? "",
        imageAlt: result.imageAlt ?? "",
        imageCaption: result.imageCaption ?? "",
        imageDisclosure: result.imageDisclosure ?? "",
        imageSourceType: result.imageSourceType ?? current.imageSourceType,
        imageLicense: result.imageLicense ?? "",
        imageCredit: result.imageCredit ?? ""
      }));
      setMessage(`${mode} complete.`);
      router.refresh();
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.[0]) return;
    const form = new FormData();
    form.append("file", event.target.files[0]);
    form.append("alt", post.imageAlt);
    form.append("caption", post.imageCaption);
    form.append("license", "Owned/uploaded by publisher");
    form.append("credit", "Daily Signal Wire");
    const result = await call(
      `/api/admin/posts/${post.id}/image`,
      { method: "POST", body: form },
      "upload"
    );
    if (result) {
      setPost((current) => ({
        ...current,
        imageStatus: result.imageStatus ?? current.imageStatus,
        imageError: result.imageError ?? "",
        imageUrl: result.imageUrl ?? "",
        featuredImageUrl: result.featuredImageUrl ?? "",
        featuredImage: result.featuredImage ?? "",
        thumbnailImage: result.thumbnailImage ?? "",
        openGraphImage: result.openGraphImage ?? "",
        twitterImage: result.twitterImage ?? "",
        imageAlt: result.imageAlt ?? current.imageAlt,
        imageCaption: result.imageCaption ?? current.imageCaption,
        imageDisclosure: result.imageDisclosure ?? "",
        imageSourceType: result.imageSourceType ?? "upload",
        imageLicense: result.imageLicense ?? "",
        imageCredit: result.imageCredit ?? ""
      }));
      setMessage("Image uploaded and resized.");
      router.refresh();
    }
  }

  async function pasteImageUrl() {
    const result = await call(
      `/api/admin/posts/${post.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url", ...urlFields })
      },
      "url"
    );
    if (result) {
      setPost((current) => ({
        ...current,
        imageStatus: result.imageStatus ?? current.imageStatus,
        imageError: result.imageError ?? "",
        imageUrl: result.imageUrl ?? "",
        featuredImageUrl: result.featuredImageUrl ?? "",
        featuredImage: result.featuredImage ?? "",
        thumbnailImage: result.thumbnailImage ?? "",
        openGraphImage: result.openGraphImage ?? "",
        twitterImage: result.twitterImage ?? "",
        imageAlt: result.imageAlt ?? current.imageAlt,
        imageCaption: result.imageCaption ?? current.imageCaption,
        imageDisclosure: result.imageDisclosure ?? current.imageDisclosure,
        imageSourceType: result.imageSourceType ?? "licensed_url",
        imageLicense: result.imageLicense ?? "",
        imageCredit: result.imageCredit ?? ""
      }));
      setMessage("Licensed image URL saved.");
      router.refresh();
    }
  }

  async function publish() {
    const result = await call(
      `/api/admin/posts/${post.id}/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedFactCheck: confirmed })
      },
      "publish"
    );
    if (result) {
      setPost((current) => ({ ...current, status: "published" }));
      setMessage("Published.");
      router.refresh();
    }
  }

  async function copyFacebook() {
    const hook =
      post.facebookCaption.length > 180
        ? `${post.facebookCaption.slice(0, 177).trimEnd()}…`
        : post.facebookCaption;
    setMessage(
      (await copyText(`${post.title}\n\n${hook}\n\nRead full story:\n${articleUrl()}`))
        ? "Facebook post copied."
        : "Copy blocked."
    );
  }

  async function copyUrl() {
    setMessage((await copyText(articleUrl())) ? "URL copied." : "Copy blocked.");
  }

  return (
    <main className="admin-content">
      {message && <div className="toast">{message}</div>}
      <section className="panel admin-editor-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Edit post</p>
            <h2>{post.title}</h2>
          </div>
          <span className={`post-status post-status-${post.status}`}>
            {post.status}
          </span>
        </div>

        <div className="edit-form">
          <label>
            Headline
            <input value={post.title} onChange={(event) => field("title", event.target.value)} />
          </label>
          <label>
            Excerpt
            <textarea
              rows={3}
              value={post.excerpt}
              onChange={(event) => field("excerpt", event.target.value)}
            />
          </label>
          <label>
            Article
            <textarea
              className="article-textarea"
              rows={24}
              value={post.content}
              onChange={(event) => field("content", event.target.value)}
            />
          </label>
          <div className="two-col">
            <label>
              SEO title
              <input
                value={post.seoTitle}
                onChange={(event) => field("seoTitle", event.target.value)}
              />
            </label>
            <label>
              Meta description
              <textarea
                rows={3}
                value={post.seoDescription}
                onChange={(event) => field("seoDescription", event.target.value)}
              />
            </label>
          </div>
          <label>
            Facebook caption
            <textarea
              rows={4}
              value={post.facebookCaption}
              onChange={(event) => field("facebookCaption", event.target.value)}
            />
          </label>
          <label>
            Image prompt
            <textarea
              rows={6}
              value={post.imagePrompt}
              onChange={(event) => field("imagePrompt", event.target.value)}
            />
          </label>
          <div className="two-col">
            <label>
              Image alt text
              <input
                value={post.imageAlt}
                onChange={(event) => field("imageAlt", event.target.value)}
                placeholder="Describe the cover image for accessibility"
              />
            </label>
            <label>
              Image caption
              <input
                value={post.imageCaption}
                onChange={(event) => field("imageCaption", event.target.value)}
                placeholder="Caption shown under the article image"
              />
            </label>
          </div>
          <label>
            Image disclosure
            <input
              value={post.imageDisclosure}
              onChange={(event) => field("imageDisclosure", event.target.value)}
              placeholder="AI-generated editorial illustration"
            />
          </label>
          <div className="two-col">
            <label>
              Fact-check notes, one per line
              <textarea
                rows={6}
                value={post.factCheckNotes.join("\n")}
                onChange={(event) =>
                  field(
                    "factCheckNotes",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              Source URLs, one per line
              <textarea
                rows={6}
                value={post.sourceUrls.join("\n")}
                onChange={(event) =>
                  field(
                    "sourceUrls",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section className="panel admin-editor-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">Image</p>
            <h2>Featured visual</h2>
          </div>
          <span className={`status status-${post.imageStatus}`}>
            {post.imageStatus}
          </span>
        </div>
        <div className="image-badge-row">
          <span className={`image-source-badge image-source-${post.imageSourceType}`}>
            {post.imageSourceType === "ai"
              ? "Generated"
              : post.imageSourceType === "upload"
                ? "Manual Upload"
                : post.imageSourceType === "licensed_url"
                  ? "Licensed URL"
                  : "Placeholder"}
          </span>
          {post.imageStatus === "generating" && <span>Generating…</span>}
          {post.imageStatus === "failed" && <span>Failed · retry available</span>}
        </div>
        {!aiConfigured && (
          <div className="warning-banner">
            AI image generation is not configured.
          </div>
        )}
        {previewImageUrl() ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-editor-image" src={previewImageUrl()} alt={post.imageAlt} />
            {post.imageDisclosure && (
              <p className="ai-image-disclosure">{post.imageDisclosure}</p>
            )}
          </>
        ) : (
          <div className="reader-empty-state compact">
            <h2>No featured image yet.</h2>
            <p>Generate an editorial image, upload one, or paste a licensed URL from the trend editor.</p>
          </div>
        )}
        {post.imageError && <div className="error-banner">{post.imageError}</div>}
        {(post.featuredImage || post.thumbnailImage) && (
          <div className="image-asset-list">
            <span>1200×675: {post.thumbnailImage || "pending"}</span>
            <span>1920×1080: {post.featuredImageUrl || post.featuredImage || "pending"}</span>
            <span>OpenGraph: {post.openGraphImage || "pending"}</span>
            <span>Twitter: {post.twitterImage || "pending"}</span>
          </div>
        )}
        <div className="image-meta-preview">
          <span>Alt: {post.imageAlt || "Not set"}</span>
          <span>Caption: {post.imageCaption || "Not set"}</span>
          <span>Disclosure: {post.imageDisclosure || "None"}</span>
        </div>
        <p className="license-line">
          {post.imageLicense || "License not set"}
          {post.imageCredit ? ` · ${post.imageCredit}` : ""}
        </p>
        <label className="upload-button">
          Replace / Upload image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={uploadImage}
          />
        </label>
        <details className="url-details">
          <summary>Paste licensed image URL</summary>
          <input
            placeholder="https://images.unsplash.com/…"
            value={urlFields.imageUrl}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageUrl: event.target.value })
            }
          />
          <input
            placeholder="Alt text"
            value={urlFields.imageAlt}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageAlt: event.target.value })
            }
          />
          <input
            placeholder="Caption"
            value={urlFields.imageCaption}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageCaption: event.target.value })
            }
          />
          <input
            placeholder="Disclosure (optional)"
            value={urlFields.imageDisclosure}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageDisclosure: event.target.value })
            }
          />
          <input
            placeholder="License"
            value={urlFields.imageLicense}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageLicense: event.target.value })
            }
          />
          <input
            placeholder="Photographer / source credit"
            value={urlFields.imageCredit}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageCredit: event.target.value })
            }
          />
          <button
            className="button button-secondary button-full"
            onClick={pasteImageUrl}
            disabled={Boolean(busy)}
          >
            Save image URL
          </button>
        </details>
      </section>

      <section className="action-bar sticky-action-bar">
        <button className="button button-dark" onClick={save} disabled={Boolean(busy)}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("generate")}
          disabled={Boolean(busy) || !aiConfigured}
        >
          Generate Image
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("regenerate")}
          disabled={Boolean(busy) || !aiConfigured || !previewImageUrl()}
        >
          Regenerate Image
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("accept")}
          disabled={Boolean(busy) || !previewImageUrl()}
        >
          Accept Image
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("remove")}
          disabled={Boolean(busy) || !previewImageUrl()}
        >
          Remove Image
        </button>
        <button
          className="button button-secondary"
          onClick={copyFacebook}
          disabled={Boolean(busy)}
        >
          Copy Facebook Post
        </button>
        <button className="button button-secondary" onClick={copyUrl} disabled={Boolean(busy)}>
          Copy URL
        </button>
        <Link
          className="button button-secondary"
          href={`/news/${post.slug}${post.status === "published" ? "" : "?preview=1"}`}
          target="_blank"
        >
          Preview
        </Link>
        {post.status !== "published" && (
          <label className="confirm-row compact-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>Fact-check complete</span>
          </label>
        )}
        {post.status !== "published" && (
          <button
            className="button button-publish"
            onClick={publish}
            disabled={Boolean(busy) || !confirmed}
          >
            Publish
          </button>
        )}
      </section>
    </main>
  );
}
