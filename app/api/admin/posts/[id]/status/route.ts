import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";
import { validatePostForPublishing } from "@/lib/publishGuard";

const StatusSchema = z.object({
  action: z.enum(["approve", "reject", "schedule", "draft"]),
  rejectionReason: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime().optional(),
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
    const post = await prisma.post.findUniqueOrThrow({
      where: { id },
      include: {
        category: { select: { name: true } },
        trend: { select: { category: true } }
      }
    });

    if (body.action === "reject") {
      const updated = await prisma.post.update({
        where: { id },
        data: {
          status: "rejected",
          rejectedAt: new Date(),
          rejectionReason:
            body.rejectionReason?.trim() || "Rejected by editor for revision.",
          scheduledAt: null,
          publishedAt: null
        }
      });
      return Response.json({ ok: true, status: updated.status });
    }

    if (body.action === "draft" || body.action === "approve") {
      const updated = await prisma.post.update({
        where: { id },
        data: {
          status: "draft",
          rejectedAt: null,
          rejectionReason: null,
          scheduledAt: null,
          publishedAt: null
        }
      });
      return Response.json({ ok: true, status: updated.status });
    }

    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
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

    const error = validatePostForPublishing(post, Boolean(body.confirmedFactCheck));
    if (error) return Response.json({ error }, { status: 400 });

    const updated = await prisma.post.update({
      where: { id },
      data: {
        status: "scheduled",
        scheduledAt,
        publishedAt: null,
        rejectedAt: null,
        rejectionReason: null
      }
    });
    return Response.json({ ok: true, status: updated.status, scheduledAt });
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
