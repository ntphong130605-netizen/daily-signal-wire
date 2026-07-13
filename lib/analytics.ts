"use client";

export type AnalyticsParams = Record<
  string,
  string | number | boolean | null | undefined
>;

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

function currentPath() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

function articleSlugFromPath(path = currentPath()) {
  const cleanPath = path.split("?")[0] || "";
  return cleanPath.startsWith("/news/")
    ? cleanPath.split("/").filter(Boolean).pop()
    : undefined;
}

function referrerSource() {
  if (typeof document === "undefined" || !document.referrer) return "direct";
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return "direct";
  }
}

function sendToGa(eventName: string, params: AnalyticsParams) {
  if (process.env.NODE_ENV !== "production") return;
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, {
    ...params,
    transport_type: "beacon"
  });
}

function sendInternal(eventName: string, params: AnalyticsParams) {
  if (typeof window === "undefined") return;
  if (window.__dswConsent?.analytics_storage !== "granted") return;

  const identity = analyticsIdentity();
  const path = typeof params.page_path === "string" ? params.page_path : currentPath();
  const payload = JSON.stringify({
    eventName,
    path,
    articleSlug:
      typeof params.article_slug === "string"
        ? params.article_slug
        : articleSlugFromPath(path),
    category: typeof params.category === "string" ? params.category : undefined,
    visitorId: identity.visitorId,
    sessionId: identity.sessionId,
    source: typeof params.source === "string" ? params.source : referrerSource(),
    durationSeconds:
      typeof params.duration_seconds === "number" ? params.duration_seconds : undefined,
    scrollDepth:
      typeof params.percent_scrolled === "number" ? params.percent_scrolled : undefined,
    metadata: params
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/analytics/event",
      new Blob([payload], { type: "application/json" })
    );
    return;
  }

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => null);
}

export function trackCustom(eventName: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  sendToGa(eventName, params);
  sendInternal(eventName, params);
}

export function trackPageView(params: AnalyticsParams = {}) {
  trackCustom("page_view", {
    page_path: currentPath(),
    page_location: typeof window !== "undefined" ? window.location.href : undefined,
    page_title: typeof document !== "undefined" ? document.title : undefined,
    ...params
  });
}

export function trackArticleView(params: AnalyticsParams = {}) {
  trackCustom("article_view", {
    article_slug: articleSlugFromPath(),
    page_path: currentPath(),
    ...params
  });
}

export function trackSearch(params: AnalyticsParams = {}) {
  trackCustom("search", params);
}

export function trackOutbound(params: AnalyticsParams = {}) {
  trackCustom("outbound_click", params);
}

export function trackNewsletter(params: AnalyticsParams = {}) {
  trackCustom("newsletter_signup", params);
}

export function trackImageGeneration(params: AnalyticsParams = {}) {
  trackCustom("image_generation", params);
}

export function trackPublish(params: AnalyticsParams = {}) {
  trackCustom("ai_publish", params);
}

export const trackEvent = trackCustom;
