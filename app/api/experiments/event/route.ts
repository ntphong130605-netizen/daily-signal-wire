import { z } from "zod";
import { prisma, databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";

const ExperimentEventSchema = z.object({
  experimentId: z.string().min(1),
  variantId: z.string().min(1),
  event: z.enum(["impression", "click", "conversion", "revenue"]),
  value: z.number().min(0).max(1_000_000).optional()
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();
  const limited = rateLimit(requestKey(request, "experiment-event"), { limit: 60, windowMs: 60_000 });
  if (!limited.allowed) return Response.json({ error: "Rate limit reached." }, { status: 429 });
  try {
    const body = ExperimentEventSchema.parse(await request.json().catch(() => ({})));
    const data = body.event === "impression"
      ? { impressions: { increment: 1 } }
      : body.event === "click"
        ? { clicks: { increment: 1 } }
        : body.event === "conversion"
          ? { conversions: { increment: 1 } }
          : { revenue: { increment: body.value || 0 } };
    const result = await prisma.revenueExperimentVariant.updateMany({ where: { id: body.variantId, experimentId: body.experimentId }, data });
    return result.count ? Response.json({ ok: true }) : Response.json({ error: "Variant not found." }, { status: 404 });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Invalid event." }, { status: 400 });
    return Response.json({ error: "Experiment event failed." }, { status: 500 });
  }
}
