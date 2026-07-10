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
    if (!post.seoTitle.trim() || !post.seoDescription.trim()) {
      return Response.json(
        { error: "SEO title and meta description are required." },
        { status: 400 }
      );
    }
    const wordCount = post.content.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 500 || wordCount > 900) {
      return Response.json(
        { error: "AI news articles must be between 500 and 900 words before publishing." },
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
    if (!post.imageAlt?.trim()) {
      return Response.json(
        { error: "Image alt text is required before publishing." },
        { status: 400 }
      );
    }
    if (post.imageSourceType === "ai" && !post.imageDisclosure?.trim()) {
      return Response.json(
        { error: "AI image disclosure is required before publishing." },
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
