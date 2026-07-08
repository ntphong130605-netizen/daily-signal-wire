"use client";

import Link from "next/link";

export default function ErrorPage({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <p className="eyebrow">Daily Signal Wire</p>
        <h1>Something went wrong</h1>
        <p>
          The newsroom stayed online, but this view could not load. Try again or
          return to the reader while the issue is logged server-side.
        </p>
        <div className="system-state-actions">
          <button className="button button-dark" onClick={reset}>
            Try again
          </button>
          <Link className="button button-secondary" href="/">
            Back to reader
          </Link>
        </div>
      </div>
    </main>
  );
}
