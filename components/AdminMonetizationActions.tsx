"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Request failed.");
  return payload;
}

function Feedback({ message, error }: { message: string; error: boolean }) {
  if (!message) return null;
  return <p className={error ? "growth-error" : "growth-inline-message"}>{message}</p>;
}

export function InitializeAdManagerButton() {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, message: "", error: false });
  return (
    <div className="growth-action-inline">
      <button
        className="button button-publish"
        type="button"
        disabled={state.busy}
        onClick={async () => {
          setState({ busy: true, message: "", error: false });
          try {
            await postJson("/api/admin/ads", { action: "initialize" });
            setState({ busy: false, message: "Ad placement registry synchronized.", error: false });
            router.refresh();
          } catch (error) {
            setState({ busy: false, message: error instanceof Error ? error.message : "Sync failed.", error: true });
          }
        }}
      >
        {state.busy ? "Synchronizing…" : "Synchronize Ad Placements"}
      </button>
      <Feedback message={state.message} error={state.error} />
    </div>
  );
}

export function AdSlotToggle({ slotKey, enabled }: { slotKey: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="button button-small"
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await postJson("/api/admin/ads", { action: "toggle", key: slotKey, enabled: !enabled });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Saving…" : enabled ? "Disable" : "Enable"}
    </button>
  );
}

export function RevenueImportForm() {
  const router = useRouter();
  const [kind, setKind] = useState<"adsense" | "newsletter" | "affiliate_conversion">("adsense");
  const [source, setSource] = useState("adsense_import");
  const [rows, setRows] = useState("");
  const [state, setState] = useState({ busy: false, message: "", error: false });
  return (
    <form
      className="monetization-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ busy: true, message: "", error: false });
        try {
          const parsed = JSON.parse(rows) as unknown;
          if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Provide a non-empty JSON array exported from the official reporting source.");
          const result = await postJson("/api/admin/revenue/import", { kind, source, rows: parsed });
          setState({ busy: false, message: `${result.imported} verified report rows imported.`, error: false });
          router.refresh();
        } catch (error) {
          setState({ busy: false, message: error instanceof Error ? error.message : "Import failed.", error: true });
        }
      }}
    >
      <div className="monetization-form-grid">
        <label>
          Report type
          <select
            value={kind}
            onChange={(event) => {
              const next = event.target.value as typeof kind;
              setKind(next);
              setSource(next === "adsense" ? "adsense_import" : next === "newsletter" ? "resend_import" : "api_import");
            }}
          >
            <option value="adsense">AdSense report</option>
            <option value="newsletter">Newsletter report</option>
            <option value="affiliate_conversion">Affiliate conversions</option>
          </select>
        </label>
        <label>
          Source label
          <input value={source} onChange={(event) => setSource(event.target.value)} maxLength={80} required />
        </label>
      </div>
      <label>
        Official report rows (JSON array)
        <textarea
          value={rows}
          onChange={(event) => setRows(event.target.value)}
          rows={8}
          spellCheck={false}
          placeholder={kind === "adsense" ? '[{"date":"2026-07-18","impressions":0,"clicks":0,"pageViews":0,"estimatedRevenue":0}]' : "Paste official report rows"}
          required
        />
      </label>
      <button className="button button-publish" type="submit" disabled={state.busy}>
        {state.busy ? "Validating…" : "Validate and Import"}
      </button>
      <Feedback message={state.message} error={state.error} />
    </form>
  );
}

export function AffiliateProgramForm() {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, message: "", error: false });
  return (
    <form
      className="monetization-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ busy: true, message: "", error: false });
        const form = new FormData(event.currentTarget);
        try {
          await postJson("/api/admin/affiliate", {
            action: "create_program",
            name: form.get("name"),
            network: form.get("network"),
            websiteUrl: form.get("websiteUrl") || undefined,
            disclosure: form.get("disclosure")
          });
          event.currentTarget.reset();
          setState({ busy: false, message: "Affiliate program added.", error: false });
          router.refresh();
        } catch (error) {
          setState({ busy: false, message: error instanceof Error ? error.message : "Program creation failed.", error: true });
        }
      }}
    >
      <div className="monetization-form-grid">
        <label>Program name<input name="name" minLength={2} maxLength={120} required /></label>
        <label>Network<select name="network"><option value="amazon">Amazon Associates</option><option value="impact">Impact</option><option value="cj">CJ</option><option value="shareasale">ShareASale</option><option value="awin">Awin</option><option value="custom">Custom affiliate</option></select></label>
        <label>Program URL<input name="websiteUrl" type="url" placeholder="https://" /></label>
      </div>
      <label>Required disclosure<textarea name="disclosure" minLength={20} maxLength={500} defaultValue="Daily Signal Wire may earn a commission from qualifying purchases." required /></label>
      <button className="button button-publish" disabled={state.busy}>{state.busy ? "Saving…" : "Add Program"}</button>
      <Feedback message={state.message} error={state.error} />
    </form>
  );
}

