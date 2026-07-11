import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Cookie policy for Daily Signal Wire, including analytics, advertising and consent choices.",
  alternates: {
    canonical: absoluteUrl("/cookie-policy")
  }
};

export default function CookiePolicyPage() {
  return (
    <StaticPage
      eyebrow="Cookie Policy"
      title="Cookie and consent choices."
      description="Daily Signal Wire keeps optional advertising and analytics services off until readers make a consent choice."
      sections={[
        {
          title: "What cookies may be used",
          body:
            "When enabled, cookies may support Google Analytics measurement, Google AdSense ad delivery, basic security, admin sessions and newsletter features."
        },
        {
          title: "Consent controls",
          body:
            "Readers can accept, reject or manage preferences for ad storage, analytics storage, ad user data and ad personalization. The site is prepared for Google Consent Mode v2."
        },
        {
          title: "Changing preferences",
          body:
            "Use the Cookie preferences button to reopen the banner and update your choices. Rejecting optional cookies does not block access to the news site."
        }
      ]}
    />
  );
}
