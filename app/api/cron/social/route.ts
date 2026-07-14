import { logError } from "@/lib/logger";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { processSocialQueue } from "@/lib/socialDistribution";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();

  try {
    const summary = await processSocialQueue();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    logError("social_cron_failed", error);
    return Response.json({ error: "Social distribution cron failed" }, { status: 500 });
  }
}

export const POST = GET;
