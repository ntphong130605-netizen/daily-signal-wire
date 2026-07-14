import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "Corrections Policy",
  description:
    "How Daily Signal Wire reviews correction requests, updates stories and documents material changes.",
  alternates: {
    canonical: absoluteUrl("/corrections-policy")
  },
  openGraph: {
    title: `Corrections Policy | ${siteName}`,
    description:
      "How Daily Signal Wire reviews correction requests, updates stories and documents material changes.",
    url: absoluteUrl("/corrections-policy"),
    type: "article"
  }
};

export default function CorrectionsPolicyPage() {
  return (
    <StaticPage
      eyebrow="Corrections"
      title="Corrections and clarifications policy."
      description="Daily Signal Wire treats corrections as part of the public record and prioritizes speed, transparency and source-backed updates."
      sections={[
        {
          title: "How to request a correction",
          body:
            "Send the article URL, the exact passage in question, the reason it may be inaccurate and any source material that helps editors verify the issue."
        },
        {
          title: "How updates are handled",
          body:
            "Editors review the evidence, update the article when appropriate and preserve the updated timestamp. Material changes should be explained in the story or editorial notes when context is needed.",
          items: [
            "Minor spelling or formatting fixes may be corrected silently.",
            "Factual corrections should be reviewed against source URLs.",
            "Developing stories should clearly distinguish confirmed facts from available reports."
          ]
        },
        {
          title: "AI-assisted drafts",
          body:
            "If an error originates in an AI-assisted draft, editors must correct the story, preserve source review notes and improve the prompt or workflow guardrail that contributed to the issue."
        }
      ]}
    />
  );
}
