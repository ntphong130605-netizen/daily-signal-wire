import { z } from "zod";
import { prisma, databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";

const HeatmapEventSchema = z.object({
  eventType: z.enum(["click", "scroll", "exit", "ad_visibility"]),
  path: z.string().min(1).max(300),
  articleSlug: z.string().max(180).optional(),
  elementKey: z.string().max(180).optional(),
  xPercent: z.number().min(0).max(100).optional(),
  yPercent: z.number().min(0).max(100).optional(),
  scrollDepth: z.number().int().min(0).max(100).optional(),
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  exitPosition: z.number().int().min(0).max(100).optional(),
  adPosition: z.string().max(80).optional(),
  visitorId: z.string().max(120).optional(),
  sessionId: z.string().max(120).optional(),
  source: z.string().max(160).optional(),
  metadata: z.record(z.unknown()).optional()
});

function deviceFromUserAgent(value: string | null) {
  const ua = value || "";
  if (/mobile|iphone|android/i.test(ua)) return "mobile";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  return "desktop";
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();
  const limited = rateLimit(requestKey(request, "heatmap-event"), {
    limit: 90,
    windowMs: 60_000
  });
  if (!limited.allowed) return Response.json({ error: "Rate limit reached." }, { status: 429 });

  try {
    const body = HeatmapEventSchema.parse(await request.json().catch(() => ({})));
    await prisma.heatmapEvent.create({
      data: {
        ...body,
        country: request.headers.get("x-vercel-ip-country") || undefined,
        device: deviceFromUserAgent(request.headers.get("user-agent")),
        metadata: JSON.stringify(body.metadata || {})
      }
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid event." }, { status: 400 });
    }
    return Response.json({ error: "Heatmap event failed." }, { status: 500 });
  }
}
