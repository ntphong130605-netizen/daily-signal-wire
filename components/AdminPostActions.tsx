"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackEvent, trackImageGeneration, trackPublish } from "@/lib/client/analytics";

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

export default function AdminPostActions({
  id,
  slug,
  title,
  hook,
  status,
  aiConfigured,
  imageStatus,
  hasImage
}: {
  id: string;
  slug: string;
  title: string;
  hook: string;
  status: string;
  aiConfigured: boolean;
  imageStatus: string;
  hasImage: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const imageBusy = ["queued", "generating", "retrying", "upscaling", "optimizing"].includes(
    imageStatus
  );

  function articleUrl() {
    return `${window.location.origin}/news/${slug}`;
  }

  async function copyFacebook() {
    const shortHook =
      hook.length > 180 ? `${hook.slice(0, 177).trimEnd()}…` : hook;
    const copied = await copyText(
      `${title}\n\n${shortHook}\n\nRead full story:\n${articleUrl()}`
    );
    setMessage(copied ? "Facebook post copied" : "Copy blocked");
    trackEvent("copy_facebook_post", { post_id: id, article_slug: slug });
  }

  async function copyUrl() {
    const copied = await copyText(articleUrl());
    setMessage(copied ? "URL copied" : "Copy blocked");
  }

  async function publish() {
    if (
      !window.confirm(
        "Confirm that sources, claims, headline and image license were reviewed."
      )
    ) {
      return;
    }
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/posts/${id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmedFactCheck: true })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Publish failed");
      return;
    }
    setMessage("Published");
    trackPublish({ post_id: id, article_slug: slug });
    router.refresh();
  }

  async function imageAction(mode: "generate" | "regenerate") {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/posts/${id}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Image generation failed");
      return;
    }
    setMessage(mode === "generate" ? "Image generated" : "Image regenerated");
    trackImageGeneration({ post_id: id, mode });
    router.refresh();
  }

  async function regenerateArticle() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/posts/${id}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "article" })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Article regeneration failed");
      return;
    }
    setMessage("Article regenerated");
    trackEvent("generate_ai_article", { post_id: id, mode: "regenerate" });
    router.refresh();
  }

  async function rejectDraft() {
    const rejectionReason =
      window.prompt("Why should this draft be rejected?") ||
      "Rejected by editor for revision.";
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/posts/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejectionReason })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Reject failed");
      return;
    }
    setMessage("Rejected");
    router.refresh();
  }

  return (
    <div className="admin-post-actions">
      <button onClick={copyFacebook}>Copy Facebook Post</button>
      <button onClick={copyUrl}>Copy URL</button>
      <Link
        href={`/news/${slug}${status === "published" ? "" : "?preview=1"}`}
        target="_blank"
      >
        Preview
      </Link>
      <Link href={`/admin/posts/${id}`}>Edit</Link>
      {status !== "published" && (
        <button onClick={regenerateArticle} disabled={busy || !aiConfigured}>
          Regenerate Article
        </button>
      )}
      <button
        onClick={() => imageAction("generate")}
        disabled={busy || !aiConfigured || imageBusy}
        title={!aiConfigured ? "OPENAI_API_KEY is not configured" : undefined}
      >
        {imageBusy ? "Image pipeline running…" : "Generate Image"}
      </button>
      <button
        onClick={() => imageAction("regenerate")}
        disabled={busy || !aiConfigured || !hasImage || imageBusy}
        title={!aiConfigured ? "OPENAI_API_KEY is not configured" : undefined}
      >
        Regenerate Image
      </button>
      {status !== "published" && (
        <button onClick={rejectDraft} disabled={busy || status === "rejected"}>
          Reject
        </button>
      )}
      {status !== "published" && status !== "rejected" && (
        <button className="publish-action" onClick={publish} disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      )}
      {message && <small>{message}</small>}
    </div>
  );
}
