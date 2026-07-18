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
  const [publishMode, setPublishMode] = useState<"immediate" | "schedule">("immediate");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [priority, setPriority] = useState(3);
  const [recurrence, setRecurrence] = useState("none");
  const [recurrenceEndsAt, setRecurrenceEndsAt] = useState("");
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
      <select
        aria-label="Publish mode"
        value={publishMode}
        onChange={(event) => setPublishMode(event.target.value as "immediate" | "schedule")}
      >
        <option value="immediate">Publish immediately</option>
        <option value="schedule">Schedule later</option>
      </select>
      {publishMode === "schedule" && (
        <input
          aria-label="Schedule time"
          type="datetime-local"
          value={scheduledLocal}
          onChange={(event) => setScheduledLocal(event.target.value)}
          required
        />
      )}
      <select aria-label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
        <option value="America/New_York">New York (ET)</option>
        <option value="America/Chicago">Chicago (CT)</option>
        <option value="America/Denver">Denver (MT)</option>
        <option value="America/Los_Angeles">Los Angeles (PT)</option>
        <option value="UTC">UTC</option>
        <option value="Asia/Ho_Chi_Minh">Ho Chi Minh City</option>
      </select>
      <select
        aria-label="Priority"
        value={priority}
        onChange={(event) => setPriority(Number(event.target.value))}
      >
        <option value={1}>Priority 1 — Urgent</option>
        <option value={2}>Priority 2 — High</option>
        <option value={3}>Priority 3 — Normal</option>
        <option value={4}>Priority 4 — Low</option>
        <option value={5}>Priority 5 — Backfill</option>
      </select>
      <select
        aria-label="Recurrence"
        value={recurrence}
        onChange={(event) => setRecurrence(event.target.value)}
      >
        <option value="none">One-time publish</option>
        <option value="daily">Repeat daily</option>
        <option value="weekly">Repeat weekly</option>
        <option value="monthly">Repeat monthly</option>
      </select>
      {recurrence !== "none" && (
        <input
          aria-label="Recurrence end"
          type="datetime-local"
          value={recurrenceEndsAt}
          onChange={(event) => setRecurrenceEndsAt(event.target.value)}
        />
      )}
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
        disabled={
          busy ||
          !postId ||
          selected.length === 0 ||
          (publishMode === "schedule" && !scheduledLocal)
        }
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const result = await postJson("/api/admin/distribution/queue", {
              postId,
              platforms: selected,
              scheduledLocal: publishMode === "schedule" ? scheduledLocal : undefined,
              timezone,
              priority,
              recurrence,
              recurrenceEndsAt: recurrenceEndsAt
                ? new Date(recurrenceEndsAt).toISOString()
                : undefined,
              publishImmediately: publishMode === "immediate"
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
        {busy ? "Preparing…" : publishMode === "immediate" ? "Prepare & Publish" : "Schedule Distribution"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}

export function SocialPostActionButton({
  id,
  action,
  label,
  variantKey
}: {
  id: string;
  action: "retry" | "publish_now" | "cancel" | "pause" | "resume" | "select_variant";
  label: string;
  variantKey?: string;
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
          await postJson(`/api/admin/distribution/queue/${id}`, { action, variantKey });
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

export function SocialVariantSelect({
  id,
  value,
  variants
}: {
  id: string;
  value: string;
  variants: Array<{ variantKey: string; label: string }>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(value);
  const [busy, setBusy] = useState(false);
  return (
    <label className="social-variant-select">
      <span>A/B variant</span>
      <select
        aria-label="A/B variant"
        value={selected}
        disabled={busy}
        onChange={async (event) => {
          const next = event.target.value;
          setSelected(next);
          setBusy(true);
          try {
            await postJson(`/api/admin/distribution/queue/${id}`, {
              action: "select_variant",
              variantKey: next
            });
            router.refresh();
          } finally {
            setBusy(false);
          }
        }}
      >
        {variants.map((variant) => (
          <option key={variant.variantKey} value={variant.variantKey}>
            {variant.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SocialQueueControlButton({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className={paused ? "button button-publish" : "button button-secondary"}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await postJson("/api/admin/distribution/settings", {
            action: paused ? "resume" : "pause"
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Updating…" : paused ? "Resume queue" : "Pause queue"}
    </button>
  );
}
