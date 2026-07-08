import { fetchGoogleTrendsUS } from "@/lib/trends";
import { databaseUnavailableResponse, isDatabaseConfigured, prisma } from "@/lib/prisma";
import { generateDraftForTrend } from "@/lib/generateDraft";
import { logError, logInfo } from "@/lib/logger";

export const maxDuration = 300;

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse();
  }

  try {
    const candidates = await fetchGoogleTrendsUS();
    const newTrendIds: string[] = [];

    for (const candidate of candidates) {
      const existing = await prisma.trend.findUnique({
        where: { normalizedKeyword: candidate.normalizedKeyword },
        select: { id: true }
      });
      if (existing) continue;
      const trend = await prisma.trend.create({
        data: {
          keyword: candidate.keyword,
          normalizedKeyword: candidate.normalizedKeyword,
          traffic: candidate.traffic,
          relatedQueries: JSON.stringify(candidate.relatedQueries),
          sourceUrls: JSON.stringify(candidate.sources.map((source) => source.url)),
          sourceContext: JSON.stringify(candidate.sources)
        }
      });
      newTrendIds.push(trend.id);
    }

    const maximum = Math.max(
      1,
      Math.min(10, Number(process.env.MAX_TRENDS_PER_RUN || 5))
    );
    const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
    const selected = aiConfigured ? newTrendIds.slice(0, maximum) : [];
    const results: { trendId: string; status: "completed" | "failed"; error?: string }[] =
      [];

    for (const trendId of selected) {
      try {
        await generateDraftForTrend(trendId);
        results.push({ trendId, status: "completed" });
      } catch (error) {
        results.push({
          trendId,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    logInfo("trend_cron_completed", {
      discovered: candidates.length,
      created: newTrendIds.length,
      generated: selected.length
    });
    return Response.json({
      discovered: candidates.length,
      created: newTrendIds.length,
      queuedForLater: Math.max(0, newTrendIds.length - selected.length),
      generationSkipped: !aiConfigured,
      generationMessage: aiConfigured
        ? null
        : "OPENAI_API_KEY is not configured; trends were saved as idle drafts.",
      results
    });
  } catch (error) {
    logError("trend_cron_failed", error);
    return Response.json({ error: "Trend cron failed" }, { status: 500 });
  }
}
