import { z } from "zod";
import { adPlacementDefinitions } from "@/lib/ads";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";

const AdSlotSchema = z.object({
  key: z.string().min(2).max(80),
  label: z.string().min(2).max(120),
  placement: z.string().min(2).max(80),
  routeScope: z.string().max(160).default("all"),
  enabled: z.boolean().default(true),
  lazy: z.boolean().default(true),
  sticky: z.boolean().default(false),
  minHeightDesktop: z.number().int().min(50).max(1200).default(280),
  minHeightMobile: z.number().int().min(50).max(1200).default(250),
  slotId: z.string().max(40).optional(),
  format: z.string().max(40).default("auto"),
  notes: z.string().max(500).optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = z.object({ action: z.enum(["initialize", "upsert", "toggle"]), slot: AdSlotSchema.optional(), key: z.string().optional(), enabled: z.boolean().optional() }).parse(await request.json().catch(() => ({})));
    if (body.action === "initialize") {
      await prisma.$transaction(
        adPlacementDefinitions.map((placement) =>
          prisma.adSlot.upsert({
            where: { key: placement.position },
            update: {},
            create: {
              key: placement.position,
              label: placement.label,
              placement: placement.position,
              routeScope: placement.routeScope,
              lazy: placement.lazy,
              sticky: placement.sticky,
              minHeightDesktop: placement.minHeightDesktop,
              minHeightMobile: placement.minHeightMobile,
              format: "auto"
            }
          })
        )
      );
    } else if (body.action === "toggle") {
      if (!body.key || typeof body.enabled !== "boolean") throw new Error("Slot key and enabled state are required.");
      await prisma.adSlot.update({ where: { key: body.key }, data: { enabled: body.enabled } });
    } else {
      if (!body.slot) throw new Error("Slot configuration is required.");
      await prisma.adSlot.upsert({ where: { key: body.slot.key }, update: body.slot, create: body.slot });
    }
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Invalid ad configuration." }, { status: 400 });
    return apiError(error);
  }
}
