import type { Metadata } from "next";
import StaticPage from "@/components/StaticPage";

export const metadata: Metadata = {
  title: "Offline",
  description: "Daily Signal Wire offline fallback page.",
  robots: {
    index: false,
    follow: false
  }
};

export default function OfflinePage() {
  return (
    <StaticPage
      eyebrow="Offline"
      title="You appear to be offline."
      description="Daily Signal Wire needs a connection to load the latest source-reviewed coverage."
      sections={[
        {
          title: "Try again in a moment",
          body: "Check your connection, then reload the page. Previously opened pages may still be available in your browser cache."
        },
        {
          title: "No data was lost",
          body: "If you were editing in the admin area, return to the newsroom after reconnecting and confirm the draft state before publishing."
        }
      ]}
    />
  );
}
