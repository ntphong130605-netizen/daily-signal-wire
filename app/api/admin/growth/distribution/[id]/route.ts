import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { retryDistributionJob } from "@/lib/growth";
import { prisma } from "@/lib/prisma";
import { parseJsonArray } from "@/lib/json";

const DistributionActionSchema = z.object({
  action: z.enum(["retry", "mark_sent", "mark_failed"]),
  destinationUrl: z.string().url().optional(),
  error: z.string().max(1000).optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const body = DistributionActionSchema.parse(await request.json().catch(() => ({})));
    if (body.action === "retry") {
      const job = await retryDistributionJob(id);
      return Response.json({ ok: true, job });
    }

    const current = await prisma.distributionPublish.findUniqueOrThrow({ where: { id } });
    const history = parseJsonArray(current.history);
    const status = body.action === "mark_sent" ? "published" : "failed";
    history.unshift({
      at: new Date().toISOString(),
      status,
      note: body.error || "Updated by editor."
    });
    const job = await prisma.distributionPublish.update({
      where: { id },
      data: {
        status,
        destinationUrl: body.destinationUrl || current.destinationUrl,
        publishedAt: status === "published" ? new Date() : current.publishedAt,
        lastError: status === "failed" ? body.error || "Distribution failed." : null,
        history: JSON.stringify(history.slice(0, 30))
      }
    });
    return Response.json({ ok: true, job });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid distribution action." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
