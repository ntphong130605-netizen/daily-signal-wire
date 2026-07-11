import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Daily Signal Wire about corrections, partnerships and newsroom feedback.",
  alternates: {
    canonical: absoluteUrl("/contact")
  }
};

export default function ContactPage() {
  return (
    <StaticPage
      eyebrow="Contact"
      title="Send a signal to the newsroom."
      description="Use this page as the public contact point for corrections, source tips, partnership questions and product feedback."
      sections={[
        {
          title: "Corrections",
          body:
            "For corrections, include the story URL, the sentence or claim in question and any source material that helps editors verify the update."
        },
        {
          title: "Tips and sources",
          body:
            "For news tips, provide direct source links whenever possible. Anonymous or unverified claims should be clearly labeled as such."
        },
        {
          title: "Email placeholder",
          body:
            "Set a production contact address in your site settings before launch. Until then, this page avoids exposing a hardcoded personal email."
        }
      ]}
    />
  );
}
