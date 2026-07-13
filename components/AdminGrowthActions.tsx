"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PlanItem = {
  id: string;
  topic: string;
  category: string;
  status: string;
  priority: number;
  plannedFor: string;
  timezone: string;
  targetKeywords: string[];
};

type PublishedPostOption = {
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
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

async function patchJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload;
}

export function GeneratePlanButton({ days = 7 }: { days?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="growth-action-inline">
      <button
        className="button button-publish"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const result = await postJson("/api/admin/growth/planner/generate", { days });
            setMessage(`${result.created || 0} plan items created.`);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Planner failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Planning…" : "Generate Publishing Calendar"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}

export function ContentPlannerBoard({ items }: { items: PlanItem[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState("");
  const [message, setMessage] = useState("");
  const days = useMemo(() => {
    const root = new Date();
    root.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(root);
      day.setDate(root.getDate() + index);
      return day;
    });
  }, []);

  function dayKey(value: Date) {
    return value.toISOString().slice(0, 10);
  }

  async function updateItem(id: string, body: Record<string, unknown>) {
    try {
      await patchJson(`/api/admin/growth/planner/${id}`, body);
      setMessage("Calendar updated.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    }
  }

  return (
    <div>
      <div className="planner-board" aria-label="Content planner calendar">
        {days.map((day) => {
          const key = dayKey(day);
          const dayItems = items.filter(
            (item) => new Date(item.plannedFor).toISOString().slice(0, 10) === key
          );
          return (
            <section
              className="planner-day"
              key={key}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (!dragging) return;
                const dropped = items.find((item) => item.id === dragging);
                const next = new Date(day);
                const previous = dropped ? new Date(dropped.plannedFor) : new Date();
                next.setHours(previous.getHours(), previous.getMinutes(), 0, 0);
                updateItem(dragging, { plannedFor: next.toISOString() });
                setDragging("");
              }}
            >
              <div className="planner-day-head">
                <strong>
                  {new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric"
                  }).format(day)}
                </strong>
                <span>{dayItems.length}</span>
              </div>
              {dayItems.length === 0 ? (
                <div className="planner-empty-slot">Drop story here</div>
              ) : (
                dayItems.map((item) => (
                  <article
                    className={`planner-card priority-${item.priority}`}
                    draggable
                    key={item.id}
                    onDragStart={() => setDragging(item.id)}
                    onDragEnd={() => setDragging("")}
                  >
                    <span>{item.category}</span>
                    <strong>{item.topic}</strong>
                    <small>
                      {new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit"
                      }).format(new Date(item.plannedFor))}{" "}
                      · P{item.priority} · {item.status}
                    </small>
                    <div className="planner-card-actions">
                      <select
                        value={item.status}
                        onChange={(event) =>
                          updateItem(item.id, { status: event.target.value })
                        }
                      >
                        <option value="planned">Planned</option>
                        <option value="drafting">Drafting</option>
                        <option value="ready">Ready</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="published">Published</option>
                        <option value="skipped">Skipped</option>
                      </select>
                      <select
                        value={item.priority}
                        onChange={(event) =>
                          updateItem(item.id, { priority: Number(event.target.value) })
                        }
                      >
                        {[1, 2, 3, 4, 5].map((priority) => (
                          <option value={priority} key={priority}>
                            P{priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))
              )}
            </section>
          );
        })}
      </div>
      {message && <p className="growth-inline-message">{message}</p>}
    </div>
  );
}

export function DistributionCreateForm({
  posts,
  platforms
}: {
  posts: PublishedPostOption[];
  platforms: string[];
}) {
  const router = useRouter();
  const [postId, setPostId] = useState(posts[0]?.id || "");
  const [selected, setSelected] = useState<string[]>(["facebook", "x", "rss"]);
  const [mode, setMode] = useState<"manual" | "scheduled" | "auto">("manual");
  const [scheduledAt, setScheduledAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function toggle(platform: string) {
    setSelected((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform]
    );
  }

  return (
    <div className="distribution-create">
      <select value={postId} onChange={(event) => setPostId(event.target.value)}>
        {posts.map((post) => (
          <option key={post.id} value={post.id}>
            {post.title}
          </option>
        ))}
      </select>
      <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
        <option value="manual">Manual publish</option>
        <option value="scheduled">Scheduled publish</option>
        <option value="auto">Auto publish</option>
      </select>
      {mode === "scheduled" && (
        <input
          type="datetime-local"
          value={scheduledAt}
          onChange={(event) => setScheduledAt(event.target.value)}
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
        disabled={busy || !postId || selected.length === 0}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const result = await postJson("/api/admin/growth/distribution", {
              postId,
              platforms: selected,
              mode,
              scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined
            });
            setMessage(`${result.jobs?.length || 0} distribution jobs created.`);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Distribution failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Creating…" : "Create Distribution Jobs"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}

export function DistributionJobButton({
  id,
  action,
  label
}: {
  id: string;
  action: "retry" | "mark_sent" | "mark_failed";
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
          await postJson(`/api/admin/growth/distribution/${id}`, { action });
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

export function AnalyzePostButton({
  endpoint,
  postId,
  label
}: {
  endpoint: string;
  postId: string;
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
          await postJson(endpoint, { postId });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Analyzing…" : label}
    </button>
  );
}

export function SystemCheckButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <div className="growth-action-inline">
      <button
        className="button button-publish"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage("");
          try {
            const result = await postJson("/api/admin/growth/system/check");
            setMessage(`${result.checks?.length || 0} checks recorded.`);
            router.refresh();
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "System check failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking…" : "Run System Check"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}

export function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="button button-secondary"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
