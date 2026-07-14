"use client";

import { ChangeEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent, trackImageGeneration, trackPublish } from "@/lib/client/analytics";

type PostDraft = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  facebookCaption: string;
  imagePrompt: string;
  imageModel: string;
  imageGeneratedAt: string | null;
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

export default function TrendEditor({
  trend,
  post,
  aiConfigured
}: {
  trend: {
    id: string;
    keyword: string;
    relatedQueries: string[];
    sourceUrls: string[];
    generationStatus: string;
    generationError: string | null;
  };
  post: PostDraft | null;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(post);
  const [editing, setEditing] = useState(false);
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

  async function call(url: string, init: RequestInit, task: string) {
    setBusy(task);
    setMessage("");
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setMessage(body.error || "Something went wrong.");
      return null;
    }
    return body;
  }

  async function generateDraft() {
    const result = await call(
      `/api/admin/trends/${trend.id}/generate`,
      { method: "POST" },
      "article"
    );
    if (result) {
      setMessage("Draft generated. Review every fact before publishing.");
      trackEvent("ai_generate", { trend_id: trend.id });
      router.refresh();
    }
  }

  async function regenerate(field: "title" | "facebookCaption") {
    if (!draft) return;
    const result = await call(
      `/api/admin/posts/${draft.id}/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field })
      },
      field
    );
    if (result) {
      setDraft({ ...draft, [field]: result.value });
      setMessage(`${field === "title" ? "Title" : "Facebook caption"} regenerated.`);
    }
  }

  async function saveDraft() {
    if (!draft) return;
    const result = await call(
      `/api/admin/posts/${draft.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          excerpt: draft.excerpt,
          content: draft.content,
          seoTitle: draft.seoTitle,
          seoDescription: draft.seoDescription,
          facebookCaption: draft.facebookCaption,
          imagePrompt: draft.imagePrompt,
          factCheckNotes: draft.factCheckNotes,
          sourceUrls: draft.sourceUrls
        })
      },
      "save"
    );
    if (result) {
      setEditing(false);
      setMessage("Draft changes saved.");
      router.refresh();
    }
  }

  async function generateImage() {
    if (!draft) return;
    const result = await call(
      `/api/admin/posts/${draft.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "generate", imagePrompt: draft.imagePrompt })
      },
      "image"
    );
    if (result) {
      mergeImageResult(result);
      setMessage("Editorial image generated. Review and accept before publishing.");
      trackImageGeneration({ post_id: draft.id, mode: "generate" });
    }
  }

  async function imageMode(
    mode: "regenerate" | "retry" | "prompt" | "accept" | "reject" | "remove"
  ) {
    if (!draft) return;
    const result = await call(
      `/api/admin/posts/${draft.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, imagePrompt: draft.imagePrompt })
      },
      mode === "retry" ? "image-retry" : mode
    );
    if (result) {
      mergeImageResult(result);
      setMessage(
        mode === "prompt"
          ? "Image prompt saved."
          : mode === "accept"
            ? "Image accepted for publishing."
            : mode === "reject"
              ? "Image rejected."
              : mode === "remove"
                ? "Image removed."
              : "Image regenerated. Review and accept before publishing."
      );
      if (mode === "regenerate" || mode === "retry") {
        trackImageGeneration({ post_id: draft.id, mode });
      }
    }
  }

  async function pasteImageUrl() {
    if (!draft) return;
    const result = await call(
      `/api/admin/posts/${draft.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url", ...urlFields })
      },
      "url"
    );
    if (result) {
      mergeImageResult(result);
      setMessage("Licensed image URL saved.");
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    if (!draft || !event.target.files?.[0]) return;
    const form = new FormData();
    form.append("file", event.target.files[0]);
    form.append("alt", draft.imageAlt);
    form.append("caption", draft.imageCaption);
    form.append("license", "Owned/uploaded by publisher");
    form.append("credit", "Daily Signal Wire");
    const result = await call(
      `/api/admin/posts/${draft.id}/image`,
      { method: "POST", body: form },
      "upload"
    );
    if (result) {
      mergeImageResult(result);
      setMessage("Image uploaded.");
    }
  }

  async function publish() {
    if (!draft) return;
    const result = await call(
      `/api/admin/posts/${draft.id}/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedFactCheck: confirmed })
      },
      "publish"
    );
    if (result) {
      setDraft({ ...draft, status: "published" });
      setMessage("Article published.");
      trackPublish({
        post_id: draft.id,
        article_slug: draft.slug
      });
      router.refresh();
    }
  }

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

  async function copyArticleUrl() {
    if (!draft) return;
    const url = `${window.location.origin}/news/${draft.slug}`;
    setMessage(
      (await copyText(url))
        ? "Article URL copied."
        : "Copy was blocked by the browser."
    );
  }

  async function copyFacebookPost() {
    if (!draft) return;
    const url = `${window.location.origin}/news/${draft.slug}`;
    const hookSource =
      draft.facebookCaption.trim() ||
      draft.excerpt.split(/[.!?]/)[0]?.trim() ||
      draft.excerpt;
    const hook =
      hookSource.length > 180
        ? `${hookSource.slice(0, 177).trimEnd()}…`
        : hookSource;
    const copied = await copyText(
      `${draft.title}\n\n${hook}\n\nRead full story:\n${url}`
    );
    setMessage(
      copied ? "Facebook post copied." : "Copy was blocked by the browser."
    );
    trackEvent("copy_facebook_post", {
      post_id: draft.id,
      article_slug: draft.slug
    });
  }

  function field(
    key: keyof Pick<
      PostDraft,
      | "title"
      | "excerpt"
      | "content"
      | "seoTitle"
      | "seoDescription"
      | "facebookCaption"
      | "imagePrompt"
    >,
    value: string
  ) {
    if (draft) setDraft({ ...draft, [key]: value });
  }

  function mergeImageResult(result: Partial<PostDraft>) {
    if (!draft) return;
    setDraft({
      ...draft,
      imagePrompt: result.imagePrompt ?? draft.imagePrompt,
      imageModel: result.imageModel ?? draft.imageModel,
      imageGeneratedAt: result.imageGeneratedAt ?? draft.imageGeneratedAt,
      imageStatus: result.imageStatus ?? draft.imageStatus,
      imageError: result.imageError ?? "",
      imageUrl: result.imageUrl ?? "",
      featuredImageUrl: result.featuredImageUrl ?? "",
      featuredImage: result.featuredImage ?? "",
      thumbnailImage: result.thumbnailImage ?? "",
      openGraphImage: result.openGraphImage ?? "",
      twitterImage: result.twitterImage ?? "",
      imageAlt: result.imageAlt ?? draft.imageAlt,
      imageCaption: result.imageCaption ?? draft.imageCaption,
      imageDisclosure: result.imageDisclosure ?? draft.imageDisclosure,
      imageSourceType: result.imageSourceType ?? draft.imageSourceType,
      imageLicense: result.imageLicense ?? "",
      imageCredit: result.imageCredit ?? ""
    });
  }

  function previewImageUrl() {
    if (!draft) return "";
    return draft.featuredImageUrl || draft.featuredImage || draft.imageUrl || draft.thumbnailImage || "";
  }
  const imagePipelineBusy = draft
    ? ["queued", "generating", "retrying", "upscaling", "optimizing"].includes(draft.imageStatus)
    : false;

  return (
    <>
      {message && <div className="toast">{message}</div>}
      {trend.generationError && (
        <div className="error-banner">{trend.generationError}</div>
      )}
      <section className="action-bar">
        {aiConfigured ? (
          <button
            className="button button-accent"
            onClick={generateDraft}
            disabled={Boolean(busy)}
          >
            {busy === "article"
              ? "Generating draft…"
              : draft
                ? "Regenerate article draft"
                : "Generate article draft"}
          </button>
        ) : (
          <div className="api-config-inline">
            AI generation is disabled. Add <code>OPENAI_API_KEY</code> to{" "}
            <code>.env</code>.
          </div>
        )}
        {draft && (
          <>
            {aiConfigured && (
              <>
                <button
                  className="button button-secondary"
                  onClick={() => regenerate("title")}
                  disabled={Boolean(busy)}
                >
                  Regenerate title
                </button>
                <button
                  className="button button-secondary"
                  onClick={() => regenerate("facebookCaption")}
                  disabled={Boolean(busy)}
                >
                  Regenerate Facebook caption
                </button>
                <button
                  className="button button-secondary"
                  onClick={generateImage}
                  disabled={Boolean(busy)}
                >
                  {busy === "image" ? "Generating image…" : "Generate Image"}
                </button>
              </>
            )}
            <button
              className="button button-secondary"
              onClick={copyFacebookPost}
              disabled={Boolean(busy)}
            >
              Copy Facebook post
            </button>
            <button
              className="button button-secondary"
              onClick={copyArticleUrl}
              disabled={Boolean(busy)}
            >
              Copy article URL
            </button>
            <a
              className="button button-secondary"
              href={`/news/${draft.slug}?preview=1`}
              target="_blank"
              rel="noreferrer"
            >
              Preview
            </a>
          </>
        )}
      </section>

      <div className="editor-grid">
        <div className="editor-main">
          <section className="panel signal-card">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Source signal</p>
                <h2>{trend.keyword}</h2>
              </div>
              <span className="source-pill">Trend, not fact</span>
            </div>
            <div className="queries">
              {trend.relatedQueries.map((query) => (
                <span key={query}>{query}</span>
              ))}
              {trend.relatedQueries.length === 0 && <span>No related queries</span>}
            </div>
          </section>

          {!draft ? (
            <section className="panel empty-draft">
              <div className="empty-icon">✦</div>
              <h2>No article draft yet</h2>
              <p>
                Generate a source-bound original draft. It will remain unpublished
                until an editor explicitly approves it.
              </p>
            </section>
          ) : (
            <>
              <section className="panel article-card">
                <div className="panel-heading compact">
                  <div>
                    <p className="eyebrow">Generated article</p>
                    <h2>Draft copy</h2>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? "Cancel editing" : "Edit draft"}
                  </button>
                </div>
                {editing ? (
                  <div className="edit-form">
                    <label>
                      Headline
                      <input
                        value={draft.title}
                        onChange={(event) => field("title", event.target.value)}
                      />
                    </label>
                    <label>
                      Excerpt
                      <textarea
                        rows={3}
                        value={draft.excerpt}
                        onChange={(event) => field("excerpt", event.target.value)}
                      />
                    </label>
                    <label>
                      Article
                      <textarea
                        className="article-textarea"
                        rows={28}
                        value={draft.content}
                        onChange={(event) => field("content", event.target.value)}
                      />
                    </label>
                    <div className="two-col">
                      <label>
                        SEO title
                        <input
                          value={draft.seoTitle}
                          onChange={(event) => field("seoTitle", event.target.value)}
                        />
                      </label>
                      <label>
                        Meta description
                        <textarea
                          rows={3}
                          value={draft.seoDescription}
                          onChange={(event) =>
                            field("seoDescription", event.target.value)
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Facebook caption
                      <textarea
                        rows={4}
                        value={draft.facebookCaption}
                        onChange={(event) =>
                          field("facebookCaption", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      Fact-check notes, one per line
                      <textarea
                        rows={6}
                        value={draft.factCheckNotes.join("\n")}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            factCheckNotes: event.target.value
                              .split("\n")
                              .filter(Boolean)
                          })
                        }
                      />
                    </label>
                    <label>
                      Source URLs, one per line
                      <textarea
                        rows={5}
                        value={draft.sourceUrls.join("\n")}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            sourceUrls: event.target.value
                              .split("\n")
                              .map((url) => url.trim())
                              .filter(Boolean)
                          })
                        }
                      />
                    </label>
                    <button
                      className="button button-dark"
                      onClick={saveDraft}
                      disabled={Boolean(busy)}
                    >
                      {busy === "save" ? "Saving…" : "Save draft"}
                    </button>
                  </div>
                ) : (
                  <article className="article-preview">
                    <h1>{draft.title}</h1>
                    <p className="article-excerpt">{draft.excerpt}</p>
                    <div className="article-copy">{draft.content}</div>
                  </article>
                )}
              </section>

              <section className="panel social-card">
                <p className="eyebrow">Distribution copy</p>
                <h3>Facebook caption</h3>
                <p>{draft.facebookCaption}</p>
              </section>
            </>
          )}
        </div>

        <aside className="editor-side">
          <section className="panel review-card">
            <p className="eyebrow">Verification file</p>
            <h3>Source URLs</h3>
            <ul className="source-list">
              {(draft?.sourceUrls.length ? draft.sourceUrls : trend.sourceUrls).map(
                (url, index) => (
                  <li key={url}>
                    <span>{index + 1}</span>
                    <a href={url} target="_blank" rel="noreferrer">
                      {new URL(url).hostname.replace("www.", "")}
                    </a>
                  </li>
                )
              )}
            </ul>
            <hr />
            <h3>Fact-check notes</h3>
            <ul className="check-list">
              {draft?.factCheckNotes.map((note) => <li key={note}>{note}</li>)}
              {!draft && <li>Generate a draft to create verification notes.</li>}
            </ul>
          </section>

          {draft && (
            <>
              <section className="panel image-card">
                <p className="eyebrow">Visual desk</p>
                <h3>Editorial image</h3>
                <div className={`image-status image-status-${draft.imageStatus}`}>
                  <span>{draft.imageStatus || "idle"}</span>
                  {draft.imageModel && <small>{draft.imageModel}</small>}
                  {draft.imageGeneratedAt && (
                    <small>
                      {new Date(draft.imageGeneratedAt).toLocaleString("en-US")}
                    </small>
                  )}
                </div>
                {imagePipelineBusy && (
                  <ol className="image-progress-steps" aria-label="Image generation progress">
                    {["queued", "generating", "upscaling", "optimizing", "completed"].map((step) => (
                      <li key={step} className={step === draft.imageStatus ? "active" : ""}>
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
                {draft.imageError && (
                  <div className="error-banner image-error">{draft.imageError}</div>
                )}
                <div className="image-preview">
                  {previewImageUrl() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewImageUrl()} alt={draft.imageAlt || "Article preview"} />
                  ) : (
                    <span>No image selected</span>
                  )}
                </div>
                {previewImageUrl() && draft.imageDisclosure && (
                  <p className="ai-image-disclosure">{draft.imageDisclosure}</p>
                )}
                <div className="image-badge-row">
                  <span className={`image-source-badge image-source-${draft.imageSourceType}`}>
                    {draft.imageSourceType === "ai"
                      ? "Generated"
                      : draft.imageSourceType === "upload"
                        ? "Manual Upload"
                        : draft.imageSourceType === "licensed_url"
                          ? "Licensed URL"
                          : "Placeholder"}
                  </span>
                </div>
                <label>
                  Image prompt
                  <textarea
                    rows={7}
                    value={draft.imagePrompt}
                    onChange={(event) => field("imagePrompt", event.target.value)}
                  />
                </label>
                <div className="image-action-grid">
                  <button
                    className="button button-secondary"
                    onClick={generateImage}
                    disabled={Boolean(busy) || !aiConfigured || imagePipelineBusy}
                  >
                    {imagePipelineBusy
                      ? "Image pipeline running…"
                      : busy === "image"
                        ? "Generating…"
                        : "Generate Image"}
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => imageMode("regenerate")}
                    disabled={Boolean(busy) || !aiConfigured || !previewImageUrl() || imagePipelineBusy}
                  >
                    {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => imageMode("prompt")}
                    disabled={Boolean(busy)}
                  >
                    {busy === "prompt" ? "Saving…" : "Edit Prompt"}
                  </button>
                  {draft.imageStatus === "failed" && (
                    <button
                      className="button button-secondary"
                      onClick={() => imageMode("retry")}
                      disabled={Boolean(busy) || !aiConfigured}
                    >
                      {busy === "image-retry" ? "Retrying…" : "Retry"}
                    </button>
                  )}
                  {previewImageUrl() && (
                    <a
                      className="button button-secondary"
                      href={previewImageUrl()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Preview
                    </a>
                  )}
                  <button
                    className="button button-publish"
                    onClick={() => imageMode("accept")}
                    disabled={Boolean(busy) || !previewImageUrl()}
                  >
                    Accept Image
                  </button>
                  <button
                    className="button button-secondary"
                    onClick={() => imageMode("remove")}
                    disabled={Boolean(busy) || !previewImageUrl()}
                  >
                    Remove Image
                  </button>
                </div>
                {!aiConfigured && (
                  <p className="api-config-inline">
                    Add <code>OPENAI_API_KEY</code> to enable image generation.
                  </p>
                )}
                {(draft.featuredImage || draft.thumbnailImage) && (
                  <div className="image-asset-list">
                    <span>1200×675: {draft.thumbnailImage || "pending"}</span>
                    <span>1920×1080: {draft.featuredImageUrl || draft.featuredImage || "pending"}</span>
                    <span>OpenGraph: {draft.openGraphImage || "pending"}</span>
                    <span>Twitter: {draft.twitterImage || "pending"}</span>
                  </div>
                )}
                <div className="image-meta-preview">
                  <span>Alt: {draft.imageAlt || "Not set"}</span>
                  <span>Caption: {draft.imageCaption || "Not set"}</span>
                  <span>Disclosure: {draft.imageDisclosure || "None"}</span>
                </div>
                <p className="license-line">
                  {draft.imageLicense || "License not set"}
                  {draft.imageCredit ? ` · ${draft.imageCredit}` : ""}
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

              <section className="panel publish-card">
                <p className="eyebrow">Final gate</p>
                <h3>{draft.status === "published" ? "Published" : "Ready to publish?"}</h3>
                {draft.status !== "published" && (
                  <>
                    <label className="confirm-row">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                      />
                      <span>
                        I checked the sources, factual claims, headline and image
                        license.
                      </span>
                    </label>
                    <button
                      className="button button-publish button-full"
                      onClick={publish}
                      disabled={!confirmed || Boolean(busy)}
                    >
                      {busy === "publish" ? "Publishing…" : "Publish article"}
                    </button>
                  </>
                )}
              </section>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
