import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";

const ExperimentSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    key: z.string().regex(/^[a-z0-9_-]+$/).max(80),
    name: z.string().min(2).max(140),
    type: z.enum(["headline", "cta", "ad_position", "image"]),
    targetArticleSlug: z.string().max(180).optional(),
    targetCategory: z.string().max(100).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    variants: z.array(z.object({ key: z.string().regex(/^[a-z0-9_-]+$/).max(40), label: z.string().min(1).max(80), value: z.string().min(1).max(2000), weight: z.number().int().min(1).max(100) })).min(2).max(5)
  }),
  z.object({ action: z.literal("status"), id: z.string().min(1), status: z.enum(["draft", "active", "paused", "completed"]) }),
  z.object({ action: z.literal("select_winner"), id: z.string().min(1), variantId: z.string().min(1).optional(), automatic: z.boolean().default(false) })
]);

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = ExperimentSchema.parse(await request.json().catch(() => ({})));
    if (body.action === "create") {
      const totalWeight = body.variants.reduce((sum, variant) => sum + variant.weight, 0);
      if (totalWeight !== 100) return Response.json({ error: "Variant weights must total 100." }, { status: 400 });
      const experiment = await prisma.revenueExperiment.create({
        data: {
          key: body.key,
          name: body.name,
          type: body.type,
          targetArticleSlug: body.targetArticleSlug,
          targetCategory: body.targetCategory,
          startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
          endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
          variants: { create: body.variants }
        },
        include: { variants: true }
      });
      return Response.json({ ok: true, experiment });
    }
    if (body.action === "status") {
      const experiment = await prisma.revenueExperiment.update({ where: { id: body.id }, data: { status: body.status } });
      return Response.json({ ok: true, experiment });
    }
    const experiment = await prisma.revenueExperiment.findUnique({ where: { id: body.id }, include: { variants: true } });
    if (!experiment) return Response.json({ error: "Experiment not found." }, { status: 404 });
    const automaticWinner = [...experiment.variants]
      .filter((variant) => variant.impressions >= 100)
      .sort((a, b) => b.revenue - a.revenue || (b.conversions / b.impressions) - (a.conversions / a.impressions) || (b.clicks / b.impressions) - (a.clicks / a.impressions))[0];
    const winnerId = body.automatic ? automaticWinner?.id : body.variantId;
    if (!winnerId) return Response.json({ error: "No statistically eligible winner yet." }, { status: 409 });
    await prisma.$transaction([
      prisma.revenueExperimentVariant.updateMany({ where: { experimentId: body.id }, data: { isWinner: false } }),
      prisma.revenueExperimentVariant.update({ where: { id: winnerId }, data: { isWinner: true } }),
      prisma.revenueExperiment.update({ where: { id: body.id }, data: { winnerVariantId: winnerId, status: "completed" } })
    ]);
    return Response.json({ ok: true, winnerId });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Invalid experiment." }, { status: 400 });
    return apiError(error);
  }
}
