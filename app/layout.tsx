import type { Metadata } from "next";
import Script from "next/script";
import { absoluteUrl, siteDescription, siteName, siteUrl } from "@/lib/site";
import "./globals.css";

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
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || "google-site-verification-placeholder"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseClient =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const analyticsId = process.env.GOOGLE_ANALYTICS_ID;

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        {analyticsId && (
          <>
            <Script
              id="google-analytics-src"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
                analyticsId
              )}`}
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', ${JSON.stringify(analyticsId)});
              `}
            </Script>
          </>
        )}
        {adsenseClient && (
          <Script
            id="adsense-script"
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
              adsenseClient
            )}`}
          />
        )}
      </body>
    </html>
  );
}
