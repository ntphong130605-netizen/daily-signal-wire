import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl, siteName } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI Transparency",
  description:
    "How Daily Signal Wire uses AI for research assistance, draft writing, fact-check support and editorial image generation.",
  alternates: {
    canonical: absoluteUrl("/ai-transparency")
  },
  openGraph: {
    title: `AI Transparency | ${siteName}`,
    description:
      "How Daily Signal Wire uses AI for research assistance, draft writing, fact-check support and editorial image generation.",
    url: absoluteUrl("/ai-transparency"),
    type: "article"
  }
};

export default function AiTransparencyPage() {
  return (
    <StaticPage
      eyebrow="AI transparency"
      title="How AI is used in the newsroom."
      description="Daily Signal Wire uses AI to assist editors, not to replace editorial responsibility."
      sections={[
        {
          title: "What AI may assist with",
          body:
            "AI can help collect research briefs, draft original articles, generate summaries, prepare SEO metadata, create FAQ sections and produce editorial image prompts."
        },
        {
          title: "What humans control",
          body:
            "Editors control publication. AI drafts stay unpublished until an editor reviews sources, fact-check notes, image disclosures, SEO fields and story quality.",
          items: [
            "No automatic publication without approval.",
            "No fabricated quotes or unsupported numbers.",
            "No generated image should be presented as a documentary photo of a real event."
          ]
        },
        {
          title: "Image transparency",
          body:
            "AI-generated visuals are labeled as editorial illustrations or AI-generated editorial images. Sensitive news should use symbolic or clearly illustrative imagery when authentic photography is unavailable."
        },
        {
          title: "Related standards",
          body:
            "This page works with the AI Content Policy, Editorial Policy and Fact-Check Policy to describe how Daily Signal Wire keeps AI assistance accountable."
        }
      ]}
    />
  );
}
