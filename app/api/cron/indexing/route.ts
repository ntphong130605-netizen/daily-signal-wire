import { revalidatePath } from "next/cache";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { logError } from "@/lib/logger";
import {
  googleIndexingReadiness,
  processPendingIndexingJobs
} from "@/lib/googleIndexing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function revalidateIndexingResources() {
  for (const path of [
    "/sitemap.xml",
    "/news-sitemap.xml",
    "/image-sitemap.xml",
    "/video-sitemap.xml",
    "/rss.xml",
    "/robots.txt"
  ]) {
    try {
      revalidatePath(path);
    } catch (error) {
      logError("indexing_cron_revalidate_failed", error, { path });
    }
  }
}

export async function GET(request: Request) {
  const configuredSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!configuredSecret || authorization !== `Bearer ${configuredSecret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();

  try {
    revalidateIndexingResources();
    const summary = await processPendingIndexingJobs(25);
    return Response.json({
      ok: true,
      readiness: googleIndexingReadiness(),
      ...summary
    });
  } catch (error) {
    logError("indexing_cron_failed", error);
    return Response.json({ error: "Indexing cron failed" }, { status: 500 });
  }
}
