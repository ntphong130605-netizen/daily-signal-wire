"use client";

type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    __dswConsent?: {
      ad_storage: "granted" | "denied";
      analytics_storage: "granted" | "denied";
      ad_user_data: "granted" | "denied";
      ad_personalization: "granted" | "denied";
    };
  }
}

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${random}`;
}

export function analyticsIdentity() {
  if (typeof window === "undefined") {
    return { visitorId: undefined, sessionId: undefined };
  }
  try {
    const visitorKey = "dsw_visitor_id";
    const sessionKey = "dsw_session_id";
    let visitorId = window.localStorage.getItem(visitorKey);
    let sessionId = window.sessionStorage.getItem(sessionKey);
    if (!visitorId) {
      visitorId = createId("visitor");
      window.localStorage.setItem(visitorKey, visitorId);
    }
    if (!sessionId) {
      sessionId = createId("session");
      window.sessionStorage.setItem(sessionKey, sessionId);
    }
    return { visitorId, sessionId };
  } catch {
    return { visitorId: undefined, sessionId: undefined };
  }
}

export function trackEvent(name: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;

  if (typeof window.gtag === "function") {
    window.gtag("event", name, {
      ...params,
      transport_type: "beacon"
    });
  }

  if (window.__dswConsent?.analytics_storage !== "granted") return;
  const identity = analyticsIdentity();

  const payload = JSON.stringify({
    eventName: name,
    path: window.location.pathname,
    articleSlug: window.location.pathname.startsWith("/news/")
      ? window.location.pathname.split("/").filter(Boolean).pop()
      : undefined,
    visitorId: identity.visitorId,
    sessionId: identity.sessionId,
    source: document.referrer ? new URL(document.referrer).hostname : "direct",
    scrollDepth:
      typeof params.percent_scrolled === "number" ? params.percent_scrolled : undefined,
    metadata: params
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/event", new Blob([payload], { type: "application/json" }));
    return;
  }

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => null);
}
