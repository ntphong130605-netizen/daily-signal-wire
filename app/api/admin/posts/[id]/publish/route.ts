import { apiError, protectMutation } from "@/lib/apiSecurity";
import { publishPostNow } from "@/lib/publishing";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      confirmedFactCheck?: boolean;
    };
    const result = await publishPostNow({
      postId: id,
      actor: "Admin",
      source: "manual",
      confirmedFactCheck: Boolean(body.confirmedFactCheck),
      approvalOverride: Boolean(body.confirmedFactCheck)
    });
    return Response.json({
      ok: true,
      status: result.post.status,
      publishedAt: result.post.publishedAt
    });
  } catch (error) {
    return apiError(error);
  }
}
