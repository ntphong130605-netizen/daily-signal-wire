import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import {
  approveEligibleProductionTestItems,
  cancelRemainingProductionTestBatch,
  processNextProductionTestItem
} from "@/lib/productionTestBatch";

export const maxDuration = 300;

const ActionSchema = z.object({
  action: z.enum(["process_next", "approve_all", "cancel_remaining"])
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const body = ActionSchema.parse(await request.json().catch(() => ({})));
    if (body.action === "process_next") {
      const limited = rateLimit(requestKey(request, `one-time-test-process:${id}`), {
        limit: 14,
        windowMs: 4 * 60 * 60_000
      });
      if (!limited.allowed) {
        return Response.json({ error: "Batch processing rate limit reached." }, { status: 429 });
      }
      return Response.json({ ok: true, result: await processNextProductionTestItem(id) });
    }
    if (body.action === "approve_all") {
      return Response.json({ ok: true, result: await approveEligibleProductionTestItems(id) });
    }
    return Response.json({ ok: true, result: await cancelRemainingProductionTestBatch(id) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid action." }, { status: 400 });
    }
    return apiError(error);
  }
}
