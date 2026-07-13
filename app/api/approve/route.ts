import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { approvePost } from "@/lib/publishing";

const ApproveSchema = z.object({
  postId: z.string().min(1),
  note: z.string().max(1000).optional(),
  confirmedFactCheck: z.boolean().optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = ApproveSchema.parse(await request.json().catch(() => ({})));
    const result = await approvePost({
      postId: body.postId,
      actor: "Admin",
      note: body.note,
      confirmedFactCheck: body.confirmedFactCheck ?? true
    });
    return Response.json({
      ok: true,
      status: result.post.status,
      approvedAt: result.post.approvedAt,
      readiness: result.readiness
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid approval request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
