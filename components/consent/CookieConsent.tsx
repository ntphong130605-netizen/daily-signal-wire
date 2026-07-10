"use client";

import { useEffect, useMemo, useState } from "react";

export type ConsentState = {
  ad_storage: "granted" | "denied";
  analytics_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
};

declare global {
  interface Window {
    __dswConsent?: ConsentState;
  }
}

const STORAGE_KEY = "dsw-consent-v1";

const deniedConsent: ConsentState = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied"
};

const grantedConsent: ConsentState = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted"
};

function readStoredConsent(): ConsentState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      ad_storage: parsed.ad_storage === "granted" ? "granted" : "denied",
      analytics_storage:
        parsed.analytics_storage === "granted" ? "granted" : "denied",
      ad_user_data: parsed.ad_user_data === "granted" ? "granted" : "denied",
      ad_personalization:
        parsed.ad_personalization === "granted" ? "granted" : "denied"
    };
  } catch {
    return null;
  }
}

function applyConsent(consent: ConsentState) {
  window.__dswConsent = consent;
  window.dispatchEvent(new CustomEvent("dsw-consent-change", { detail: consent }));
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", consent);
  }
}

export default function CookieConsent() {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const [draft, setDraft] = useState<ConsentState>(deniedConsent);

  const accepted = useMemo(
    () => Object.values(draft).some((value) => value === "granted"),
    [draft]
  );

  useEffect(() => {
    const stored = readStoredConsent();
    applyConsent(stored || deniedConsent);
    setDraft(stored || deniedConsent);
    setOpen(!stored);
    setReady(true);
  }, []);

  function save(consent: ConsentState) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    setDraft(consent);
    applyConsent(consent);
    setOpen(false);
    setManaging(false);
  }

  function setPreference(key: keyof ConsentState, checked: boolean) {
    setDraft((current) => ({
      ...current,
      [key]: checked ? "granted" : "denied"
    }));
  }

  if (!ready || !open) {
    return (
      <button
        className="cookie-preferences-button"
        type="button"
        onClick={() => setOpen(true)}
      >
        Cookie preferences
      </button>
    );
  }

  return (
    <section className="cookie-consent" aria-label="Cookie consent">
      <div>
        <p className="section-kicker">Privacy choices</p>
        <h2>Cookies, ads and analytics</h2>
        <p>
          Daily Signal Wire can use cookies for Google Analytics and AdSense.
          You can accept, reject or manage preferences. Ads and analytics scripts
          stay disabled until your choice allows them.
        </p>
      </div>

      {managing && (
        <div className="cookie-preferences">
          {[
            ["analytics_storage", "Analytics measurement"],
            ["ad_storage", "Ad storage"],
            ["ad_user_data", "Ad user data"],
            ["ad_personalization", "Ad personalization"]
          ].map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={draft[key as keyof ConsentState] === "granted"}
                onChange={(event) =>
                  setPreference(key as keyof ConsentState, event.target.checked)
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}

      <div className="cookie-actions">
        <button type="button" onClick={() => save(grantedConsent)}>
          Accept
        </button>
        <button type="button" onClick={() => save(deniedConsent)}>
          Reject
        </button>
        {managing ? (
          <button type="button" onClick={() => save(draft)}>
            Save preferences
          </button>
        ) : (
          <button type="button" onClick={() => setManaging(true)}>
            Manage preferences
          </button>
        )}
      </div>
      {managing && (
        <small>
          Current preference: {accepted ? "some optional services allowed" : "all optional services denied"}.
        </small>
      )}
    </section>
  );
}
