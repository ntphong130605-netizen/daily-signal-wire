"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
    __dswAdsenseReady?: boolean;
  }
}

function adsConsentGranted() {
  return window.__dswConsent?.ad_storage === "granted";
}

export default function AdSenseAd({
  client,
  slot,
  format,
  responsive
}: {
  client: string;
  slot: string;
  format: string;
  responsive: boolean;
}) {
  const pushed = useRef(false);

  useEffect(() => {
    function requestAd() {
      if (pushed.current) return;
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
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  );
}
