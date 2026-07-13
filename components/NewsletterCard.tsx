"use client";

import { FormEvent, useState } from "react";
import { trackNewsletter } from "@/lib/analytics";

export default function NewsletterCard() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");

  async function subscribe(event: FormEvent) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    const response = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState("error");
      setMessage(body.error || "Unable to subscribe.");
      return;
    }
    setState("success");
    setMessage("You’re on the list. Watch your inbox.");
    trackNewsletter({ source: "newsletter_card" });
    setEmail("");
  }

  return (
    <section className="newsletter-card">
      <span className="newsletter-icon">✦</span>
      <p className="section-kicker">The Daily Brief</p>
      <h2>Signal, not noise.</h2>
      <p>One concise email with the stories and context worth your attention.</p>
      <form onSubmit={subscribe}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-label="Email address"
        />
        <button disabled={state === "loading"}>
          {state === "loading" ? "Joining…" : "Join free"}
        </button>
      </form>
      {message && (
        <small className={state === "error" ? "newsletter-error" : ""}>
          {message}
        </small>
      )}
    </section>
  );
}
