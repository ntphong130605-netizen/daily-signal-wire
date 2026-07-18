"use client";

import { useEffect, useRef, useState } from "react";
import { trackCustom } from "@/lib/analytics";
import type { AdPosition } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
    __dswAdsenseReady?: boolean;
  }
}

function adsConsentGranted() {
  return window.__dswConsent?.ad_storage === "granted";
}

function recordAdVisibility(position: AdPosition) {
  if (window.__dswConsent?.analytics_storage !== "granted") return;
  fetch("/api/heatmap/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "ad_visibility",
      path: window.location.pathname + window.location.search,
      articleSlug: window.location.pathname.startsWith("/news/")
        ? window.location.pathname.split("/").filter(Boolean).pop()
        : undefined,
      adPosition: position
    }),
    keepalive: true
  }).catch(() => null);
}

export default function AdSenseAd({
  client,
  slot,
  format,
  responsive,
  position,
  lazy
}: {
  client: string;
  slot: string;
  format: string;
  responsive: boolean;
  position: AdPosition;
  lazy: boolean;
}) {
  const pushed = useRef(false);
  const filledTracked = useRef(false);
  const viewableTracked = useRef(false);
  const elementRef = useRef<HTMLModElement | null>(null);
  const [eligible, setEligible] = useState(!lazy);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !lazy || eligible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setEligible(true);
        observer.disconnect();
      },
      { rootMargin: "650px 0px" }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [eligible, lazy]);

  useEffect(() => {
    function requestAd() {
      if (pushed.current) return;
      if (!eligible) return;
      if (!adsConsentGranted()) return;
      if (!window.__dswAdsenseReady) return;

      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch {
        // Ad blockers, privacy settings or Google script timing can block ads.
      }
    }

    requestAd();
    window.addEventListener("dsw-adsense-ready", requestAd);
    window.addEventListener("dsw-consent-change", requestAd);
    return () => {
      window.removeEventListener("dsw-adsense-ready", requestAd);
      window.removeEventListener("dsw-consent-change", requestAd);
    };
  }, [eligible]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !eligible) return;
    const metadata = {
      ad_platform: "Google AdSense",
      ad_source: "adsense",
      ad_format: format,
      ad_unit_name: position,
      ad_position: position,
      slot_id: slot
    };
    const statusObserver = new MutationObserver(() => {
      if (filledTracked.current || element.dataset.adStatus !== "filled") return;
      filledTracked.current = true;
      trackCustom("ad_impression", metadata);
    });
    statusObserver.observe(element, { attributes: true, attributeFilter: ["data-ad-status"] });

    let viewableTimer: number | undefined;
    const viewabilityObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.intersectionRatio >= 0.5);
        if (!visible) {
          if (viewableTimer) window.clearTimeout(viewableTimer);
          viewableTimer = undefined;
          return;
        }
        if (viewableTracked.current || viewableTimer) return;
        viewableTimer = window.setTimeout(() => {
          viewableTracked.current = true;
          trackCustom("ad_viewable_impression", metadata);
          recordAdVisibility(position);
          viewabilityObserver.disconnect();
        }, 1000);
      },
      { threshold: [0, 0.5, 1] }
    );
    viewabilityObserver.observe(element);
    return () => {
      statusObserver.disconnect();
      viewabilityObserver.disconnect();
      if (viewableTimer) window.clearTimeout(viewableTimer);
    };
  }, [eligible, format, position, slot]);

  return (
    <ins
      ref={elementRef}
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
