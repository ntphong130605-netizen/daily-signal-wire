import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { queueSocialPostsForArticle, socialPlatforms } from "@/lib/socialDistribution";

const SocialQueueSchema = z.object({
  postId: z.string().min(1),
  platforms: z
    .array(z.string().min(1))
    .min(1)
    .default(socialPlatforms.map((platform) => platform.platform)),
  scheduledAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = SocialQueueSchema.parse(await request.json().catch(() => ({})));
    const jobs = await queueSocialPostsForArticle({
      articleId: body.postId,
      platforms: body.platforms,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      source: "manual"
    });
    return Response.json({ ok: true, jobs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid social queue request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
