import { refreshDueFeeds } from "@/lib/rss";
import { logError, logInfo } from "@/lib/logger";

export const maxDuration = 300;

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await refreshDueFeeds(30);
    logInfo("rss_cron_completed", {
      checked: results.length,
      imported: results.reduce(
        (sum, result) => sum + (result.ok && "imported" in result ? result.imported : 0),
        0
      )
    });
    return Response.json({ intervalMinutes: 30, results });
  } catch (error) {
    logError("rss_cron_failed", error);
    return Response.json({ error: "RSS cron failed" }, { status: 500 });
  }
}

export const POST = GET;
