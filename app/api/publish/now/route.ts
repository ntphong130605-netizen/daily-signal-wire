import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { publishPostNow } from "@/lib/publishing";

const PublishNowSchema = z.object({
  postId: z.string().min(1),
  confirmedFactCheck: z.boolean().optional(),
  approvalOverride: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = PublishNowSchema.parse(await request.json().catch(() => ({})));
    const result = await publishPostNow({
      postId: body.postId,
      actor: "Admin",
      source: "api",
      confirmedFactCheck: body.confirmedFactCheck ?? true,
      approvalOverride: body.approvalOverride ?? true
    });
    return Response.json({
      ok: true,
      status: result.post.status,
      publishedAt: result.post.publishedAt,
      readiness: result.readiness
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid publish request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
