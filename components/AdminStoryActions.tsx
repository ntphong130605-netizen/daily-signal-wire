"use client";

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

export default function AdminStoryActions({
  storyId,
  title,
  hook,
  sourceUrl,
  aiConfigured
}: {
  storyId: string;
  title: string;
  hook: string;
  sourceUrl: string;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function action(path: string) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Action failed");
    return body;
  }

  async function markRead() {
    setBusy("read");
    setMessage("");
    try {
      await action(`/api/admin/stories/${storyId}/read`);
      setMessage("Read state updated");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setBusy("save");
    setMessage("");
    try {
      const body = await action(`/api/admin/stories/${storyId}/save`);
      setMessage(body.saved ? "Saved" : "Unsaved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function convert() {
    if (!aiConfigured) {
      setMessage("Configure OPENAI_API_KEY first");
      return;
    }
    setBusy("convert");
    setMessage("");
    try {
      const body = await action(`/api/admin/stories/${storyId}/convert`);
      setMessage(`Draft created: ${body.slug}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft failed");
    } finally {
      setBusy("");
    }
  }

  async function copyFacebook() {
    const shortHook = hook.length > 180 ? `${hook.slice(0, 177).trimEnd()}…` : hook;
    const copied = await copyText(
      `${title}\n\n${shortHook}\n\nRead full story:\n${sourceUrl}`
    );
    setMessage(copied ? "Facebook post copied" : "Copy blocked");
  }

  return (
    <div className="admin-story-actions">
      <button onClick={copyFacebook}>Copy Facebook Post</button>
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        Original
      </a>
      <button onClick={save} disabled={busy === "save"}>
        Save
      </button>
      <button onClick={markRead} disabled={busy === "read"}>
        Read
      </button>
      <button onClick={convert} disabled={busy === "convert" || !aiConfigured}>
        {busy === "convert" ? "Creating…" : "Create Draft"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}
