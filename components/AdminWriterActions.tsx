"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const tones = ["Neutral", "Business", "Breaking", "Analysis"] as const;

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    postUrl?: string;
    previewUrl?: string;
  };
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

export default function AdminWriterActions({
  researchCandidateId,
  trendId,
  existingPostId,
  disabled = false
}: {
  researchCandidateId?: string;
  trendId?: string;
  existingPostId?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [tone, setTone] = useState<(typeof tones)[number]>("Neutral");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function generate() {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await postJson("/api/ai/write", {
          researchCandidateId,
          trendId,
          tone
        });
        if (result.postUrl) {
          window.location.href = result.postUrl;
          return;
        }
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "AI writer failed.");
      }
    });
  }

  return (
    <div className="admin-writer-actions">
      <select
        value={tone}
        onChange={(event) => setTone(event.target.value as (typeof tones)[number])}
        aria-label="Writer tone"
      >
        {tones.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button onClick={generate} disabled={disabled || isPending}>
        {isPending ? "Writing…" : existingPostId ? "Regenerate Draft" : "Generate Draft"}
      </button>
      {existingPostId && <Link href={`/admin/posts/${existingPostId}`}>Edit Draft</Link>}
      {message && <small>{message}</small>}
    </div>
  );
}
