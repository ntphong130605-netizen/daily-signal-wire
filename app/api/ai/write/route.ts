import { after } from "next/server";
import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { tryGenerateImageForPost } from "@/lib/aiImage";
import { generateJournalistDraftFromResearch, generateDraftForTrendWithStatus } from "@/lib/aiJournalistDraft";
import { JournalistToneSchema } from "@/lib/aiJournalist";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";

export const maxDuration = 180;

const WriteSchema = z
  .object({
    researchCandidateId: z.string().min(3).optional(),
    trendId: z.string().min(3).optional(),
    tone: JournalistToneSchema.default("Neutral")
  })
  .refine((value) => value.researchCandidateId || value.trendId, {
    message: "researchCandidateId or trendId is required."
  });

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 503 });
    }
    const limited = rateLimit(requestKey(request, "ai-journalist-write"), {
      limit: 6,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json({ error: "AI writer rate limit reached." }, { status: 429 });
    }
    const body = WriteSchema.parse(await request.json());
    const post = body.researchCandidateId
      ? await generateJournalistDraftFromResearch(body.researchCandidateId, body.tone)
      : await generateDraftForTrendWithStatus(body.trendId as string, body.tone);
    after(async () => {
      await tryGenerateImageForPost(post.id);
    });
    return Response.json({
      ok: true,
      postId: post.id,
      postUrl: `/admin/posts/${post.id}`,
      previewUrl: `/news/${post.slug}?preview=1`,
      imageQueued: true
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }
    return apiError(error);
  }
}
