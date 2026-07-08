"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function OpmlImportForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/opml", {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: value
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "OPML import failed");
      return;
    }
    setMessage(`${body.imported || 0} feeds imported`);
    setValue("");
    router.refresh();
  }

  return (
    <form className="opml-import-form" onSubmit={submit}>
      <label>
        Paste OPML
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="<opml>…</opml>"
          rows={6}
          required
        />
      </label>
      <button disabled={busy}>{busy ? "Importing…" : "Import OPML"}</button>
      {message && <small>{message}</small>}
    </form>
  );
}
