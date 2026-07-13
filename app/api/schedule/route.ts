import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { schedulePost } from "@/lib/publishing";

const ScheduleSchema = z.object({
  postId: z.string().min(1),
  publishAt: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  timezone: z.string().max(100).optional(),
  recurrence: z.string().max(80).optional(),
  queueMode: z.boolean().optional(),
  note: z.string().max(1000).optional(),
  confirmedFactCheck: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = ScheduleSchema.parse(await request.json().catch(() => ({})));
    const value = body.publishAt || body.scheduledAt;
    if (!value) {
      return Response.json(
        { error: "publishAt or scheduledAt is required." },
        { status: 400 }
      );
    }
    const result = await schedulePost({
      postId: body.postId,
      publishAt: new Date(value),
      timezone: body.timezone,
      recurrence: body.recurrence,
      queueMode: body.queueMode,
      actor: "Admin",
      note: body.note,
      confirmedFactCheck: body.confirmedFactCheck ?? true
    });
    return Response.json({
      ok: true,
      status: result.post.status,
      publishAt: result.post.publishAt,
      scheduledAt: result.post.scheduledAt,
      timezone: result.post.timezone,
      readiness: result.readiness
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid schedule request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
