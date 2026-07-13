import { processDistributionQueue } from "@/lib/growth";
import { logError } from "@/lib/logger";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();

  try {
    const summary = await processDistributionQueue();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    logError("distribution_cron_failed", error);
    return Response.json({ error: "Distribution cron failed" }, { status: 500 });
  }
}

export const POST = GET;
