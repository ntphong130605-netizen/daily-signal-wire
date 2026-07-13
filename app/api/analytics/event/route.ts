import { z } from "zod";
import { prisma, isDatabaseConfigured, databaseUnavailableResponse } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";

const AnalyticsEventSchema = z.object({
  eventName: z.string().min(2).max(80),
  path: z.string().max(300).optional(),
  articleSlug: z.string().max(160).optional(),
  category: z.string().max(100).optional(),
  visitorId: z.string().max(120).optional(),
  sessionId: z.string().max(120).optional(),
  source: z.string().max(100).optional(),
  durationSeconds: z.number().int().min(0).max(86_400).optional(),
  scrollDepth: z.number().int().min(0).max(100).optional(),
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
  const limited = rateLimit(requestKey(request, "analytics-event"), {
    limit: 60,
    windowMs: 60_000
  });
  if (!limited.allowed) {
    return Response.json({ error: "Analytics rate limit reached." }, { status: 429 });
  }

  try {
    const body = AnalyticsEventSchema.parse(await request.json().catch(() => ({})));
    const referrer = request.headers.get("referer") || undefined;
    await prisma.analyticsEvent.create({
      data: {
        eventName: body.eventName,
        path: body.path,
        articleSlug: body.articleSlug,
        category: body.category,
        visitorId: body.visitorId,
        sessionId: body.sessionId,
        country: request.headers.get("x-vercel-ip-country") || undefined,
        device: deviceFromUserAgent(request.headers.get("user-agent")),
        source: body.source,
        referrer,
        durationSeconds: body.durationSeconds,
        scrollDepth: body.scrollDepth,
        metadata: JSON.stringify(body.metadata || {})
      }
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid analytics event." },
        { status: 400 }
      );
    }
    return Response.json({ error: "Analytics event failed." }, { status: 500 });
  }
}
