import { prisma, safeDbQuery } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";

function deviceFromUserAgent(value: string | null) {
  const ua = value || "";
  if (/mobile|iphone|android/i.test(ua)) return "mobile";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  return "desktop";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(requestKey(request, "affiliate-click"), {
    limit: 30,
    windowMs: 60_000
  });
  if (!limited.allowed) return Response.json({ error: "Rate limit reached." }, { status: 429 });
  const { id } = await params;
  const url = new URL(request.url);
  const link = await safeDbQuery("affiliate_link_lookup_failed", null, () =>
    prisma.affiliateLink.findFirst({
      where: { id, status: "active", program: { status: "active" } },
      select: { id: true, trackingUrl: true, category: true }
    })
  );
  if (!link) return Response.json({ error: "Affiliate link not found." }, { status: 404 });

  await safeDbQuery("affiliate_click_record_failed", null, () =>
    prisma.$transaction([
      prisma.affiliateClick.create({
        data: {
          linkId: link.id,
          articleSlug: url.searchParams.get("article")?.slice(0, 180) || undefined,
          category: url.searchParams.get("category")?.slice(0, 100) || link.category || undefined,
          country: request.headers.get("x-vercel-ip-country") || undefined,
          device: deviceFromUserAgent(request.headers.get("user-agent")),
          source: url.searchParams.get("source")?.slice(0, 100) || undefined,
          referrer: request.headers.get("referer") || undefined
        }
      }),
      prisma.affiliateLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } })
    ])
  );
  return Response.redirect(link.trackingUrl, 302);
}
