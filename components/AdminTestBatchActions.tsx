"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function mutate(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {})
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    batchId?: string;
    selected?: number;
    result?: { done?: boolean };
  };
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

export function TestBatchToolbar({
  batchId,
  canProcess,
  eligibleCount,
  needsSelection
}: {
  batchId?: string;
  canProcess: boolean;
  eligibleCount: number;
  needsSelection: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function startOrContinue() {
    setBusy(true);
    setMessage("Running the controlled research pass…");
    try {
      let id = batchId;
      if (!id || needsSelection) {
        const created = await mutate("/api/admin/test-batch");
        id = created.batchId;
        setMessage(`${created.selected || 0} eligible topics selected. Processing drafts…`);
      }
      if (!id) throw new Error("Batch ID was not returned.");
      for (let index = 0; index < 10; index += 1) {
        setMessage(`Processing article ${index + 1} of up to 10…`);
        const response = await mutate(`/api/admin/test-batch/${id}`, { action: "process_next" });
        if (response.result?.done) break;
      }
      setMessage("Batch processing finished. No articles were approved or published.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch processing failed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function approveAll() {
    if (!batchId || !eligibleCount) return;
    if (!window.confirm(`Approve and schedule ${eligibleCount} eligible test articles?`)) return;
    setBusy(true);
    setMessage("Approving and scheduling eligible articles…");
    try {
      await mutate(`/api/admin/test-batch/${batchId}`, { action: "approve_all" });
      setMessage("Eligible articles were approved and scheduled with no recurrence.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!batchId || !window.confirm("Cancel every unscheduled item in this one-time batch?")) return;
    setBusy(true);
    try {
      await mutate(`/api/admin/test-batch/${batchId}`, { action: "cancel_remaining" });
      setMessage("Remaining test items were cancelled. Existing drafts were preserved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cancellation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="test-batch-toolbar">
      <button className="primary-action" disabled={busy || (!canProcess && Boolean(batchId) && !needsSelection)} onClick={startOrContinue}>
        {busy ? "Working…" : needsSelection ? "Retry Safe Selection" : batchId ? "Continue Test Batch" : "Run One-Time Test"}
      </button>
      <button disabled={busy || eligibleCount === 0} onClick={approveAll}>
        Approve All Eligible Test Articles
      </button>
      <button className="danger-action" disabled={busy || !batchId} onClick={cancel}>
        Cancel Remaining Batch
      </button>
      {message && <p aria-live="polite">{message}</p>}
    </div>
  );
}

export function TestBatchItemActions({
  itemId,
  postId,
  previewSlug,
  canApprove,
  canRetry,
  disabled
}: {
  itemId: string;
  postId?: string | null;
  previewSlug?: string | null;
  canApprove: boolean;
  canRetry: boolean;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function action(value: "approve" | "reject" | "retry") {
    if (value === "approve" && !window.confirm("Approve and schedule this eligible test article?")) return;
    if (value === "reject" && !window.confirm("Reject this test article?")) return;
    setBusy(true);
    setMessage("");
    try {
      await mutate(`/api/admin/test-batch/items/${itemId}`, { action: value });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="test-batch-row-actions">
      {previewSlug && (
        <a href={`/news/${previewSlug}?preview=1`} target="_blank" rel="noreferrer">
          Preview
        </a>
      )}
      {postId && <a href={`/admin/posts/${postId}`}>Edit</a>}
      <button disabled={busy || disabled || !canApprove} onClick={() => action("approve")}>Approve</button>
      <button disabled={busy || disabled} onClick={() => action("reject")}>Reject</button>
      <button disabled={busy || disabled || !canRetry} onClick={() => action("retry")}>Retry Failed Step</button>
      {message && <small role="alert">{message}</small>}
    </div>
  );
}
