import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";

const DateValue = z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const AdRow = z.object({
  date: DateValue,
  slotKey: z.string().max(120).optional(),
  position: z.string().max(80).optional(),
  articleSlug: z.string().max(180).optional(),
  category: z.string().max(100).optional(),
  country: z.string().max(80).optional(),
  device: z.string().max(40).optional(),
  trafficSource: z.string().max(120).optional(),
  impressions: z.number().int().min(0).default(0),
  viewableImpressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  pageViews: z.number().int().min(0).default(0),
  estimatedRevenue: z.number().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  metadata: z.record(z.unknown()).optional()
});
const NewsletterRow = z.object({
  date: DateValue,
  campaignId: z.string().min(1).max(160),
  sends: z.number().int().min(0).default(0),
  delivered: z.number().int().min(0).default(0),
  opens: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  affiliateClicks: z.number().int().min(0).default(0),
  revenue: z.number().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  metadata: z.record(z.unknown()).optional()
});
const ConversionRow = z.object({
  linkId: z.string().min(1),
  network: z.string().min(1).max(60),
  orderReference: z.string().max(160).optional(),
  amount: z.number().min(0).optional(),
  commission: z.number().min(0),
  currency: z.string().length(3).default("USD"),
  occurredAt: DateValue,
  metadata: z.record(z.unknown()).optional()
});

const ImportSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("adsense"), source: z.string().max(80).default("adsense_import"), rows: z.array(AdRow).min(1).max(5000) }),
  z.object({ kind: z.literal("newsletter"), source: z.string().max(80).default("resend_import"), rows: z.array(NewsletterRow).min(1).max(1000) }),
  z.object({ kind: z.literal("affiliate_conversion"), source: z.string().max(80).default("api_import"), rows: z.array(ConversionRow).min(1).max(1000) })
]);

function day(value: string) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = ImportSchema.parse(await request.json().catch(() => ({})));
    if (body.kind === "adsense") {
      const dates = [...new Set(body.rows.map((row) => day(row.date).toISOString()))].map((value) => new Date(value));
      await prisma.$transaction([
        prisma.adPerformanceMetric.deleteMany({ where: { source: body.source, date: { in: dates } } }),
        prisma.adPerformanceMetric.createMany({
          data: body.rows.map((row) => ({
            ...row,
            date: day(row.date),
            source: body.source,
            currency: row.currency.toUpperCase(),
            metadata: JSON.stringify(row.metadata || {})
          }))
        })
      ]);
      return Response.json({ ok: true, imported: body.rows.length, kind: body.kind });
    }
    if (body.kind === "newsletter") {
      await prisma.$transaction(
        body.rows.map((row) =>
          prisma.newsletterMetric.upsert({
            where: { date_campaignId_source: { date: day(row.date), campaignId: row.campaignId, source: body.source } },
            update: { ...row, date: day(row.date), source: body.source, currency: row.currency.toUpperCase(), metadata: JSON.stringify(row.metadata || {}) },
            create: { ...row, date: day(row.date), source: body.source, currency: row.currency.toUpperCase(), metadata: JSON.stringify(row.metadata || {}) }
          })
        )
      );
      return Response.json({ ok: true, imported: body.rows.length, kind: body.kind });
    }

    await prisma.$transaction(async (tx) => {
      for (const row of body.rows) {
        await tx.affiliateConversion.create({
          data: { ...row, occurredAt: new Date(row.occurredAt), source: body.source, currency: row.currency.toUpperCase(), metadata: JSON.stringify(row.metadata || {}) }
        });
        await tx.affiliateLink.update({
          where: { id: row.linkId },
          data: { conversions: { increment: 1 }, revenue: { increment: row.commission } }
        });
      }
    });
    return Response.json({ ok: true, imported: body.rows.length, kind: body.kind });
  } catch (error) {
    if (error instanceof z.ZodError) return Response.json({ error: error.issues[0]?.message || "Invalid import." }, { status: 400 });
    return apiError(error);
  }
}
