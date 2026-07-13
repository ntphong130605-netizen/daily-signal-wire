import type { Metadata } from "next";
import { Suspense } from "react";
import GoogleScripts from "@/components/analytics/GoogleScripts";
import CookieConsent from "@/components/consent/CookieConsent";
import { adsenseClientId } from "@/lib/ads";
import { absoluteUrl, siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

const adsenseAccountMeta = adsenseClientId();
const googleVerification =
  process.env.NEXT_PUBLIC_GSC_VERIFICATION || process.env.GOOGLE_SITE_VERIFICATION || "";
const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  name: siteName,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/icon.svg"),
  sameAs: []
};
const webSiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: absoluteUrl("/"),
  description: siteDescription(),
  potentialAction: {
    "@type": "SearchAction",
    target: `${absoluteUrl("/search")}?q={search_term_string}`,
    "query-input": "required name=search_term_string"
  }
};

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
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1
    }
  },
  verification: googleVerification
    ? { google: googleVerification }
    : undefined,
  other: adsenseAccountMeta
    ? {
        "google-adsense-account": adsenseAccountMeta
      }
    : undefined
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseClient = adsenseClientId();
  const analyticsId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
  const gtmId = process.env.NEXT_PUBLIC_GTM_ID || "";
  const clarityProjectId =
    process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ||
    process.env.MICROSOFT_CLARITY_PROJECT_ID ||
    "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://images.pexels.com" />
        <link rel="dns-prefetch" href="https://upload.wikimedia.org" />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([organizationJsonLd, webSiteJsonLd])
          }}
        />
        {children}
        <CookieConsent />
        <Suspense fallback={null}>
          <GoogleScripts
            adsenseClientId={adsenseClient}
            gaMeasurementId={analyticsId}
            gtmId={gtmId}
            clarityProjectId={clarityProjectId}
            isProduction={process.env.NODE_ENV === "production"}
          />
        </Suspense>
      </body>
    </html>
  );
}
