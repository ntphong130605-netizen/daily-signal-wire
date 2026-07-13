import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { analyzeDiscoverForPost } from "@/lib/growth";

const DiscoverAnalyzeSchema = z.object({
  postId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = DiscoverAnalyzeSchema.parse(await request.json().catch(() => ({})));
    const audit = await analyzeDiscoverForPost(body.postId);
    return Response.json({ ok: true, audit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid Discover analyze request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
