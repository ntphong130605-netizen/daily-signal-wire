import { apiError, protectMutation } from "@/lib/apiSecurity";
import { systemChecks } from "@/lib/growth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const checks = await systemChecks();
    await Promise.all(
      checks.map((check) =>
        prisma.systemStatusCheck.create({
          data: {
            key: check.key,
            label: check.label,
            status: check.status,
            message: check.message,
            metadata: JSON.stringify({})
          }
        })
      )
    );
    return Response.json({ ok: true, checks });
  } catch (error) {
    return apiError(error);
  }
}
