import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn how Daily Signal Wire combines RSS signals, search trends and human review to publish source-first news.",
  alternates: {
    canonical: absoluteUrl("/about")
  }
};

export default function AboutPage() {
  return (
    <StaticPage
      eyebrow="About Daily Signal Wire"
      title="A source-first AI newsroom for modern readers."
      description="Daily Signal Wire blends RSS reading, Google Trends discovery and AI-assisted draft preparation with a firm human review step before anything is published."
      sections={[
        {
          title: "What we build",
          body:
            "The newsroom tracks public-interest signals, collects source links and helps editors prepare original drafts, SEO metadata, social captions and editorial illustrations."
        },
        {
          title: "What we do not do",
          body:
            "Trends are treated as story ideas, not facts. AI drafts are never published automatically, and generated images are labeled as illustrations rather than documentary photos."
        },
        {
          title: "Editorial standard",
          body:
            "Every draft is expected to preserve source URLs, fact-check notes and clear uncertainty when reporting is still developing."
        }
      ]}
    />
  );
}