export function AffiliateLinkForm({ programs }: { programs: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, message: "", error: false });
  return (
    <form
      className="monetization-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setState({ busy: true, message: "", error: false });
        const form = new FormData(event.currentTarget);
        try {
          await postJson("/api/admin/affiliate", {
            action: "create_link",
            programId: form.get("programId"),
            label: form.get("label"),
            destinationUrl: form.get("destinationUrl"),
            trackingUrl: form.get("trackingUrl"),
            category: form.get("category") || undefined,
            keywords: String(form.get("keywords") || "").split(",").map((item) => item.trim()).filter(Boolean),
            imageUrl: form.get("imageUrl") || undefined,
            priceText: form.get("priceText") || undefined,
            callToAction: form.get("callToAction") || "Learn more"
          });
          event.currentTarget.reset();
          setState({ busy: false, message: "Tracked affiliate link added.", error: false });
          router.refresh();
        } catch (error) {
          setState({ busy: false, message: error instanceof Error ? error.message : "Link creation failed.", error: true });
        }
      }}
    >
      <div className="monetization-form-grid">
        <label>Program<select name="programId" required>{programs.map((program) => <option value={program.id} key={program.id}>{program.name}</option>)}</select></label>
        <label>Label<input name="label" required /></label>
        <label>Destination URL<input name="destinationUrl" type="url" required /></label>
        <label>Tracking URL<input name="trackingUrl" type="url" required /></label>
        <label>Category<input name="category" /></label>
        <label>Keywords<input name="keywords" placeholder="laptop, cloud, business" /></label>
        <label>Image URL<input name="imageUrl" type="url" /></label>
        <label>Price text<input name="priceText" /></label>
        <label>Call to action<input name="callToAction" defaultValue="Learn more" required /></label>
      </div>
      <button className="button button-publish" disabled={state.busy || programs.length === 0}>{state.busy ? "Saving…" : "Add Tracked Link"}</button>
      <Feedback message={state.message || (programs.length === 0 ? "Create a program first." : "")} error={state.error} />
    </form>
  );
}

export function AffiliateStatusButton({ entity, id, status }: { entity: "program" | "link"; id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "active" ? "paused" : "active";
  return <button className="button button-small" type="button" disabled={busy} onClick={async () => { setBusy(true); try { await postJson("/api/admin/affiliate", { action: "set_status", entity, id, status: next }); router.refresh(); } finally { setBusy(false); } }}>{busy ? "Saving…" : next === "active" ? "Activate" : "Pause"}</button>;
}

export function ExperimentCreateForm() {
  const router = useRouter();
  const [state, setState] = useState({ busy: false, message: "", error: false });
  return (
    <form className="monetization-form" onSubmit={async (event) => {
      event.preventDefault();
      setState({ busy: true, message: "", error: false });
      const form = new FormData(event.currentTarget);
      const key = String(form.get("key"));
      try {
        await postJson("/api/admin/experiments", {
          action: "create", key, name: form.get("name"), type: form.get("type"),
          targetArticleSlug: form.get("targetArticleSlug") || undefined,
          targetCategory: form.get("targetCategory") || undefined,
          variants: [
            { key: "control", label: "Control", value: form.get("control"), weight: 50 },
            { key: "challenger", label: "Challenger", value: form.get("challenger"), weight: 50 }
          ]
        });
        event.currentTarget.reset();
        setState({ busy: false, message: "Experiment created as a draft.", error: false });
        router.refresh();
      } catch (error) {
        setState({ busy: false, message: error instanceof Error ? error.message : "Experiment creation failed.", error: true });
      }
    }}>
      <div className="monetization-form-grid">
        <label>Experiment key<input name="key" pattern="[a-z0-9_-]+" required /></label>
        <label>Name<input name="name" required /></label>
        <label>Type<select name="type"><option value="headline">Headline</option><option value="cta">CTA</option><option value="image">Image</option><option value="ad_position">Ad position</option></select></label>
        <label>Article slug (optional)<input name="targetArticleSlug" /></label>
        <label>Category (optional)<input name="targetCategory" /></label>
        <label>Control value<input name="control" required /></label>
        <label>Challenger value<input name="challenger" required /></label>
      </div>
      <button className="button button-publish" disabled={state.busy}>{state.busy ? "Creating…" : "Create 50/50 Test"}</button>
      <Feedback message={state.message} error={state.error} />
    </form>
  );
}

export function ExperimentAction({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <div className="growth-row-actions"><button className="button button-small" disabled={busy} onClick={async () => { setBusy(true); try { await postJson("/api/admin/experiments", { action: "status", id, status: status === "active" ? "paused" : "active" }); router.refresh(); } finally { setBusy(false); } }}>{status === "active" ? "Pause" : "Activate"}</button><button className="button button-small" disabled={busy} onClick={async () => { setBusy(true); try { await postJson("/api/admin/experiments", { action: "select_winner", id, automatic: true }); router.refresh(); } finally { setBusy(false); } }}>Select measured winner</button></div>;
}
