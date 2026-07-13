import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import {
  approvePost,
  archivePost,
  movePostToDraft,
  rejectPost,
  schedulePost
} from "@/lib/publishing";

const StatusSchema = z.object({
  action: z.enum(["approve", "reject", "schedule", "draft", "archive"]),
  rejectionReason: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
  publishAt: z.string().datetime().optional(),
  timezone: z.string().max(100).optional(),
  recurrence: z.string().max(80).optional(),
  queueMode: z.boolean().optional(),
  note: z.string().max(1000).optional(),
  confirmedFactCheck: z.boolean().optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const body = StatusSchema.parse(await request.json().catch(() => ({})));
    const { id } = await params;

    if (body.action === "reject") {
      const updated = await rejectPost({
        postId: id,
        actor: "Admin",
        reason: body.rejectionReason
      });
      return Response.json({ ok: true, status: updated.status });
    }

    if (body.action === "archive") {
      const updated = await archivePost({
        postId: id,
        actor: "Admin",
        note: body.note
      });
      return Response.json({ ok: true, status: updated.status });
    }

    if (body.action === "draft") {
      const updated = await movePostToDraft({
        postId: id,
        actor: "Admin",
        note: body.note
      });
      return Response.json({ ok: true, status: updated.status });
    }

    if (body.action === "approve") {
      const result = await approvePost({
        postId: id,
        actor: "Admin",
        note: body.note,
        confirmedFactCheck: Boolean(body.confirmedFactCheck)
      });
      return Response.json({
        ok: true,
        status: result.post.status,
        approvedAt: result.post.approvedAt,
        readiness: result.readiness
      });
    }

    const scheduledAt = body.publishAt || body.scheduledAt ? new Date(body.publishAt || body.scheduledAt || "") : null;
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      return Response.json(
        { error: "A valid scheduledAt ISO datetime is required." },
        { status: 400 }
      );
    }
    if (scheduledAt.getTime() <= Date.now()) {
      return Response.json(
        { error: "Schedule time must be in the future." },
        { status: 400 }
      );
    }
    const result = await schedulePost({
      postId: id,
      publishAt: scheduledAt,
      timezone: body.timezone,
      recurrence: body.recurrence,
      queueMode: body.queueMode,
      actor: "Admin",
      note: body.note,
      confirmedFactCheck: Boolean(body.confirmedFactCheck)
    });
    return Response.json({
      ok: true,
      status: result.post.status,
      scheduledAt: result.post.scheduledAt,
      publishAt: result.post.publishAt,
      timezone: result.post.timezone,
      readiness: result.readiness
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid status request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
