import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";

export const metadata: Metadata = {
  title: "Terms",
  description: "Terms of use for Daily Signal Wire."
};

export default function TermsPage() {
  return (
    <StaticPage
      eyebrow="Terms"
      title="Terms for using Daily Signal Wire."
      description="These starter terms explain the intended use of the public news site and admin newsroom tools."
      sections={[
        {
          title: "Content use",
          body:
            "Published stories are intended for reader access through the website. RSS-derived items link back to original sources and should not be treated as republished full-text articles."
        },
        {
          title: "AI-assisted drafts",
          body:
            "AI-generated drafts and images require human review before publication. Editors remain responsible for accuracy, attribution and final publishing decisions."
        },
        {
          title: "Advertising and analytics",
          body:
            "The site may display Google AdSense ads or use analytics when configured. Readers should not click ads to test them; use preview tools and configuration checks instead."
        },
        {
          title: "Availability",
          body:
            "The service may use external APIs for trends, AI generation, analytics, advertising and database hosting. Missing or unavailable services should degrade gracefully."
        }
      ]}
    />
  );
}
