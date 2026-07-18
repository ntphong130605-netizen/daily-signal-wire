"use client";

import { useEffect, useState } from "react";
import { analyticsIdentity, trackCustom } from "@/lib/analytics";

function consentGranted() {
  return window.__dswConsent?.analytics_storage === "granted";
}

function elementKey(target: Element) {
  const explicit = target.closest<HTMLElement>("[data-heatmap-key]")?.dataset.heatmapKey;
  if (explicit) return explicit.slice(0, 160);
  const element = target.closest<HTMLElement>("a,button,input,summary,[role='button'],article,section");
  if (!element) return target.tagName.toLowerCase();
  const label = element.getAttribute("aria-label") || element.textContent?.trim() || "";
  return `${element.tagName.toLowerCase()}:${label.slice(0, 120)}`;
}

function sendHeatmap(payload: Record<string, unknown>) {
  if (!consentGranted()) return;
  const identity = analyticsIdentity();
  const body = JSON.stringify({
    path: window.location.pathname + window.location.search,
    articleSlug: window.location.pathname.startsWith("/news/")
      ? window.location.pathname.split("/").filter(Boolean).pop()
      : undefined,
    visitorId: identity.visitorId,
    sessionId: identity.sessionId,
    source: document.referrer ? new URL(document.referrer).hostname : "direct",
    ...payload
  });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/heatmap/event", new Blob([body], { type: "application/json" }));
    return;
  }
  fetch("/api/heatmap/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => null);
}

export default function RevenueTelemetry() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(consentGranted());
    function handleConsent() {
      setEnabled(consentGranted());
    }
    window.addEventListener("dsw-consent-change", handleConsent);
    return () => window.removeEventListener("dsw-consent-change", handleConsent);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const startedAt = Date.now();
    const scrollFired = new Set<number>();

    function handleClick(event: MouseEvent) {
      if (!(event.target instanceof Element)) return;
      const width = Math.max(1, document.documentElement.scrollWidth);
      const height = Math.max(1, document.documentElement.scrollHeight);
      const key = elementKey(event.target);
      sendHeatmap({
        eventType: "click",
        elementKey: key,
        xPercent: Math.min(100, Math.max(0, ((event.pageX || 0) / width) * 100)),
        yPercent: Math.min(100, Math.max(0, ((event.pageY || 0) / height) * 100))
      });
      trackCustom("heatmap_click", { element_key: key });
    }

    function handleScroll() {
      const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const depth = Math.min(100, Math.round((window.scrollY / available) * 100));
      for (const threshold of [25, 50, 75, 90, 100]) {
        if (depth < threshold || scrollFired.has(threshold)) continue;
        scrollFired.add(threshold);
        sendHeatmap({ eventType: "scroll", scrollDepth: threshold });
      }
    }

    function handleExit() {
      const available = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      sendHeatmap({
        eventType: "exit",
        exitPosition: Math.min(100, Math.round((window.scrollY / available) * 100)),
        durationSeconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      });
    }

    document.addEventListener("click", handleClick, { capture: true, passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handleExit, { once: true });
    handleScroll();
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handleExit);
    };
  }, [enabled]);

  return null;
}
