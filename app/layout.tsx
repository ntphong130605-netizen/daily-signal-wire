import type { Metadata } from "next";
import { Suspense } from "react";
import GoogleScripts from "@/components/analytics/GoogleScripts";
import CookieConsent from "@/components/consent/CookieConsent";
import { adsenseClientId } from "@/lib/ads";
import { absoluteUrl, siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const adsenseAccountMeta = adsenseClientId();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: siteName,
    template: `%s | ${siteName}`
  },
  description: siteDescription(),
  alternates: {
    canonical: absoluteUrl("/"),
    types: {
      "application/rss+xml": absoluteUrl("/rss.xml")
    }
  },
  openGraph: {
    title: siteName,
    description: siteDescription(),
    url: absoluteUrl("/"),
    siteName,
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: siteName,
    description: siteDescription()
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  },
  manifest: "/manifest.webmanifest",
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
  other: adsenseAccountMeta
    ? {
        "google-adsense-account": adsenseAccountMeta
      }
    : undefined
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseClient = adsenseClientId();
  const analyticsId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    process.env.GOOGLE_ANALYTICS_ID ||
    "";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <CookieConsent />
        <Suspense fallback={null}>
          <GoogleScripts
            adsenseClientId={adsenseClient}
            gaMeasurementId={analyticsId}
          />
        </Suspense>
      </body>
    </html>
  );
}
