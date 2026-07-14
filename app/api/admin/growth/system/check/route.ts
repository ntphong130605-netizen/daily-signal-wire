import { apiError, protectMutation } from "@/lib/apiSecurity";
import { recordProductionReadinessSnapshot } from "@/lib/opsReadiness";

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const report = await recordProductionReadinessSnapshot();
    return Response.json({ ok: true, checks: report.checks, healthScore: report.healthScore });
  } catch (error) {
    return apiError(error);
  }
}
