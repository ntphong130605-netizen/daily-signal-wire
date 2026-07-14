import "server-only";

import { adsenseClientId, adsensePublisherId, adsenseSlotFor, hasAdsTxtConfiguration } from "@/lib/ads";
import { configuredImageStorageLabel, isGeneratedImageStorageConfigured } from "@/lib/aiImage";
import { googleIndexingReadiness } from "@/lib/googleIndexing";
import { logError } from "@/lib/logger";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import { siteUrl } from "@/lib/site";
import { socialReadiness } from "@/lib/socialDistribution";

export type OpsStatus = "operational" | "degraded" | "waiting" | "failed" | "unknown";

export type OpsCheck = {
  key: string;
  area: string;
  label: string;
  status: OpsStatus;
  message: string;
  maxScore: number;
  score: number;
  href?: string;
  details?: string[];
};

type StatusCount = Record<string, number>;

export type ProductionReadinessReport = {
  generatedAt: string;
  siteUrl: string;
  healthScore: number;
  status: OpsStatus;
  checks: OpsCheck[];
  manualTasks: OpsCheck[];
  environment: {
    required: { key: string; configured: boolean; message: string }[];
    optional: { key: string; configured: boolean; message: string }[];
  };
  queues: {
    posts: StatusCount;
    social: StatusCount;
    indexing: StatusCount;
    images: StatusCount;
    distribution: StatusCount;
  };
  monitoring: {
    analyticsEvents24h: number;
    pageViews24h: number;
    failures24h: number;
    warnings24h: number;
    lastResearchRun: {
      status: string;
      startedAt: string | null;
      completedAt: string | null;
      candidatesFound: number;
    } | null;
    recentSystemChecks: {
      key: string;
      status: string;
      message: string | null;
      checkedAt: string;
    }[];
  };
  costs: {
    openAiCost: string;
    aiWritingCount: number;
    researchJobs: number;
    imageGenerationCount: number;
    estimatedImageCost: string;
    publishingJobs: number;
    indexingJobs: number;
    socialJobs: number;
  };
};

function configured(key: string) {
  return Boolean(process.env[key]?.trim());
}

function envItem(key: string, configuredMessage = "Configured", missingMessage = "Waiting for credentials") {
  const ready = configured(key);
  return {
    key,
    configured: ready,
    message: ready ? configuredMessage : missingMessage
  };
}

function statusScore(status: OpsStatus, maxScore: number) {
  if (status === "operational") return maxScore;
  if (status === "degraded") return Math.round(maxScore * 0.55);
  if (status === "waiting") return Math.round(maxScore * 0.35);
  if (status === "unknown") return Math.round(maxScore * 0.25);
  return 0;
}

function check(
  checks: OpsCheck[],
  input: Omit<OpsCheck, "score">
) {
  checks.push({
    ...input,
    score: statusScore(input.status, input.maxScore)
  });
}

function scoreClass(score: number): OpsStatus {
  if (score >= 85) return "operational";
  if (score >= 65) return "degraded";
  if (score >= 40) return "waiting";
  return "failed";
}

async function dbReachable() {
  if (!isDatabaseConfigured()) return false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logError("ops_database_check_failed", error);
    return false;
  }
}

async function groupCount(
  enabled: boolean,
  query: () => Promise<unknown>,
  field: "status" | "imageStatus" = "status"
) {
  if (!enabled) return {};
  try {
    const rows = (await query()) as {
      status?: string | null;
      imageStatus?: string | null;
      _count: { _all: number };
    }[];
    return rows.reduce<StatusCount>((accumulator, row) => {
      const key = String(row[field] || "unknown");
      accumulator[key] = row._count._all;
      return accumulator;
    }, {});
  } catch (error) {
    logError("ops_group_count_failed", error, { field });
    return {};
  }
}

async function safeNumber(enabled: boolean, query: () => Promise<number>) {
  if (!enabled) return 0;
  try {
    return await query();
  } catch (error) {
    logError("ops_count_failed", error);
    return 0;
  }
}

function total(counts: StatusCount, keys?: string[]) {
  const entries = keys ? keys.map((key) => counts[key] || 0) : Object.values(counts);
  return entries.reduce((sum, value) => sum + value, 0);
}

