import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Fact-Check Policy",
  description:
    "Daily Signal Wire fact-check policy for source review, uncertainty labels and AI-assisted newsroom safeguards.",
  alternates: {
    canonical: absoluteUrl("/fact-check-policy")
  },
  openGraph: {
    title: `Fact-Check Policy | ${siteName}`,
    description:
      "Daily Signal Wire fact-check policy for source review, uncertainty labels and AI-assisted newsroom safeguards.",
    url: absoluteUrl("/fact-check-policy"),
    type: "article"
  }
};

export default function FactCheckPolicyPage() {
  return (
    <StaticPage
      eyebrow="Fact-checking"
      title="Source review before publication."
      description="Daily Signal Wire uses trends and RSS stories as discovery signals, then requires source URLs, verification notes and editor review before publishing."
      sections={[
        {
          title: "Verification standard",
          body:
            "Important claims should be checked against primary sources, official statements or multiple reputable outlets. If only limited confirmation is available, the article must say so plainly.",
          items: [
            "Do not invent quotes, statistics, organizations or expert comments.",
            "Use cautious wording for developing or uncertain information.",
            "Record source URLs so editors and readers can inspect the evidence."
          ]
        },
        {
          title: "Trust signals",
          body:
            "The admin workflow tracks source diversity, fact-check notes, confidence warnings and AI-generated image disclosures before an editor approves publication."
        },
        {
          title: "Failed checks",
          body:
            "Articles with unsupported claims, weak evidence, conflicting reports or missing attribution should remain in review, be rewritten or be rejected."
        }
      ]}
    />
  );
}
