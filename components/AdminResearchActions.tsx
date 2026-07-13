"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  id?: string;
  detailHref?: string;
  canGenerate?: boolean;
  blocked?: boolean;
  showRefresh?: boolean;
};

async function postJson(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    trendUrl?: string;
    postUrl?: string;
    message?: string;
  };
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

export default function AdminResearchActions({
  id,
  detailHref,
  canGenerate = true,
  blocked = false,
  showRefresh = false
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function run(action: () => Promise<void>) {
    setMessage("");
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Action failed.");
      }
    });
  }

  return (
    <div className="admin-research-actions">
      {showRefresh && (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            run(async () => {
              const result = await postJson("/api/admin/research/refresh");
              setMessage(result.message || "Research refresh completed.");
              router.refresh();
            })
          }
        >
          Refresh Sources
        </button>
      )}
      {detailHref && <Link href={detailHref}>Open Brief</Link>}
      {id && (
        <>
          <button
            type="button"
            disabled={isPending || !canGenerate || blocked}
            onClick={() =>
              run(async () => {
                const result = await postJson("/api/ai/write", {
                  researchCandidateId: id,
                  tone: "Neutral"
                });
                if (result.postUrl) {
                  window.location.href = result.postUrl;
                  return;
                }
                setMessage(result.message || "Draft generated.");
                router.refresh();
              })
            }
          >
            Generate Article Draft
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                await postJson(`/api/admin/research/${id}/status`, { status: "monitoring" });
                router.refresh();
              })
            }
          >
            Monitor
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              run(async () => {
                await postJson(`/api/admin/research/${id}/status`, { status: "ignored" });
                router.refresh();
              })
            }
          >
            Ignore
          </button>
          <button
            type="button"
            disabled={isPending}
            className="danger-action"
            onClick={() =>
              run(async () => {
                await postJson(`/api/admin/research/${id}/status`, { status: "blocked" });
                router.refresh();
              })
            }
          >
            Block
          </button>
        </>
      )}
      {message && <small>{message}</small>}
    </div>
  );
}
