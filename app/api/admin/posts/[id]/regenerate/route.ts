import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";
import { regenerateArticleField } from "@/lib/aiWriter";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 }
      );
    }
    const limited = rateLimit(requestKey(request, "regenerate-field"), {
      limit: 12,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json({ error: "Rate limit reached." }, { status: 429 });
    }
    const body = (await request.json()) as {
      field?: "title" | "facebookCaption";
    };
    if (!body.field || !["title", "facebookCaption"].includes(body.field)) {
      return Response.json({ error: "Unsupported field" }, { status: 400 });
    }
    const { id } = await params;
    const post = await prisma.post.findUniqueOrThrow({ where: { id } });
    const value = await regenerateArticleField(body.field, post);
    await prisma.post.update({
      where: { id },
      data: { [body.field]: value }
    });
    return Response.json({ ok: true, value });
  } catch (error) {
    logError("article_field_regeneration_failed", error);
    return apiError(error);
  }
}
