import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { rejectPost } from "@/lib/publishing";

const RejectSchema = z.object({
  postId: z.string().min(1),
  reason: z.string().max(1000).optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = RejectSchema.parse(await request.json().catch(() => ({})));
    const post = await rejectPost({
      postId: body.postId,
      actor: "Admin",
      reason: body.reason
    });
    return Response.json({ ok: true, status: post.status });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid rejection request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
