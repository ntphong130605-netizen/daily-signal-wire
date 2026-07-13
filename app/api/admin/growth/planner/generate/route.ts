import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { generateContentPlan } from "@/lib/growth";

const PlannerGenerateSchema = z.object({
  days: z.number().int().min(1).max(30).default(7)
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = PlannerGenerateSchema.parse(await request.json().catch(() => ({})));
    const items = await generateContentPlan(body.days);
    return Response.json({ ok: true, created: items.length, items });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid planner request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
