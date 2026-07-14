"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackEvent } from "@/lib/client/analytics";

export default function AdminFactCheckActions({
  postId,
  aiConfigured,
  compact = false
}: {
  postId: string;
  aiConfigured: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function call(url: string, body: Record<string, unknown>, label: string) {
    setBusy(label);
    setMessage("");
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setMessage(payload.error || `${label} failed`);
      return null;
    }
    return payload;
  }

  async function runFactCheck(action: "run" | "regenerate_failed_sections") {
    const result = await call(
      "/api/ai/fact-check",
      { postId, action },
      action === "run" ? "fact-check" : "regenerate"
    );
    if (result) {
      setMessage(action === "run" ? "Fact check complete." : "Failed sections regenerated.");
      trackEvent("ai_generate", {
        post_id: postId,
        mode: action === "run" ? "fact_check" : "regenerate_failed_sections"
      });
      router.refresh();
    }
  }

  async function verify(action: "approve" | "reject" | "needs_review" | "low_confidence") {
    const result = await call("/api/ai/verify", { postId, action }, action);
    if (result) {
      setMessage(`${action.replace("_", " ")} saved.`);
      router.refresh();
    }
  }

  return (
    <div className={compact ? "fact-check-actions compact" : "fact-check-actions"}>
      <button
        className="button button-secondary"
        onClick={() => runFactCheck("run")}
        disabled={Boolean(busy)}
      >
        {busy === "fact-check" ? "Checking…" : "Run Fact Check"}
      </button>
      <button
        className="button button-secondary"
        onClick={() => runFactCheck("regenerate_failed_sections")}
        disabled={Boolean(busy) || !aiConfigured}
      >
        {busy === "regenerate" ? "Regenerating…" : "Regenerate Failed Sections"}
      </button>
      <button className="button button-publish" onClick={() => verify("approve")} disabled={Boolean(busy)}>
        Approve
      </button>
      <button className="button button-secondary" onClick={() => verify("needs_review")} disabled={Boolean(busy)}>
        Needs Review
      </button>
      <button className="button button-secondary" onClick={() => verify("reject")} disabled={Boolean(busy)}>
        Reject
      </button>
      {message && <small>{message}</small>}
      {!aiConfigured && (
        <small>Regeneration needs <code>OPENAI_API_KEY</code>; fact-checking still works from saved sources.</small>
      )}
    </div>
  );
}
