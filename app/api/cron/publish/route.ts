import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import { publishDueScheduledPosts } from "@/lib/scheduledPublish";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();

  try {
    const published = await publishDueScheduledPosts();
    return Response.json({ ok: true, published });
  } catch (error) {
    logError("scheduled_publish_cron_failed", error);
    return Response.json({ error: "Scheduled publish cron failed" }, { status: 500 });
  }
}
