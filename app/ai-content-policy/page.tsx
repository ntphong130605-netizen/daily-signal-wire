import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Content Policy",
  description:
    "How Daily Signal Wire uses AI tools, source review and human editorial approval.",
  alternates: {
    canonical: absoluteUrl("/ai-content-policy")
  },
  openGraph: {
    title: `AI Content Policy | ${siteName}`,
    description:
      "How Daily Signal Wire uses AI tools, source review and human editorial approval.",
    url: absoluteUrl("/ai-content-policy"),
    type: "article"
  }
};

export default function AiContentPolicyPage() {
  return (
    <StaticPage
      eyebrow="Editorial standards"
      title="AI Content Policy"
      description="Daily Signal Wire uses AI as an editorial drafting assistant, not as an automatic publisher."
      sections={[
        {
          title: "Human review comes first",
          body:
            "AI-generated drafts are saved for editor review and are not published automatically. Editors must verify sources, review fact-check notes, confirm image disclosures and approve each article before publication."
        },
        {
          title: "Source-first reporting",
          body:
            "Trending topics and RSS stories are used as leads or context. Published articles must be original, cite reviewable source URLs and avoid copying another publisher's protected expression."
        },
        {
          title: "No fabricated quotes or unsupported numbers",
          body:
            "Drafts must not invent quotes, statistics or claims. If a detail is not independently confirmed, the article must clearly describe it as based on available reports."
        },
        {
          title: "AI-generated images",
          body:
            "AI visuals are treated as editorial images. They must not mislead readers into believing a generated image is a real photograph of a sensitive event, crime scene, disaster or live news incident."
        },
        {
          title: "Corrections",
          body:
            "If an error is found, Daily Signal Wire may update, correct or remove content and add context where appropriate."
        }
      ]}
    />
  );
}
