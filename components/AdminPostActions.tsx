"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  trendId
}: {
  id: string;
  slug: string;
  title: string;
  hook: string;
  status: string;
  trendId: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      {trendId ? <Link href={`/admin/trends/${trendId}`}>Edit</Link> : null}
      {status !== "published" && (
        <button className="publish-action" onClick={publish} disabled={busy}>
          {busy ? "Publishing…" : "Publish"}
        </button>
      )}
      {message && <small>{message}</small>}
    </div>
  );
}
