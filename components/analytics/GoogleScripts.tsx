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
  gaMeasurementId,
  gtmId,
  clarityProjectId
}: {
  adsenseClientId: string;
  gaMeasurementId: string;
  gtmId?: string;
  clarityProjectId?: string;
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

  useEffect(() => {
    if (!adsenseClientId || consent.ad_storage !== "granted") return;

    function markAdsenseReady() {
      window.__dswAdsenseReady = true;
      window.dispatchEvent(new Event("dsw-adsense-ready"));
    }

    if (window.__dswAdsenseReady) {
      markAdsenseReady();
      return;
    }

    const existing = document.getElementById("adsense-script") as
      | HTMLScriptElement
      | null;
    if (existing) {
      existing.addEventListener("load", markAdsenseReady, { once: true });
      if (existing.dataset.ready === "true") markAdsenseReady();
      return () => existing.removeEventListener("load", markAdsenseReady);
    }

    const script = document.createElement("script");
    script.id = "adsense-script";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
      adsenseClientId
    )}`;
    script.addEventListener(
      "load",
      () => {
        script.dataset.ready = "true";
        markAdsenseReady();
      },
      { once: true }
    );
    document.head.appendChild(script);
  }, [adsenseClientId, consent.ad_storage]);

  const analyticsAllowed =
    Boolean(gaMeasurementId) && consent.analytics_storage === "granted";

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
      {analyticsAllowed && gtmId && (
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${gtmId.replace(/[^A-Z0-9-]/gi, "")}');
          `}
        </Script>
      )}
      {analyticsAllowed && clarityProjectId && (
        <Script id="microsoft-clarity" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityProjectId.replace(/[^a-zA-Z0-9]/g, "")}");
          `}
        </Script>
      )}
    </>
  );
}
