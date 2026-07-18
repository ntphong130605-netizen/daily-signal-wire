import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import {
  queueSocialPostsForArticle,
  socialPlatforms,
  socialRecurrences,
  zonedDateTimeToUtc
} from "@/lib/socialDistribution";

const SocialQueueSchema = z.object({
  postId: z.string().min(1),
  platforms: z
    .array(z.string().min(1))
    .min(1)
    .default(socialPlatforms.map((platform) => platform.platform)),
  scheduledAt: z.string().datetime().optional(),
  scheduledLocal: z.string().min(16).max(16).optional(),
  timezone: z.string().min(1).max(80).default("America/New_York"),
  priority: z.number().int().min(1).max(5).default(3),
  recurrence: z.enum(socialRecurrences).default("none"),
  recurrenceEndsAt: z.string().datetime().optional(),
  maxRetries: z.number().int().min(1).max(10).default(3),
  publishImmediately: z.boolean().default(false)
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = SocialQueueSchema.parse(await request.json().catch(() => ({})));
    const scheduledAt = body.scheduledLocal
      ? zonedDateTimeToUtc(body.scheduledLocal, body.timezone)
      : body.scheduledAt
        ? new Date(body.scheduledAt)
        : null;
    const jobs = await queueSocialPostsForArticle({
      articleId: body.postId,
      platforms: body.platforms,
      scheduledAt,
      source: "manual",
      timezone: body.timezone,
      priority: body.priority,
      recurrence: body.recurrence,
      recurrenceEndsAt: body.recurrenceEndsAt ? new Date(body.recurrenceEndsAt) : null,
      maxRetries: body.maxRetries,
      publishImmediately: body.publishImmediately
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
