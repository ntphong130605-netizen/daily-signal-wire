import { z } from "zod";
import { prisma, safeDbQuery } from "@/lib/prisma";

const TokenSchema = z.string().uuid();

function page(message: string, ok: boolean) {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily Signal Wire Newsletter</title><body style="margin:0;background:#f3f7f8;color:#172126;font-family:Inter,system-ui,sans-serif"><main style="max-width:620px;margin:10vh auto;padding:32px;border:1px solid #dce7e9;border-radius:18px;background:white"><p style="color:#168a96;font-weight:800">Daily Signal Wire</p><h1>${ok ? "Subscription updated" : "Unable to update subscription"}</h1><p>${message}</p><a href="/" style="color:#168a96">Return to the newsroom</a></main></body></html>`,
    {
      status: ok ? 200 : 400,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow"
      }
    }
  );
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const parsed = TokenSchema.safeParse(token);
  if (!parsed.success) return page("This unsubscribe link is invalid or incomplete.", false);
  const subscriber = await safeDbQuery("newsletter_unsubscribe_failed", null, () =>
    prisma.newsletterSubscriber.update({
      where: { unsubscribeToken: parsed.data },
      data: { status: "unsubscribed", unsubscribedAt: new Date() }
    })
  );
  return subscriber
    ? page("You will no longer receive Daily Signal Wire newsletter emails.", true)
    : page("This unsubscribe link is no longer available.", false);
}

export const POST = GET;
