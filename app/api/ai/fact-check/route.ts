import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { JournalistToneSchema } from "@/lib/aiJournalist";
import { rewritePostSection } from "@/lib/aiJournalistDraft";
import { runFactCheckForPost } from "@/lib/aiFactChecker";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { notifyEditor } from "@/lib/publishing";
import { rateLimit, requestKey } from "@/lib/rateLimit";

export const maxDuration = 180;

const FactCheckSchema = z.object({
  postId: z.string().min(3),
  action: z.enum(["run", "regenerate_failed_sections"]).default("run"),
  tone: JournalistToneSchema.default("Neutral")
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();
    const limited = rateLimit(requestKey(request, "ai-fact-check"), {
      limit: 20,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json({ error: "Fact-check rate limit reached." }, { status: 429 });
    }

    const body = FactCheckSchema.parse(await request.json());
    if (body.action === "regenerate_failed_sections") {
      if (!process.env.OPENAI_API_KEY) {
        return Response.json(
          { error: "OPENAI_API_KEY is required to regenerate failed sections." },
          { status: 503 }
        );
      }
      await rewritePostSection({
        postId: body.postId,
        section: "body",
        toneInput: body.tone
      });
    }

    const result = await runFactCheckForPost(body.postId);
    if (result.status !== "Verified") {
      await notifyEditor({
        postId: body.postId,
        type: "fact_check_failed",
        title: "Fact check needs review",
        message:
          result.summary ||
          "The AI Fact Checker flagged this article before publication.",
        severity: result.status === "Low Confidence" ? "error" : "warning",
        metadata: {
          status: result.status,
          trustScore: result.trustScore,
          warnings: result.warnings
        }
      });
    }
    return Response.json({ ok: true, result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }
    return apiError(error);
  }
}
