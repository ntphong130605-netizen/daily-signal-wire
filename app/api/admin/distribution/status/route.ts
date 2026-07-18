import { requireAdmin } from "@/lib/auth";
import { apiError } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";
import {
  socialAnalyticsSummary,
  socialQueuePaused,
  socialReadiness
} from "@/lib/socialDistribution";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const [jobs, statusGroups, paused] = await Promise.all([
      prisma.socialPost.findMany({
        select: {
          platform: true,
          clicks: true,
          impressions: true,
          reach: true,
          shares: true,
          likes: true,
          comments: true,
          publishedAt: true,
          lastPublishedAt: true
        },
        orderBy: { updatedAt: "desc" },
        take: 1000
      }),
      prisma.socialPost.groupBy({ by: ["status"], _count: { _all: true } }),
      socialQueuePaused()
    ]);
    return Response.json({
      ok: true,
      paused,
      credentials: socialReadiness().map((platform) => ({
        platform: platform.platform,
        configured: platform.configured,
        missing: platform.missing
      })),
      statuses: Object.fromEntries(statusGroups.map((row) => [row.status, row._count._all])),
      analytics: socialAnalyticsSummary(jobs)
    });
  } catch (error) {
    return apiError(error);
  }
}
