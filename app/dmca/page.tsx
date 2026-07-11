import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "DMCA Policy",
  description:
    "Copyright and DMCA contact process for Daily Signal Wire.",
  alternates: {
    canonical: absoluteUrl("/dmca")
  },
  openGraph: {
    title: `DMCA Policy | ${siteName}`,
    description: "Copyright and DMCA contact process for Daily Signal Wire.",
    url: absoluteUrl("/dmca"),
    type: "article"
  }
};

export default function DmcaPage() {
  return (
    <StaticPage
      eyebrow="Legal"
      title="DMCA Policy"
      description="Daily Signal Wire respects intellectual property rights and reviews copyright concerns promptly."
      sections={[
        {
          title: "Reporting copyright concerns",
          body:
            "If you believe content on Daily Signal Wire infringes your copyright, contact us with the affected URL, a description of the copyrighted work, your contact details and a statement that you have a good-faith belief the use is not authorized."
        },
        {
          title: "What happens next",
          body:
            "We review complete notices, may remove or restrict access to disputed material and may request additional information when needed."
        },
        {
          title: "Counter notices",
          body:
            "If you believe content was removed by mistake, you may send a counter notice with enough information for us to evaluate the claim."
        },
        {
          title: "Contact",
          body:
            "Use the Contact page to reach the site operator. Please include 'DMCA Notice' in the message subject or opening line."
        }
      ]}
    />
  );
}
