import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import {
  processPendingIndexingJobs,
  retryFailedIndexingJobs,
  retryIndexingJob
} from "@/lib/googleIndexing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RetrySchema = z.object({
  id: z.string().min(1).optional(),
  ids: z.array(z.string().min(1)).max(100).optional(),
  mode: z.enum(["failed", "pending", "all"]).optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = RetrySchema.parse(await request.json().catch(() => ({})));
    if (body.ids?.length) {
      const jobs = [];
      for (const id of body.ids) {
        jobs.push(await retryIndexingJob(id));
      }
      return Response.json({ ok: true, jobs });
    }
    if (body.id) {
      const job = await retryIndexingJob(body.id);
      return Response.json({ ok: true, jobs: [job] });
    }
    const result =
      body.mode === "failed"
        ? await retryFailedIndexingJobs(body.limit || 25)
        : await processPendingIndexingJobs(body.limit || 25);
    return Response.json({ ok: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid indexing retry request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
