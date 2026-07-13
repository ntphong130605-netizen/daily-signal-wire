import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { analyzeSeoForPost } from "@/lib/growth";

const SeoAnalyzeSchema = z.object({
  postId: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = SeoAnalyzeSchema.parse(await request.json().catch(() => ({})));
    const audit = await analyzeSeoForPost(body.postId);
    return Response.json({ ok: true, audit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid SEO analyze request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
