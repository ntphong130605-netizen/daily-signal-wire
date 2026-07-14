"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/client/analytics";

export default function GenerateDraftButton({
  trendId,
  hasDraft,
  aiConfigured
}: {
  trendId: string;
  hasDraft: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/trends/${trendId}/generate`, {
      method: "POST"
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Generation failed");
      return;
    }
    trackEvent("ai_generate", { trend_id: trendId });
    router.push(`/admin/trends/${trendId}`);
    router.refresh();
  }

  return (
    <div className="generate-draft-cell">
      <button
        className="button button-secondary admin-small-button"
        onClick={generate}
        disabled={busy || !aiConfigured}
        title={
          aiConfigured
            ? undefined
            : "Add OPENAI_API_KEY to .env to enable generation."
        }
      >
        {!aiConfigured
          ? "Configure AI"
          : busy
            ? "Generating…"
            : hasDraft
              ? "Regenerate draft"
              : "Generate draft"}
      </button>
      {error && <small title={error}>Failed</small>}
    </div>
  );
}
