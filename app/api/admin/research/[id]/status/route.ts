import { apiError, protectMutation } from "@/lib/apiSecurity";
import { databaseUnavailableResponse, isDatabaseConfigured, prisma } from "@/lib/prisma";

const allowed = new Set(["new", "monitoring", "ignored", "blocked", "sent_to_pipeline"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();
    const body = (await request.json().catch(() => ({}))) as { status?: string };
    const status = String(body.status || "");
    if (!allowed.has(status)) {
      return Response.json({ error: "Invalid research status." }, { status: 400 });
    }
    const { id } = await params;
    const candidate = await prisma.researchCandidate.update({
      where: { id },
      data: {
        status,
        recommendedAction:
          status === "blocked"
            ? "blocked"
            : status === "ignored"
              ? "ignore"
              : status === "monitoring"
                ? "monitor"
                : undefined
      }
    });
    return Response.json({ ok: true, candidate });
  } catch (error) {
    return apiError(error);
  }
}
