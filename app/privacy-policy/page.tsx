import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Daily Signal Wire."
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
            "If Google Analytics, AdSense, OpenAI, Neon or Supabase are configured, their respective privacy policies also apply to the data sent to those services."
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
