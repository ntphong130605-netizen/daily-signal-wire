"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error || "Unable to sign in");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <Logo />
        <div>
          <p className="eyebrow">Newsroom access</p>
          <h1>Welcome back.</h1>
          <p>Sign in to review AI-assisted drafts and source notes.</p>
        </div>
        <label>
          Admin password
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="button button-accent button-full" disabled={loading}>
          {loading ? "Signing in…" : "Enter newsroom"}
        </button>
      </form>
    </main>
  );
}
