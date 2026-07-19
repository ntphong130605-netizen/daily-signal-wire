import { apiError, protectMutation } from "@/lib/apiSecurity";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { createOneTimeProductionTestBatch } from "@/lib/productionTestBatch";

export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }
    const limited = rateLimit(requestKey(request, "one-time-test-batch-create"), {
      limit: 2,
      windowMs: 24 * 60 * 60_000
    });
    if (!limited.allowed) {
      return Response.json(
        { error: "The one-time test batch creation limit has been reached." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }
    const result = await createOneTimeProductionTestBatch();
    return Response.json({
      ok: true,
      batchId: result.batch.id,
      selected: result.batch.items.length,
      status: result.batch.status,
      reused: result.reused
    });
  } catch (error) {
    return apiError(error);
  }
}
