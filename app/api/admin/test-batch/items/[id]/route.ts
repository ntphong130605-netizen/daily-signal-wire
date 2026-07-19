import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import {
  approveProductionTestItem,
  rejectProductionTestItem,
  retryProductionTestItem
} from "@/lib/productionTestBatch";

export const maxDuration = 300;

const ActionSchema = z.object({
  action: z.enum(["approve", "reject", "retry"]),
  reason: z.string().max(1000).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const body = ActionSchema.parse(await request.json().catch(() => ({})));
    if (body.action === "approve") {
      return Response.json({ ok: true, item: await approveProductionTestItem(id) });
    }
    if (body.action === "reject") {
      return Response.json({ ok: true, item: await rejectProductionTestItem(id, body.reason) });
    }
    return Response.json({ ok: true, result: await retryProductionTestItem(id) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid action." }, { status: 400 });
    }
    return apiError(error);
  }
}
