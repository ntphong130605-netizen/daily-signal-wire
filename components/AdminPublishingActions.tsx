"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { trackEvent } from "@/lib/client/analytics";

type ActionResponse = {
  ok?: boolean;
  error?: string;
  status?: string;
};

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as ActionResponse;
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

export default function AdminPublishingActions({
  postId,
  slug,
  title,
  status,
  initialScheduleAt,
  initialTimezone
}: {
  postId: string;
  slug: string;
  title: string;
  status: string;
  initialScheduleAt: string;
  initialTimezone: string;
}) {
  const router = useRouter();
  const browserTimezone = useMemo(() => {
    if (typeof Intl === "undefined") return "UTC";
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  }, []);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [scheduleAt, setScheduleAt] = useState(initialScheduleAt);
  const [timezone, setTimezone] = useState(initialTimezone || browserTimezone);
  const [recurrence, setRecurrence] = useState("none");
  const [queueMode, setQueueMode] = useState(false);

  async function run(label: string, action: () => Promise<ActionResponse>) {
    setBusy(label);
    setMessage("");
    try {
      const result = await action();
      setMessage(`${label} complete${result.status ? ` · ${result.status}` : ""}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setBusy("");
    }
  }

  function confirmPublish() {
    return window.confirm(
      "Publish this article now? Confirm editorial review, source checks, SEO and image review are complete."
    );
  }

  return (
    <div className="publishing-actions">
      <div className="publishing-button-row">
        <button
          className="button button-publish"
          disabled={Boolean(busy) || status === "published"}
          onClick={() =>
            run("Approve", () =>
              postJson("/api/approve", {
                postId,
                confirmedFactCheck: true,
                note: "Approved from Publishing Center."
              })
            )
          }
        >
          Approve
        </button>
        <button
          className="button button-secondary"
          disabled={Boolean(busy) || status === "published"}
          onClick={() => {
            const reason =
              window.prompt("Why should this article be rejected?") ||
              "Rejected by editor for revision.";
            return run("Reject", () => postJson("/api/reject", { postId, reason }));
          }}
        >
          Reject
        </button>
        <button
          className="button button-dark"
          disabled={Boolean(busy) || status === "published"}
          onClick={() => {
            if (!confirmPublish()) return;
            run("Publish now", () =>
              postJson("/api/publish/now", {
                postId,
                confirmedFactCheck: true,
                approvalOverride: true
              }).then((result) => {
                trackEvent("publish_article", { post_id: postId, article_slug: slug });
                return result;
              })
            );
          }}
        >
          Publish Now
        </button>
        <Link
          className="button button-secondary"
          href={`/news/${slug}${status === "published" ? "" : "?preview=1"}`}
          target="_blank"
        >
          Preview
        </Link>
        <Link className="button button-secondary" href={`/admin/posts/${postId}`}>
          Edit
        </Link>
        <button
          className="button button-secondary"
          disabled={Boolean(busy) || status === "archived"}
          onClick={() =>
            run("Archive", () =>
              postJson(`/api/admin/posts/${postId}/status`, {
                action: "archive",
                note: "Archived from Publishing Center."
              })
            )
          }
        >
          Archive
        </button>
      </div>

      {status !== "published" && status !== "archived" && (
        <div className="publishing-schedule-grid">
          <label>
            Date and time
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
          </label>
          <label>
            Timezone
            <input
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="America/New_York"
            />
          </label>
          <label>
            Recurrence
            <select
              value={recurrence}
              onChange={(event) => setRecurrence(event.target.value)}
            >
              <option value="none">None</option>
              <option value="daily">Daily cadence</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label className="publishing-checkbox">
            <input
              type="checkbox"
              checked={queueMode}
              onChange={(event) => setQueueMode(event.target.checked)}
            />
            Queue mode
          </label>
          <button
            className="button button-publish"
            disabled={Boolean(busy) || !scheduleAt}
            onClick={() =>
              run(status === "scheduled" ? "Reschedule" : "Schedule", () =>
                postJson("/api/schedule", {
                  postId,
                  publishAt: new Date(scheduleAt).toISOString(),
                  timezone,
                  recurrence,
                  queueMode,
                  confirmedFactCheck: true
                })
              )
            }
          >
            {status === "scheduled" ? "Reschedule" : "Schedule"}
          </button>
        </div>
      )}
      {message && <small className="publishing-action-message">{message}</small>}
      <small className="publishing-action-note">
        “{title}” can only be auto-published after approval, image, fact-check and
        SEO validation pass.
      </small>
    </div>
  );
}
