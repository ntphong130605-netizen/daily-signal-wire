import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";
import { validatePostForPublishing } from "@/lib/publishGuard";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const post = await prisma.post.findUniqueOrThrow({
      where: { id },
      include: {
        category: { select: { name: true } },
        trend: { select: { category: true } }
      }
    });
    const body = (await request.json().catch(() => ({}))) as {
      confirmedFactCheck?: boolean;
    };
    const error = validatePostForPublishing(post, Boolean(body.confirmedFactCheck));
    if (error) return Response.json({ error }, { status: 400 });
    await prisma.post.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        scheduledAt: null,
        rejectedAt: null,
        rejectionReason: null
      }
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
