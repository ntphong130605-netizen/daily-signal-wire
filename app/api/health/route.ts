import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { configuredImageStorageLabel } from "@/lib/aiImage";
import { adsenseClientId, hasAdsTxtConfiguration } from "@/lib/ads";
import { getResearchEngineReadiness } from "@/lib/research/engine";
import { googleIndexingReadiness } from "@/lib/googleIndexing";
import { socialReadiness } from "@/lib/socialDistribution";

export const dynamic = "force-dynamic";

function parseSourceStatuses(value: string | null | undefined) {
  try {
    return JSON.parse(value || "{}") as Record<string, { status?: string }>;
  } catch {
    return {};
  }
}

export async function GET() {
  const socialCredentialReadiness = socialReadiness();
  const checks = {
    app: true,
    databaseConfigured: isDatabaseConfigured(),
    databaseReachable: false,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    imageStorage: configuredImageStorageLabel(),
    adsenseConfigured: Boolean(adsenseClientId()),
    adsTxtConfigured: hasAdsTxtConfiguration(),
    consentModeReady: true,
    gaConfigured: Boolean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    gscVerificationConfigured: Boolean(
      process.env.NEXT_PUBLIC_GSC_VERIFICATION ||
        process.env.GOOGLE_SITE_VERIFICATION ||
        process.env.GOOGLE_SITE_VERIFICATION_FILE
    ),
    googleIndexingConfigured: googleIndexingReadiness().configured,
    socialDistributionConfigured: socialCredentialReadiness.some((platform) => platform.configured),
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
  const publishing =
    checks.databaseConfigured && checks.databaseReachable
      ? await prisma.post
          .groupBy({
            by: ["status"],
            _count: { _all: true }
          })
          .then((rows) =>
            rows.reduce<Record<string, number>>((accumulator, row) => {
              accumulator[row.status] = row._count._all;
              return accumulator;
            }, {})
          )
          .catch(() => ({}))
      : {};
  const publishingFailures =
    checks.databaseConfigured && checks.databaseReachable
      ? await prisma.post.count({
          where: {
            publishError: { not: null }
          }
        }).catch(() => 0)
      : 0;
  const indexing =
    checks.databaseConfigured && checks.databaseReachable
      ? await prisma.indexingJob
          .groupBy({
            by: ["status"],
            _count: { _all: true }
          })
          .then((rows) =>
            rows.reduce<Record<string, number>>(
              (accumulator, row) => {
                accumulator[row.status] = row._count._all;
                return accumulator;
              },
              { pending: 0, processing: 0, success: 0, failed: 0 }
            )
          )
          .catch(() => ({ pending: 0, processing: 0, success: 0, failed: 0 }))
      : { pending: 0, processing: 0, success: 0, failed: 0 };
  const growth =
    checks.databaseConfigured && checks.databaseReachable
      ? await Promise.all([
          prisma.contentPlanItem.count({ where: { plannedFor: { gte: new Date() } } }),
          prisma.distributionPublish.groupBy({
            by: ["status"],
            _count: { _all: true }
          }),
          prisma.socialPost.groupBy({
            by: ["status"],
            _count: { _all: true },
            _sum: { clicks: true, shares: true, likes: true, comments: true }
          }),
          prisma.analyticsEvent.count({
            where: {
              eventName: "page_view",
              createdAt: { gte: new Date(Date.now() - 24 * 36e5) }
            }
          }),
          prisma.seoAudit.findFirst({
            orderBy: { analyzedAt: "desc" },
            select: { score: true, analyzedAt: true }
          }),
          prisma.discoverAudit.findFirst({
            orderBy: { analyzedAt: "desc" },
            select: { score: true, analyzedAt: true }
          })
        ])
        .then(([plannerUpcoming, distributionRows, socialRows, pageviews24h, latestSeo, latestDiscover]) => ({
            plannerUpcoming,
            distribution: distributionRows.reduce<Record<string, number>>((accumulator, row) => {
              accumulator[row.status] = row._count._all;
              return accumulator;
            }, {}),
            social: {
              credentials: socialCredentialReadiness.map((platform) => ({
                platform: platform.platform,
                configured: platform.configured,
                missing: platform.missing
              })),
              statuses: socialRows.reduce<Record<string, number>>((accumulator, row) => {
                accumulator[row.status] = row._count._all;
                return accumulator;
              }, {}),
              totals: socialRows.reduce(
                (accumulator, row) => ({
                  clicks: accumulator.clicks + (row._sum.clicks || 0),
                  shares: accumulator.shares + (row._sum.shares || 0),
                  likes: accumulator.likes + (row._sum.likes || 0),
                  comments: accumulator.comments + (row._sum.comments || 0)
                }),
                { clicks: 0, shares: 0, likes: 0, comments: 0 }
              )
            },
            pageviews24h,
            latestSeo,
            latestDiscover
          }))
          .catch(() => null)
      : null;

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
      },
      publishing: {
        statuses: publishing,
        failedPublishes: publishingFailures
      },
      indexing: {
        readiness: googleIndexingReadiness(),
        statuses: indexing
      },
      growth
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
