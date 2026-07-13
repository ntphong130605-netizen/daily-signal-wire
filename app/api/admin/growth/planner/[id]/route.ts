import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";

const PlannerPatchSchema = z.object({
  plannedFor: z.string().datetime().optional(),
  status: z.enum(["planned", "drafting", "ready", "scheduled", "published", "skipped"]).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  timezone: z.string().max(100).optional(),
  notes: z.string().max(1000).optional()
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const body = PlannerPatchSchema.parse(await request.json().catch(() => ({})));
    const updated = await prisma.contentPlanItem.update({
      where: { id },
      data: {
        ...(body.plannedFor ? { plannedFor: new Date(body.plannedFor) } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.priority ? { priority: body.priority } : {}),
        ...(body.timezone ? { timezone: body.timezone } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {})
      }
    });
    return Response.json({ ok: true, item: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid planner update." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
