"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AdminFeedActions({ feedId }: { feedId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy(true);
    setMessage("");
    const response = await fetch(`/api/admin/feeds/${feedId}/fetch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Refresh failed");
      return;
    }
    setMessage(`${body.imported || 0} new stories`);
    router.refresh();
  }

  return (
    <div className="admin-feed-actions">
      <button onClick={refresh} disabled={busy}>
        {busy ? "Fetching…" : "Fetch now"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}
