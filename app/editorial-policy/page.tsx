import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Editorial Policy",
  description:
    "Daily Signal Wire editorial policy for AI-assisted drafts, sourcing, corrections and AI-generated images.",
  alternates: {
    canonical: absoluteUrl("/editorial-policy")
  }
};

export default function EditorialPolicyPage() {
  return (
    <StaticPage
      eyebrow="Editorial Policy"
      title="Human-reviewed, source-first publishing."
      description="Daily Signal Wire uses AI to prepare drafts and editorial images, but editorial judgment, fact-checking and publication remain human-controlled."
      sections={[
        {
          title: "AI content disclosure",
          body:
            "AI may assist with article drafts, SEO fields, social captions and editorial image prompts. Drafts are not automatically published and must include source URLs and fact-check notes."
        },
        {
          title: "No fabricated evidence",
          body:
            "AI-generated visuals are labeled as editorial images. For real events, sensitive stories or public figures, images must not imply they are documentary photos of the event."
        },
        {
          title: "Corrections and uncertainty",
          body:
            "Unconfirmed details must be described with cautious wording such as according to available reports. Corrections and clarifications should be handled transparently."
        }
      ]}
    />
  );
}
