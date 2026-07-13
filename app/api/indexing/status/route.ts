import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { apiError } from "@/lib/apiSecurity";
import {
  googleIndexingReadiness,
  indexingStats,
  listIndexingJobs
} from "@/lib/googleIndexing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const StatusSchema = z.object({
  status: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(request.url);
    const params = StatusSchema.parse({
      status: searchParams.get("status") || undefined,
      limit: searchParams.get("limit") || undefined
    });
    const [stats, jobs] = await Promise.all([
      indexingStats(),
      listIndexingJobs({ status: params.status, limit: params.limit || 80 })
    ]);
    return Response.json({
      ok: true,
      readiness: googleIndexingReadiness(),
      stats,
      jobs
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid indexing status request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
