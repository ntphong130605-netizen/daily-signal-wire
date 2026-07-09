import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { generateDraftForTrend } from "@/lib/generateDraft";
import { logError, logInfo } from "@/lib/logger";
import { ingestGoogleTrendsUS } from "@/lib/trendIngest";

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
    const ingest = await ingestGoogleTrendsUS();

    const maximum = Math.max(
      1,
      Math.min(10, Number(process.env.MAX_TRENDS_PER_RUN || 5))
    );
    const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
    const selected = aiConfigured ? ingest.newTrendIds.slice(0, maximum) : [];
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
      discovered: ingest.discovered,
      created: ingest.created,
      generated: selected.length
    });
    return Response.json({
      discovered: ingest.discovered,
      created: ingest.created,
      existing: ingest.existing,
      queuedForLater: Math.max(0, ingest.newTrendIds.length - selected.length),
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
