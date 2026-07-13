import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { setFactCheckDecision } from "@/lib/aiFactChecker";
import { prisma } from "@/lib/prisma";

const VerifySchema = z.object({
  postId: z.string().min(3),
  action: z.enum(["approve", "reject", "needs_review", "low_confidence"])
});

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = VerifySchema.parse(await request.json());
    const post = await setFactCheckDecision(body);

    if (body.action === "reject") {
      await prisma.post.update({
        where: { id: body.postId },
        data: {
          status: "rejected",
          rejectedAt: new Date(),
          rejectionReason:
            "Rejected by fact-check workflow. Resolve unsupported or conflicting claims before publication.",
          scheduledAt: null,
          publishedAt: null
        }
      });
    }

    return Response.json({
      ok: true,
      factCheckStatus: post.factCheckStatus,
      trustScore: post.trustScore,
      verifiedAt: post.verifiedAt
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message || "Invalid request" }, { status: 400 });
    }
    return apiError(error);
  }
}
