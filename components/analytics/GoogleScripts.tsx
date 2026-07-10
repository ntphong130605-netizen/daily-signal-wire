"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { ConsentState } from "@/components/consent/CookieConsent";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __dswAdsenseReady?: boolean;
  }
}

const deniedConsent: ConsentState = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied"
};

function currentConsent() {
  if (typeof window === "undefined") return deniedConsent;
  return window.__dswConsent || deniedConsent;
}

export default function GoogleScripts({
  adsenseClientId,
  gaMeasurementId
}: {
  adsenseClientId: string;
  gaMeasurementId: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [consent, setConsent] = useState<ConsentState>(deniedConsent);
  const [gaConfigured, setGaConfigured] = useState(false);

  useEffect(() => {
    setConsent(currentConsent());
    function handleConsent(event: Event) {
      const next =
        event instanceof CustomEvent
          ? (event.detail as ConsentState)
          : currentConsent();
      setConsent(next);
    }
    window.addEventListener("dsw-consent-change", handleConsent);
    return () => window.removeEventListener("dsw-consent-change", handleConsent);
  }, []);

  useEffect(() => {
    if (!gaMeasurementId || consent.analytics_storage !== "granted") return;
    if (typeof window.gtag !== "function") return;

    if (!gaConfigured) {
      window.gtag("config", gaMeasurementId, { send_page_view: false });
      setGaConfigured(true);
    }

    const search = searchParams.toString();
    const pagePath = search ? `${pathname}?${search}` : pathname;
    window.gtag("event", "page_view", {
      page_path: pagePath,
      page_location: window.location.href,
      page_title: document.title
    });

    if (pathname.startsWith("/news/")) {
      window.gtag("event", "article_view", {
        page_path: pagePath,
        article_slug: pathname.split("/").filter(Boolean).pop()
      });
    }
  }, [consent.analytics_storage, gaConfigured, gaMeasurementId, pathname, searchParams]);

  const analyticsAllowed =
    Boolean(gaMeasurementId) && consent.analytics_storage === "granted";
  const adsAllowed = Boolean(adsenseClientId) && consent.ad_storage === "granted";

  return (
    <>
      <Script id="google-consent-default" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('consent', 'default', {
            ad_storage: 'denied',
            analytics_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied'
          });
        `}
      </Script>
      {analyticsAllowed && (
        <Script
          id="google-analytics-src"
          strategy="afterInteractive"
          src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
            gaMeasurementId
          )}`}
        />
      )}
      {adsAllowed && (
        <Script
          id="adsense-script"
          async
          strategy="afterInteractive"
          crossOrigin="anonymous"
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
            adsenseClientId
          )}`}
          onLoad={() => {
            window.__dswAdsenseReady = true;
            window.dispatchEvent(new Event("dsw-adsense-ready"));
          }}
        />
      )}
    </>
  );
}
