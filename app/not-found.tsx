import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="system-state-page">
      <div className="system-state-card">
        <Logo href="/" />
        <p className="eyebrow">404</p>
        <h1>Story not found</h1>
        <p>
          The link may be a draft, unpublished story, or an item that moved out
          of the public newsroom.
        </p>
        <div className="system-state-actions">
          <Link className="button button-dark" href="/">
            Open reader
          </Link>
          <Link className="button button-secondary" href="/admin">
            Admin desk
          </Link>
        </div>
      </div>
    </main>
  );
}
