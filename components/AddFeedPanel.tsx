"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type FolderOption = { id: string; name: string };

export default function AddFeedPanel({ folders }: { folders: FolderOption[] }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [folderId, setFolderId] = useState(folders[0]?.id || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/admin/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, folderId: folderId || undefined })
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(
        response.status === 401
          ? "Admin login required to add feeds."
          : body.error || "Could not add this feed."
      );
      return;
    }
    setUrl("");
    setMessage(`Feed added. ${body.imported || 0} stories imported.`);
    router.refresh();
  }

  return (
    <form className="reader-add-feed" onSubmit={submit}>
      <div>
        <strong>Add Feed</strong>
        <span>RSS URL or website URL</span>
      </div>
      <input
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://example.com/rss"
        required
      />
      {folders.length > 0 && (
        <select value={folderId} onChange={(event) => setFolderId(event.target.value)}>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
      )}
      <button disabled={busy}>{busy ? "Adding…" : "+ Add Feed"}</button>
      {message && <small>{message}</small>}
    </form>
  );
}
