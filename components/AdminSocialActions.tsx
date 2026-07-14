"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type PostOption = {
  id: string;
  title: string;
  slug: string;
};

async function postJson(url: string, body: Record<string, unknown> = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

export function SocialQueueCreateForm({
  posts,
  platforms
}: {
  posts: PostOption[];
  platforms: string[];
}) {
  const router = useRouter();
  const [postId, setPostId] = useState(posts[0]?.id || "");
  const [selected, setSelected] = useState<string[]>(platforms);
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function toggle(platform: string) {
    setSelected((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  return (
    <div className="distribution-create social-create">
      <select
        aria-label="Article"
        value={postId}
        onChange={(event) => setPostId(event.target.value)}
      >
        {posts.map((post) => (
          <option key={post.id} value={post.id}>
            {post.title}
          </option>
        ))}
      </select>
      <input
        aria-label="Schedule time"
        type="datetime-local"
        value={scheduledAt}
        onChange={(event) => setScheduledAt(event.target.value)}
      />
      <div className="distribution-platform-pills">
        {platforms.map((platform) => (
          <label key={platform}>
            <input
              type="checkbox"
              checked={selected.includes(platform)}
              onChange={() => toggle(platform)}
            />
            <span>{platform}</span>
          </label>
        ))}
      </div>
      <button
        className="button button-publish"
        disabled={busy || !postId || selected.length === 0}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const result = await postJson("/api/admin/social", {
              postId,
              platforms: selected,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined
            });
            setMessage(`${result.jobs?.length || 0} social posts queued.`);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Social queue failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Queueing…" : "Create Social Queue"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}

export function SocialPostActionButton({
  id,
  action,
  label
}: {
  id: string;
  action: "retry" | "publish_now" | "cancel";
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="button button-secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await postJson(`/api/admin/social/${id}`, { action });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Working…" : label}
    </button>
  );
}
