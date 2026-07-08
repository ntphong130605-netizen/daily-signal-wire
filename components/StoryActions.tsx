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

export default function StoryActions({
  storyId,
  title,
  hook,
  sourceUrl,
  isSaved,
  aiConfigured
}: {
  storyId: string;
  title: string;
  hook: string;
  sourceUrl: string;
  isSaved: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(isSaved);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function post(path: string, body?: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? "{}" : JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? "Admin login required."
          : payload.error || "Action failed."
      );
    }
    return payload;
  }

  async function markRead() {
    setBusy("read");
    setMessage("");
    try {
      await post(`/api/admin/stories/${storyId}/read`, { isRead: true });
      setMessage("Marked as read");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function saveStory() {
    setBusy("save");
    setMessage("");
    try {
      const payload = await post(`/api/admin/stories/${storyId}/save`);
      setSaved(Boolean(payload.saved));
      setMessage(payload.saved ? "Story saved" : "Story unsaved");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function tagStory() {
    const tag = window.prompt("Tag this story");
    if (!tag) return;
    setBusy("tag");
    setMessage("");
    try {
      await post(`/api/admin/stories/${storyId}/tag`, { tag });
      setMessage(`Tagged: ${tag}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy("");
    }
  }

  async function shareStory() {
    const shareData = { title, text: hook, url: sourceUrl };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Fall back to copying.
      }
    }
    const copied = await copyText(sourceUrl);
    setMessage(copied ? "Story URL copied" : "Share blocked");
  }

  async function copyFacebookPost() {
    const shortHook = hook.length > 180 ? `${hook.slice(0, 177).trimEnd()}…` : hook;
    const copied = await copyText(
      `${title}\n\n${shortHook}\n\nRead full story:\n${sourceUrl}`
    );
    setMessage(copied ? "Facebook post copied" : "Copy blocked");
  }

  async function convertToDraft() {
    if (!aiConfigured) {
      setMessage("Configure OPENAI_API_KEY before creating AI drafts.");
      return;
    }
    setBusy("convert");
    setMessage("");
    try {
      const payload = await post(`/api/admin/stories/${storyId}/convert`);
      setMessage(`AI draft created: ${payload.slug}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Draft failed");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="story-action-panel">
      <button onClick={saveStory} disabled={busy === "save"}>
        {saved ? "Saved" : "Save"}
      </button>
      <button onClick={tagStory} disabled={busy === "tag"}>
        Tag
      </button>
      <button onClick={shareStory}>Share</button>
      <button onClick={copyFacebookPost}>Copy Facebook Post</button>
      <button onClick={markRead} disabled={busy === "read"}>
        Mark read
      </button>
      <button
        className="story-draft-button"
        onClick={convertToDraft}
        disabled={busy === "convert" || !aiConfigured}
        title={!aiConfigured ? "OPENAI_API_KEY is not configured" : undefined}
      >
        {busy === "convert" ? "Creating…" : "Convert to AI Article Draft"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}
