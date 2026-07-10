import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { configuredImageStorageLabel } from "@/lib/aiImage";
import { adsenseClientId, hasAdsTxtConfiguration } from "@/lib/ads";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    app: true,
    databaseConfigured: isDatabaseConfigured(),
    databaseReachable: false,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    imageStorage: configuredImageStorageLabel(),
    adsenseConfigured: Boolean(adsenseClientId()),
    adsTxtConfigured: hasAdsTxtConfiguration(),
    consentModeReady: true,
    gaConfigured: Boolean(
      process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.GOOGLE_ANALYTICS_ID
    ),
    siteUrlConfigured: Boolean(
      process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXTAUTH_URL ||
        process.env.VERCEL_URL
    )
  };

  if (checks.databaseConfigured) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.databaseReachable = true;
    } catch {
      checks.databaseReachable = false;
    }
  }

  const ok = checks.app && (!checks.databaseConfigured || checks.databaseReachable);

  return Response.json(
    {
      ok,
      status: ok ? "ok" : "degraded",
      service: "daily-signal-wire",
      checkedAt: new Date().toISOString(),
      checks
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
