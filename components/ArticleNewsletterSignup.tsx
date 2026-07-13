"use client";

import { FormEvent, useState } from "react";
import { trackNewsletter } from "@/lib/analytics";

export default function ArticleNewsletterSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
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
    trackNewsletter({ source: "article_page" });
    setEmail("");
  }

  return (
    <section className="article-newsletter-card" aria-labelledby="article-newsletter-heading">
      <p className="section-kicker">Daily briefing</p>
      <h2 id="article-newsletter-heading">Get the newsroom brief before the noise</h2>
      <p>
        Source-first updates, trend context and editor-reviewed AI newsroom drafts — sent
        when there is something worth reading.
      </p>
      <form onSubmit={subscribe}>
        <label htmlFor="article-newsletter-email">Email address</label>
        <div>
          <input
            id="article-newsletter-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Subscribing…" : "Subscribe"}
          </button>
        </div>
      </form>
      {message && (
        <small className={state === "error" ? "newsletter-error" : ""}>
          {message}
        </small>
      )}
    </section>
  );
}
