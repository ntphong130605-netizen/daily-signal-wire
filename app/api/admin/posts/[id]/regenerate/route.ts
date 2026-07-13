import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";
import {
  regenerateArticleField,
  regenerateFullArticleDraft
} from "@/lib/aiWriter";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { runFactCheckForPost } from "@/lib/aiFactChecker";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 }
      );
    }
    const limited = rateLimit(requestKey(request, "regenerate-field"), {
      limit: 12,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json({ error: "Rate limit reached." }, { status: 429 });
    }
    const body = (await request.json()) as {
      field?: "title" | "facebookCaption" | "article";
    };
    if (!body.field || !["title", "facebookCaption", "article"].includes(body.field)) {
      return Response.json({ error: "Unsupported field" }, { status: 400 });
    }
    const { id } = await params;
    const post = await prisma.post.findUniqueOrThrow({
      where: { id },
      include: {
        category: { select: { name: true } },
        trend: { select: { category: true } }
      }
    });
    if (body.field === "article") {
      if (post.status === "published") {
        return Response.json(
          { error: "Published articles cannot be regenerated. Edit a draft instead." },
          { status: 400 }
        );
      }
      const article = await regenerateFullArticleDraft({
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        summary: post.summary,
        content: post.content,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        openGraphDescription: post.openGraphDescription,
        facebookCaption: post.facebookCaption,
        imagePrompt: post.imagePrompt,
        category: post.category?.name || post.trend?.category || null,
        sourceUrls: parseStringArray(post.sourceUrls),
        factCheckNotes: parseStringArray(post.factCheckNotes),
        tags: parseStringArray(post.tags),
        faq: parseJsonArray<{ question: string; answer: string }>(post.faq)
      });
      await prisma.post.update({
        where: { id },
        data: {
          title: article.title,
          subtitle: article.subtitle,
          excerpt: article.excerpt,
          summary: article.summary,
          content: article.content,
          seoTitle: article.seoTitle,
          seoDescription: article.seoDescription,
          openGraphDescription: article.openGraphDescription,
          facebookCaption: article.facebookCaption,
          imagePrompt: article.imagePrompt,
          tags: JSON.stringify(article.tags),
          faq: JSON.stringify(article.faq),
          factCheckNotes: JSON.stringify(article.factCheckNotes),
          sourceUrls: JSON.stringify(article.sourceUrls),
          imageStatus: "idle",
          imageError: null,
          rejectedAt: null,
          rejectionReason: null
        }
      });
      await runFactCheckForPost(id);
      return Response.json({ ok: true, article });
    }
    const value = await regenerateArticleField(body.field, post);
    await prisma.post.update({
      where: { id },
      data: {
        [body.field]: value,
        factCheckStatus: "Needs Review",
        factCheckSummary:
          "A generated field changed after the last verification. Run Fact Check before publishing.",
        verifiedAt: null
      }
    });
    return Response.json({ ok: true, value });
  } catch (error) {
    logError("article_field_regeneration_failed", error);
    return apiError(error);
  }
}
