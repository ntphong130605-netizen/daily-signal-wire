import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";
import { parseStringArray } from "@/lib/json";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const post = await prisma.post.findUniqueOrThrow({ where: { id } });
    const body = (await request.json().catch(() => ({}))) as {
      confirmedFactCheck?: boolean;
    };
    const sources = parseStringArray(post.sourceUrls);
    const notes = parseStringArray(post.factCheckNotes);
    if (!body.confirmedFactCheck) {
      return Response.json(
        { error: "Fact-check confirmation is required." },
        { status: 400 }
      );
    }
    if (sources.length === 0 || notes.length === 0) {
      return Response.json(
        { error: "Sources and fact-check notes are required." },
        { status: 400 }
      );
    }
    if (
      post.aiGenerated &&
      (!post.imageStatus ||
        post.imageStatus !== "accepted" ||
        (!post.imageUrl && !post.featuredImage && !post.featuredImageUrl))
    ) {
      return Response.json(
        { error: "Accept an editorial image before publishing this AI draft." },
        { status: 400 }
      );
    }
    await prisma.post.update({
      where: { id },
      data: { status: "published", publishedAt: new Date() }
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
