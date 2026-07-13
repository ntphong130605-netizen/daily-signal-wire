"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type IndexingAction = "publish" | "update" | "delete";

function endpointFor(action: IndexingAction) {
  return `/api/indexing/${action}`;
}

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || "Request failed.");
  }
  return result;
}

export function AdminIndexingActions({
  defaultUrl = ""
}: {
  defaultUrl?: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl);
  const [batch, setBatch] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function run(action: IndexingAction, payload: unknown) {
    setMessage("");
    startTransition(() => {
      void (async () => {
        try {
          await postJson(endpointFor(action), payload);
          setMessage("Indexing job queued.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Request failed.");
        }
      })();
    });
  }

  function retry(payload: unknown) {
    setMessage("");
    startTransition(() => {
      void (async () => {
        try {
          await postJson("/api/indexing/retry", payload);
          setMessage("Queue retry started.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Retry failed.");
        }
      })();
    });
  }

  const batchUrls = batch
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <section className="panel admin-form-panel indexing-actions">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Manual tools</p>
          <h2>Submit URLs</h2>
        </div>
      </div>
      <div className="indexing-form-grid">
        <label>
          Single URL
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://daily-signal-wire.vercel.app/news/example"
            type="url"
          />
        </label>
        <div className="indexing-button-row">
          <button
            className="button"
            disabled={isPending || !url.trim()}
            onClick={() => run("publish", { url })}
            type="button"
          >
            Publish URL
          </button>
          <button
            className="button button-secondary"
            disabled={isPending || !url.trim()}
            onClick={() => run("update", { url })}
            type="button"
          >
            Update URL
          </button>
          <button
            className="button button-secondary"
            disabled={isPending || !url.trim()}
            onClick={() => run("delete", { url })}
            type="button"
          >
            Delete URL
          </button>
        </div>
        <label>
          Batch URLs
          <textarea
            value={batch}
            onChange={(event) => setBatch(event.target.value)}
            placeholder="One URL per line"
            rows={6}
          />
        </label>
        <div className="indexing-button-row">
          <button
            className="button"
            disabled={isPending || batchUrls.length === 0}
            onClick={() => run("publish", { urls: batchUrls })}
            type="button"
          >
            Batch Publish
          </button>
          <button
            className="button button-secondary"
            disabled={isPending || batchUrls.length === 0}
            onClick={() => run("update", { urls: batchUrls })}
            type="button"
          >
            Batch Update
          </button>
          <button
            className="button button-secondary"
            disabled={isPending || batchUrls.length === 0}
            onClick={() => run("delete", { urls: batchUrls })}
            type="button"
          >
            Batch Delete
          </button>
        </div>
        <div className="indexing-button-row">
          <button
            className="button button-secondary"
            disabled={isPending}
            onClick={() => retry({ mode: "pending", limit: 25 })}
            type="button"
          >
            Process Pending
          </button>
          <button
            className="button button-secondary"
            disabled={isPending}
            onClick={() => retry({ mode: "failed", limit: 25 })}
            type="button"
          >
            Retry Failed
          </button>
        </div>
        {message && <p className="growth-inline-message">{message}</p>}
      </div>
    </section>
  );
}

export function RetryIndexingJobButton({ id }: { id: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function retry() {
    setMessage("");
    startTransition(() => {
      void (async () => {
        try {
          await postJson("/api/indexing/retry", { id });
          setMessage("Retry queued.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Retry failed.");
        }
      })();
    });
  }

  return (
    <div className="indexing-inline-action">
      <button
        className="button button-secondary"
        disabled={isPending}
        onClick={retry}
        type="button"
      >
        Retry
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}