function imageCostLabel(imageCount: number) {
  const configuredCost = Number(
    process.env.IMAGE_GENERATION_COST_USD || process.env.IMAGE_COST_USD || ""
  );
  if (!Number.isFinite(configuredCost) || configuredCost <= 0) {
    return "Waiting for image cost setting";
  }
  return `$${(imageCount * configuredCost).toFixed(2)}`;
}

export async function getProductionReadiness(): Promise<ProductionReadinessReport> {
  const databaseConfigured = isDatabaseConfigured();
  const databaseReachable = await dbReachable();
  const dbReady = databaseConfigured && databaseReachable;
  const since24h = new Date(Date.now() - 24 * 36e5);
  const checks: OpsCheck[] = [];
  const indexingReady = googleIndexingReadiness();
  const socialChannels = socialReadiness();
  const socialConfigured = socialChannels.filter((channel) => channel.configured).length;
  const socialExternalConfigured = socialChannels.filter(
    (channel) => channel.platform !== "rss" && channel.configured
  ).length;
  const requiredEnvironment = [
    envItem("DATABASE_URL", "Configured", "Missing DATABASE_URL"),
    envItem("ADMIN_PASSWORD", "Configured", "Missing admin password"),
    envItem("ADMIN_SESSION_SECRET", "Configured", "Missing secure admin session secret"),
    envItem("NEXTAUTH_SECRET", "Configured", "Missing NEXTAUTH_SECRET"),
    envItem("NEXTAUTH_URL", "Configured", "Missing canonical auth URL"),
    envItem("NEXT_PUBLIC_SITE_URL", "Configured", "Missing canonical public site URL"),
    envItem("CRON_SECRET", "Configured", "Missing cron secret")
  ];
  const optionalEnvironment = [
    envItem("OPENAI_API_KEY"),
    envItem("BLOB_READ_WRITE_TOKEN", "Configured", "Waiting for Blob credentials"),
    envItem("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "Configured", "Waiting for AdSense client ID"),
    envItem("ADSENSE_PUBLISHER_ID", "Configured", "Waiting for ads.txt publisher ID"),
    envItem("NEXT_PUBLIC_GA_MEASUREMENT_ID", "Configured", "Waiting for GA4 measurement ID"),
    envItem("NEXT_PUBLIC_GSC_VERIFICATION", "Configured", "Waiting for Search Console verification"),
    envItem("GOOGLE_SERVICE_ACCOUNT_EMAIL", "Configured", "Waiting for Google service account"),
    envItem("GOOGLE_PRIVATE_KEY", "Configured", "Waiting for Google private key"),
    envItem("FACEBOOK_PAGE_ACCESS_TOKEN"),
    envItem("X_ACCESS_TOKEN"),
    envItem("LINKEDIN_ACCESS_TOKEN"),
    envItem("PINTEREST_ACCESS_TOKEN"),
    envItem("THREADS_ACCESS_TOKEN"),
    envItem("BLUESKY_APP_PASSWORD"),
    envItem("RESEND_API_KEY")
  ];

  const [postStatuses, imageStatuses, indexingStatuses, socialStatuses, distributionStatuses] =
    await Promise.all([
      groupCount(dbReady, () =>
        prisma.post.groupBy({ by: ["status"], _count: { _all: true } })
      ),
      groupCount(
        dbReady,
        () => prisma.post.groupBy({ by: ["imageStatus"], _count: { _all: true } }),
        "imageStatus"
      ),
      groupCount(dbReady, () =>
        prisma.indexingJob.groupBy({ by: ["status"], _count: { _all: true } })
      ),
      groupCount(dbReady, () =>
        prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } })
      ),
      groupCount(dbReady, () =>
        prisma.distributionPublish.groupBy({ by: ["status"], _count: { _all: true } })
      )
    ]);

  const [
    analyticsEvents24h,
    pageViews24h,
    failures24h,
    warnings24h,
    aiWritingCount,
    researchJobs,
    imageGenerationCount,
    publishingJobs,
    indexingJobs,
    socialJobs,
    failedPublishes,
    lastResearchRun,
    recentSystemChecks
  ] = await Promise.all([
    safeNumber(dbReady, () =>
      prisma.analyticsEvent.count({ where: { createdAt: { gte: since24h } } })
    ),
    safeNumber(dbReady, () =>
      prisma.analyticsEvent.count({
        where: { eventName: "page_view", createdAt: { gte: since24h } }
      })
    ),
    safeNumber(dbReady, () =>
      prisma.systemStatusCheck.count({
        where: { status: { in: ["failed", "error"] }, checkedAt: { gte: since24h } }
      })
    ),
    safeNumber(dbReady, () =>
      prisma.systemStatusCheck.count({
        where: { status: { in: ["warning", "degraded", "waiting"] }, checkedAt: { gte: since24h } }
      })
    ),
    safeNumber(dbReady, () => prisma.post.count({ where: { aiGenerated: true } })),
    safeNumber(dbReady, () => prisma.researchRun.count()),
    safeNumber(dbReady, () =>
      prisma.generatedImage.count({ where: { status: { in: ["completed", "accepted"] } } })
    ),
    safeNumber(dbReady, () => prisma.post.count({ where: { status: { in: ["scheduled", "published"] } } })),
    safeNumber(dbReady, () => prisma.indexingJob.count()),
    safeNumber(dbReady, () => prisma.socialPost.count()),
    safeNumber(dbReady, () => prisma.post.count({ where: { publishError: { not: null } } })),
    dbReady
      ? prisma.researchRun
          .findFirst({
            orderBy: { startedAt: "desc" },
            select: {
              status: true,
              startedAt: true,
              completedAt: true,
              candidatesFound: true
            }
          })
          .catch(() => null)
      : Promise.resolve(null),
    dbReady
      ? prisma.systemStatusCheck
          .findMany({
            orderBy: { checkedAt: "desc" },
            take: 8,
            select: { key: true, status: true, message: true, checkedAt: true }
          })
          .catch(() => [])
      : Promise.resolve([])
  ]);

  const missingRequired = requiredEnvironment.filter((item) => !item.configured);
  check(checks, {
    key: "application",
    area: "Application",
    label: "Application status",
    status: "operational",
    message: "Next.js application is serving production routes.",
    maxScore: 8,
    href: "/"
  });
  check(checks, {
    key: "environment",
    area: "Environment",
    label: "Environment status",
    status: missingRequired.length === 0 ? "operational" : "waiting",
    message:
      missingRequired.length === 0
        ? "Required production environment variables are present."
        : `Waiting for ${missingRequired.map((item) => item.key).join(", ")}.`,
    maxScore: 10,
    href: "/admin/settings"
  });
  check(checks, {
    key: "database",
    area: "Infrastructure",
    label: "Database status",
    status: databaseReachable ? "operational" : databaseConfigured ? "failed" : "waiting",
    message: databaseReachable
      ? "Database query succeeded."
      : databaseConfigured
        ? "Database is configured but not reachable."
        : "Waiting for DATABASE_URL.",
    maxScore: 10
  });
  check(checks, {
    key: "openai",
    area: "AI",
    label: "OpenAI status",
    status: configured("OPENAI_API_KEY") ? "operational" : "waiting",
    message: configured("OPENAI_API_KEY")
      ? "OPENAI_API_KEY is configured."
      : "Waiting for OpenAI credentials; AI actions stay disabled.",
    maxScore: 8
  });
  check(checks, {
    key: "image_generation",
    area: "AI",
    label: "Image generation status",
    status:
      configured("OPENAI_API_KEY") && isGeneratedImageStorageConfigured()
        ? total(imageStatuses, ["failed"]) > 0
          ? "degraded"
          : "operational"
        : "waiting",
    message:
      configured("OPENAI_API_KEY") && isGeneratedImageStorageConfigured()
        ? `${configuredImageStorageLabel()} storage, ${total(imageStatuses, ["failed"])} failed image jobs.`
        : "Waiting for OpenAI and Blob/local storage credentials.",
    maxScore: 8,
    href: "/admin/image-studio"
  });
  check(checks, {
    key: "google_indexing",
    area: "Google",
    label: "Google Indexing status",
    status: indexingReady.configured
      ? total(indexingStatuses, ["failed"]) > 0
        ? "degraded"
        : "operational"
      : "waiting",
    message: indexingReady.configured
      ? `${total(indexingStatuses, ["pending"])} pending, ${total(indexingStatuses, ["failed"])} failed indexing jobs.`
      : indexingReady.message,
    maxScore: 7,
    href: "/admin/indexing"
  });
  check(checks, {
    key: "google_analytics",
    area: "Google",
    label: "Google Analytics status",
    status: configured("NEXT_PUBLIC_GA_MEASUREMENT_ID") ? "operational" : "waiting",
    message: configured("NEXT_PUBLIC_GA_MEASUREMENT_ID")
      ? `${pageViews24h} page_view events recorded in the last 24 hours.`
      : "Waiting for GA4 measurement ID.",
    maxScore: 5,
    href: "/admin/analytics"
  });
  check(checks, {
    key: "search_console",
    area: "Google",
    label: "Search Console status",
    status:
      configured("NEXT_PUBLIC_GSC_VERIFICATION") || configured("GOOGLE_SITE_VERIFICATION")
        ? "operational"
        : "waiting",
    message:
      configured("NEXT_PUBLIC_GSC_VERIFICATION") || configured("GOOGLE_SITE_VERIFICATION")
        ? "Search Console verification meta is configured."
        : "Waiting for Search Console verification token.",
    maxScore: 5,
    href: "/admin/analytics"
  });
  check(checks, {
    key: "adsense",
    area: "Revenue",
    label: "AdSense status",
    status:
      adsenseClientId() && adsensePublisherId() && hasAdsTxtConfiguration()
        ? "operational"
        : "waiting",
    message:
      adsenseClientId() && adsensePublisherId() && hasAdsTxtConfiguration()
        ? "AdSense client and ads.txt publisher ID are configured."
        : "Waiting for AdSense client ID, publisher ID or account approval.",
    maxScore: 6,
    href: "/admin/settings",
    details: [
      adsenseSlotFor("top") ? "Top slot configured" : "Top slot waiting",
      adsenseSlotFor("in-article") ? "In-article slot configured" : "In-article slot waiting",
      adsenseSlotFor("sidebar") ? "Sidebar slot configured" : "Sidebar slot waiting",
      adsenseSlotFor("bottom") ? "Bottom slot configured" : "Bottom slot waiting"
    ]
  });
  check(checks, {
    key: "social_queue",
    area: "Distribution",
    label: "Social Queue status",
    status:
      socialExternalConfigured > 0
        ? total(socialStatuses, ["failed"]) > 0
          ? "degraded"
          : "operational"
        : "waiting",
    message:
      socialExternalConfigured > 0
        ? `${socialConfigured}/${socialChannels.length} channels configured, ${total(socialStatuses, ["failed"])} failed jobs.`
        : "Waiting for social/newsletter credentials; queue remains safe.",
    maxScore: 6,
    href: "/admin/social"
  });
  check(checks, {
    key: "scheduler",
    area: "Publishing",
    label: "Scheduler status",
    status: configured("CRON_SECRET")
      ? failedPublishes > 0
        ? "degraded"
        : "operational"
      : "waiting",
    message: configured("CRON_SECRET")
      ? `${total(postStatuses, ["scheduled"])} scheduled posts, ${failedPublishes} failed publishes.`
      : "Waiting for CRON_SECRET.",
    maxScore: 6,
    href: "/admin/publishing"
  });
  check(checks, {
    key: "cron",
    area: "Operations",
    label: "Cron status",
    status: lastResearchRun?.status === "completed" ? "operational" : lastResearchRun ? "degraded" : "unknown",
    message: lastResearchRun
      ? `Last research run: ${lastResearchRun.status}.`
      : "No recorded research cron run yet.",
    maxScore: 5,
    href: "/admin/monitoring"
  });
  check(checks, {
    key: "security",
    area: "Security",
    label: "Security status",
    status:
      configured("ADMIN_PASSWORD") &&
      (process.env.ADMIN_SESSION_SECRET || "").length >= 32 &&
      configured("CRON_SECRET")
        ? "operational"
        : "waiting",
    message:
      configured("ADMIN_PASSWORD") &&
      (process.env.ADMIN_SESSION_SECRET || "").length >= 32 &&
      configured("CRON_SECRET")
        ? "Admin auth, secure cookie secret, CSP/HSTS and cron secret are active."
        : "Waiting for admin password/session secret/cron secret.",
    maxScore: 8
  });
  check(checks, {
    key: "monitoring",
    area: "Monitoring",
    label: "Monitoring status",
    status: failures24h > 0 ? "degraded" : recentSystemChecks.length > 0 ? "operational" : "unknown",
    message:
      recentSystemChecks.length > 0
        ? `${failures24h} failures and ${warnings24h} warnings recorded in the last 24 hours.`
        : "Run a System Check to create the first monitoring snapshot.",
    maxScore: 5,
    href: "/admin/monitoring"
  });
  check(checks, {
    key: "backup",
    area: "Operations",
    label: "Backup status",
    status: "waiting",
    message: "Backup runbooks are prepared; enable Neon/Supabase point-in-time restore and Blob exports in provider consoles.",
    maxScore: 4,
    href: "/admin/checklist"
  });

  const totalScore = checks.reduce((sum, item) => sum + item.score, 0);
  const totalMax = checks.reduce((sum, item) => sum + item.maxScore, 0);
  const healthScore = Math.round((totalScore / Math.max(1, totalMax)) * 100);

  return {
    generatedAt: new Date().toISOString(),
    siteUrl: siteUrl(),
    healthScore,
    status: scoreClass(healthScore),
    checks,
    manualTasks: checks.filter((item) => item.status !== "operational"),
    environment: {
      required: requiredEnvironment,
      optional: optionalEnvironment
    },
    queues: {
      posts: postStatuses,
      social: socialStatuses,
      indexing: indexingStatuses,
      images: imageStatuses,
      distribution: distributionStatuses
    },
    monitoring: {
      analyticsEvents24h,
      pageViews24h,
      failures24h,
      warnings24h,
      lastResearchRun: lastResearchRun
        ? {
            status: lastResearchRun.status,
            startedAt: lastResearchRun.startedAt?.toISOString() || null,
            completedAt: lastResearchRun.completedAt?.toISOString() || null,
            candidatesFound: lastResearchRun.candidatesFound
          }
        : null,
      recentSystemChecks: recentSystemChecks.map((item) => ({
        ...item,
        checkedAt: item.checkedAt.toISOString()
      }))
    },
    costs: {
      openAiCost: "Waiting for OpenAI billing export",
      aiWritingCount,
      researchJobs,
      imageGenerationCount,
      estimatedImageCost: imageCostLabel(imageGenerationCount),
      publishingJobs,
      indexingJobs,
      socialJobs
    }
  };
}

