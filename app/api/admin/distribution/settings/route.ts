import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { setSocialQueuePaused, socialQueuePaused } from "@/lib/socialDistribution";

const QueueSettingsSchema = z.object({
  action: z.enum(["pause", "resume"])
});

export async function GET() {
  try {
    const { requireAdmin } = await import("@/lib/auth");
    await requireAdmin();
    return Response.json({ ok: true, paused: await socialQueuePaused() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = QueueSettingsSchema.parse(await request.json().catch(() => ({})));
    const paused = await setSocialQueuePaused(body.action === "pause");
    return Response.json({ ok: true, paused });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid queue action." }, { status: 400 });
    }
    return apiError(error);
  }
}
