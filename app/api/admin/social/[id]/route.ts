import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import {
  cancelSocialPost,
  publishSocialPostNow,
  retrySocialPost
} from "@/lib/socialDistribution";

const SocialActionSchema = z.object({
  action: z.enum(["retry", "publish_now", "cancel"])
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const body = SocialActionSchema.parse(await request.json().catch(() => ({})));
    const job =
      body.action === "retry"
        ? await retrySocialPost(id)
        : body.action === "cancel"
          ? await cancelSocialPost(id)
          : await publishSocialPostNow(id, { manual: true });
    return Response.json({ ok: true, job });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid social action." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
