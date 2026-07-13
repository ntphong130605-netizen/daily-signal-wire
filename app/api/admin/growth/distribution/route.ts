import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { createDistributionJobs } from "@/lib/growth";

const DistributionSchema = z.object({
  postId: z.string().min(1),
  platforms: z.array(z.string().min(1)).min(1),
  mode: z.enum(["manual", "scheduled", "auto"]).default("manual"),
  scheduledAt: z.string().datetime().optional()
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = DistributionSchema.parse(await request.json().catch(() => ({})));
    const jobs = await createDistributionJobs({
      postId: body.postId,
      platforms: body.platforms,
      mode: body.mode,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null
    });
    return Response.json({ ok: true, jobs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid distribution request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
