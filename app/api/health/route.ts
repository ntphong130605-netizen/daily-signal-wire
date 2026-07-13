import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { configuredImageStorageLabel } from "@/lib/aiImage";
import { adsenseClientId, hasAdsTxtConfiguration } from "@/lib/ads";
import { getResearchEngineReadiness } from "@/lib/research/engine";

export const dynamic = "force-dynamic";

function parseSourceStatuses(value: string | null | undefined) {
  try {
    return JSON.parse(value || "{}") as Record<string, { status?: string }>;
  } catch {
    return {};
  }
}

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

  const researchReadiness = getResearchEngineReadiness();
  const lastResearchRun =
    checks.databaseConfigured && checks.databaseReachable
      ? await prisma.researchRun
          .findFirst({
            orderBy: { startedAt: "desc" },
            select: {
              id: true,
              status: true,
              startedAt: true,
              completedAt: true,
              candidatesFound: true,
              candidatesCreated: true,
              candidatesMerged: true,
              sourceStatuses: true
            }
          })
          .catch(() => null)
      : null;
  const failedResearchSources = lastResearchRun
    ? Object.entries(parseSourceStatuses(lastResearchRun.sourceStatuses))
        .filter(([, status]) => status.status === "failed")
        .map(([source]) => source)
    : [];
  const factChecker =
    checks.databaseConfigured && checks.databaseReachable
      ? await prisma.post
          .groupBy({
            by: ["factCheckStatus"],
            where: { aiGenerated: true },
            _count: { _all: true }
          })
          .then((rows) =>
            rows.reduce<Record<string, number>>((accumulator, row) => {
              accumulator[row.factCheckStatus] = row._count._all;
              return accumulator;
            }, {})
          )
          .catch(() => ({}))
      : {};
  const imageStudio =
    checks.databaseConfigured && checks.databaseReachable
      ? await prisma.post
          .groupBy({
            by: ["imageStatus"],
            _count: { _all: true }
          })
          .then((rows) =>
            rows.reduce<Record<string, number>>((accumulator, row) => {
              accumulator[row.imageStatus] = row._count._all;
              return accumulator;
            }, {})
          )
          .catch(() => ({}))
      : {};

  const ok = checks.app && (!checks.databaseConfigured || checks.databaseReachable);

  return Response.json(
    {
      ok,
      status: ok ? "ok" : "degraded",
      service: "daily-signal-wire",
      checkedAt: new Date().toISOString(),
      checks,
      research: {
        ...researchReadiness,
        lastRun: lastResearchRun,
        failedSources: failedResearchSources
      },
      factChecker,
      imageStudio: {
        model: process.env.IMAGE_MODEL || "gpt-image-1",
        storage: checks.imageStorage,
        statuses: imageStudio
      }
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
