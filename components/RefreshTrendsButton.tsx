"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RefreshTrendsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/trends/refresh", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    setMessage(body.message || body.error || "Trend refresh finished.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="refresh-trends-action">
      <button className="button button-secondary" onClick={refresh} disabled={busy}>
        {busy ? "Refreshing…" : "Refresh Google Trends"}
      </button>
      {message && <small>{message}</small>}
    </div>
  );
}
