"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { trackEvent } from "@/lib/client/analytics";

export default function AdminImageStudioActions({
  postId,
  initialPrompt,
  aiConfigured,
  imageStatus,
  hasImage
}: {
  postId: string;
  initialPrompt: string;
  aiConfigured: boolean;
  imageStatus: string;
  hasImage: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const imageBusy = ["queued", "generating", "retrying", "upscaling", "optimizing"].includes(
    imageStatus
  );

  async function call(mode: "prompt" | "generate" | "retry" | "regenerate") {
    setBusy(mode);
    setMessage("");
    const response = await fetch(`/api/admin/posts/${postId}/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, imagePrompt: prompt })
    });
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setMessage(body.error || `${mode} failed`);
      return;
    }
    setMessage(
      mode === "prompt"
        ? "Prompt saved."
        : mode === "retry"
          ? "Image retry complete."
          : mode === "regenerate"
            ? "Image regenerated."
            : "Image generated."
    );
    if (mode !== "prompt") {
      trackEvent("generate_ai_image", { post_id: postId, mode });
    }
    router.refresh();
  }

  return (
    <div className="image-studio-actions">
      <label>
        Prompt
        <textarea
          rows={5}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="AI Image Studio prompt"
        />
      </label>
      <div className="image-studio-button-row">
        <button className="button button-secondary" onClick={() => call("prompt")} disabled={Boolean(busy)}>
          {busy === "prompt" ? "Saving…" : "Save Prompt"}
        </button>
        <button
          className="button button-secondary"
          onClick={() => call("generate")}
          disabled={Boolean(busy) || !aiConfigured || imageBusy}
        >
          {imageBusy ? "Image pipeline running…" : "Generate Image"}
        </button>
        <button
          className="button button-secondary"
          onClick={() => call("retry")}
          disabled={Boolean(busy) || !aiConfigured || imageBusy}
        >
          Retry
        </button>
        <button
          className="button button-publish"
          onClick={() => call("regenerate")}
          disabled={Boolean(busy) || !aiConfigured || imageBusy || !hasImage}
        >
          Regenerate Image
        </button>
      </div>
      {!aiConfigured && <small>OPENAI_API_KEY is required for generation.</small>}
      {message && <small>{message}</small>}
    </div>
  );
}
