import { adsensePublisherId } from "@/lib/ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const publisherId = adsensePublisherId();
  const body = publisherId
    ? `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`
    : "# Daily Signal Wire ads.txt\n# Add ADSENSE_PUBLISHER_ID=pub-XXXXXXXXXXXXXXX to enable Google AdSense.\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
