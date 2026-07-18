import { z } from "zod";
import { affiliateNetworks } from "@/lib/revenue";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";

const SafeUrl = z.string().url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) URLs are allowed.");
const AffiliateActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create_program"),
    name: z.string().min(2).max(120),
    network: z.enum(affiliateNetworks),
    websiteUrl: SafeUrl.optional(),
    disclosure: z.string().min(20).max(500)
  }),
  z.object({
    action: z.literal("create_link"),
    programId: z.string().min(1),
    label: z.string().min(2).max(180),
    destinationUrl: SafeUrl,
    trackingUrl: SafeUrl,
    category: z.string().max(100).optional(),
    keywords: z.array(z.string().min(2).max(80)).max(30).default([]),
    imageUrl: SafeUrl.optional(),
    priceText: z.string().max(80).optional(),
    callToAction: z.string().min(2).max(80).default("Learn more"),
    disclosure: z.string().max(500).optional()
  }),
  z.object({ action: z.literal("set_status"), entity: z.enum(["program", "link"]), id: z.string().min(1), status: z.enum(["active", "paused", "archived"]) })
]);

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = AffiliateActionSchema.parse(await request.json().catch(() => ({})));
    if (body.action === "create_program") {
      const program = await prisma.affiliateProgram.create({
        data: {
          name: body.name,
          network: body.network,
          websiteUrl: body.websiteUrl,
          disclosure: body.disclosure
        }
      });
      return Response.json({ ok: true, program });
    }
    if (body.action === "create_link") {
      const link = await prisma.affiliateLink.create({
        data: {
          programId: body.programId,
          label: body.label,
          destinationUrl: body.destinationUrl,
          trackingUrl: body.trackingUrl,
          category: body.category,
          keywords: JSON.stringify(body.keywords),
          imageUrl: body.imageUrl,
          priceText: body.priceText,
          callToAction: body.callToAction,
          disclosure: body.disclosure
        }
      });
      return Response.json({ ok: true, link });
    }
    const result = body.entity === "program"
      ? await prisma.affiliateProgram.update({ where: { id: body.id }, data: { status: body.status } })
      : await prisma.affiliateLink.update({ where: { id: body.id }, data: { status: body.status } });
    return Response.json({ ok: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Invalid affiliate request." }, { status: 400 });
    return apiError(error);
  }
}