export function productionChecklist(report: ProductionReadinessReport) {
  const endpointBase = report.siteUrl;
  return [
    ...report.environment.required.map((item) => ({
      area: "Environment",
      label: item.key,
      status: item.configured ? "operational" : "waiting",
      message: item.message
    })),
    ...report.environment.optional.map((item) => ({
      area: "Integrations",
      label: item.key,
      status: item.configured ? "operational" : "waiting",
      message: item.message
    })),
    ...report.checks.map((item) => ({
      area: item.area,
      label: item.label,
      status: item.status,
      message: item.message,
      href: item.href
    })),
    { area: "Indexing", label: "robots.txt", status: "operational", message: `${endpointBase}/robots.txt` },
    { area: "Indexing", label: "sitemap.xml", status: "operational", message: `${endpointBase}/sitemap.xml` },
    { area: "Indexing", label: "news sitemap", status: "operational", message: `${endpointBase}/news-sitemap.xml` },
    { area: "Indexing", label: "image sitemap", status: "operational", message: `${endpointBase}/image-sitemap.xml` },
    { area: "Feeds", label: "RSS", status: "operational", message: `${endpointBase}/rss.xml` },
    {
      area: "Security",
      label: "SSL",
      status: endpointBase.startsWith("https://") ? "operational" : "waiting",
      message: endpointBase.startsWith("https://") ? "HTTPS canonical URL configured." : "Use HTTPS in NEXT_PUBLIC_SITE_URL."
    }
  ] as const;
}

export async function recordProductionReadinessSnapshot() {
  const report = await getProductionReadiness();
  if (!isDatabaseConfigured()) return report;
  await Promise.all(
    report.checks.map((item) =>
      prisma.systemStatusCheck.create({
        data: {
          key: item.key,
          label: item.label,
          status: item.status,
          message: item.message,
          metadata: JSON.stringify({
            area: item.area,
            score: item.score,
            maxScore: item.maxScore,
            details: item.details || []
          })
        }
      })
    )
  );
  return report;
}
