import { after } from "next/server";
import { protectMutation, apiError } from "@/lib/apiSecurity";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { generateDraftForTrend } from "@/lib/generateDraft";
import { tryGenerateImageForPost } from "@/lib/aiImage";

export const maxDuration = 180;

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
    const limited = rateLimit(requestKey(request, "generate-article"), {
      limit: 6,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json(
        { error: "Article generation rate limit reached." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }
    const { id } = await params;
    const post = await generateDraftForTrend(id);
    after(async () => {
      await tryGenerateImageForPost(post.id);
    });
    return Response.json({ ok: true, postId: post.id, imageQueued: true });
  } catch (error) {
    return apiError(error);
  }
}
