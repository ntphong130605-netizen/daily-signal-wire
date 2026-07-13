import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { JournalistToneSchema } from "@/lib/aiJournalist";
import { rewritePostSection } from "@/lib/aiJournalistDraft";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";

export const maxDuration = 120;

const RewriteSchema = z.object({
  postId: z.string().min(3),
  section: z.enum(["headline", "lead", "body", "faq", "meta", "summary"]),
  tone: JournalistToneSchema.default("Neutral")
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }
    const limited = rateLimit(requestKey(request, "ai-journalist-rewrite"), {
      limit: 16,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json({ error: "AI rewrite rate limit reached." }, { status: 429 });
    }
    const body = RewriteSchema.parse(await request.json());
    const result = await rewritePostSection({
      postId: body.postId,
      section: body.section,
      toneInput: body.tone
    });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }
    return apiError(error);
  }
}
