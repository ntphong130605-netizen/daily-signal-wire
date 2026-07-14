import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { publishDueScheduledPosts } from "@/lib/scheduledPublish";
import { processSocialQueue } from "@/lib/socialDistribution";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();

  try {
    const [publishing, social] = await Promise.all([
      publishDueScheduledPosts(),
      processSocialQueue()
    ]);
    return Response.json({ ok: true, publishing, social });
  } catch (error) {
    logError("scheduled_publish_cron_failed", error);
    return Response.json({ error: "Scheduled publish cron failed" }, { status: 500 });
  }
}
