import { z } from "zod";
import { databaseUnavailableResponse, isDatabaseConfigured, prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";

const NewsletterSchema = z.object({
  email: z.string().trim().email().max(254)
});

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return databaseUnavailableResponse();
  }

  const limited = rateLimit(requestKey(request, "newsletter"), {
    limit: 5,
    windowMs: 60 * 60_000
  });
  if (!limited.allowed) {
    return Response.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  try {
    const { email } = NewsletterSchema.parse(await request.json());
    await prisma.newsletterSubscriber.upsert({
      where: { email: email.toLowerCase() },
      update: { status: "active" },
      create: { email: email.toLowerCase() }
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }
    logError("newsletter_signup_failed", error);
    return Response.json({ error: "Unable to subscribe right now." }, { status: 500 });
  }
}
