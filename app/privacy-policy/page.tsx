import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Daily Signal Wire.",
  alternates: {
    canonical: absoluteUrl("/privacy-policy")
  }
};

export default function PrivacyPolicyPage() {
  return (
    <StaticPage
      eyebrow="Privacy Policy"
      title="Reader privacy and newsroom data."
      description="Daily Signal Wire is designed to run with minimal personal data until you connect analytics, advertising or authentication providers."
      sections={[
        {
          title: "Information collected",
          body:
            "The site may process basic request information, RSS feed metadata, admin sessions and newsletter emails when those features are enabled."
        },
        {
          title: "Third-party services",
          body:
            "If Google Analytics, Google AdSense, OpenAI, Neon, Vercel Blob or similar providers are configured, their respective privacy policies apply to the data processed by those services."
        },
        {
          title: "Advertising and consent",
          body:
            "AdSense and Analytics scripts are gated by the site consent banner. Readers can reject optional ad and analytics storage or manage preferences before those services load."
        },
        {
          title: "AI-assisted content",
          body:
            "AI tools may process trend keywords, article drafts, summaries and image prompts. Editors should avoid sending private personal data into AI workflows."
        },
        {
          title: "Operational controls",
          body:
            "Secrets are stored in environment variables, and missing API keys are handled gracefully so the public site does not expose private configuration details."
        }
      ]}
    />
  );
}
