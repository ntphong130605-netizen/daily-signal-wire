import { prisma } from "@/lib/prisma";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { generateArticleFromTrend } from "@/lib/aiWriter";
import type { SourceContext } from "@/lib/trends";
import { logError, logInfo } from "@/lib/logger";
import { slugify } from "@/lib/slug";

async function categoryIdFor(name: string) {
  const cleanName = name || "Editorial";
  const slug = slugify(cleanName) || "editorial";
  const category = await prisma.category.upsert({
    where: { slug },
    update: { name: cleanName },
    create: { name: cleanName, slug }
  });
  return category.id;
}

export async function generateDraftForTrend(trendId: string) {
  const locked = await prisma.trend.updateMany({
    where: {
      id: trendId,
      generationStatus: { not: "generating" }
    },
    data: {
      generationStatus: "generating",
      generationError: null
    }
  });
  if (locked.count === 0) {
    throw new Error("This trend is already generating.");
  }

  try {
    const trend = await prisma.trend.findUniqueOrThrow({ where: { id: trendId } });
    const article = await generateArticleFromTrend({
      keyword: trend.keyword,
      relatedQueries: parseStringArray(trend.relatedQueries),
      sources: parseJsonArray<SourceContext>(trend.sourceContext)
    });
    const existing = await prisma.post.findUnique({ where: { trendId } });
    const slug = existing?.slug || `${article.slug}-${trend.id.slice(-6)}`;
    const categoryId = await categoryIdFor(article.category);
    const resetImage = {
      imageStatus: "idle",
      imageError: null,
      imageModel: null,
      imageGeneratedAt: null,
      imageUrl: null,
      featuredImageUrl: null,
      featuredImage: null,
      thumbnailImage: null,
      openGraphImage: null,
      twitterImage: null,
      imageStorage: "url",
      featuredImageData: null,
      thumbnailImageData: null,
      imageAlt: null,
      imageCaption: null,
      imageDisclosure: null,
      imageSourceType: "placeholder",
      imageLicense: null,
      imageCredit: null
    };
    const post = await prisma.post.upsert({
      where: { trendId },
      update: {
        title: article.title,
        subtitle: article.subtitle,
        slug,
        excerpt: article.excerpt,
        summary: article.summary,
        content: article.content,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        openGraphDescription: article.openGraphDescription,
        facebookCaption: article.facebookCaption,
        tags: JSON.stringify(article.tags),
        faq: JSON.stringify(article.faq),
        imagePrompt: article.imagePrompt,
        categoryId,
        aiGenerated: true,
        factCheckNotes: JSON.stringify(article.factCheckNotes),
        sourceUrls: JSON.stringify(article.sourceUrls),
        status: "draft",
        scheduledAt: null,
        rejectedAt: null,
        rejectionReason: null,
        publishedAt: null,
        ...resetImage
      },
      create: {
        trendId,
        title: article.title,
        subtitle: article.subtitle,
        slug,
        excerpt: article.excerpt,
        summary: article.summary,
        content: article.content,
        seoTitle: article.seoTitle,
        seoDescription: article.seoDescription,
        openGraphDescription: article.openGraphDescription,
        facebookCaption: article.facebookCaption,
        tags: JSON.stringify(article.tags),
        faq: JSON.stringify(article.faq),
        imagePrompt: article.imagePrompt,
        categoryId,
        aiGenerated: true,
        factCheckNotes: JSON.stringify(article.factCheckNotes),
        sourceUrls: JSON.stringify(article.sourceUrls),
        status: "draft",
        scheduledAt: null,
        rejectedAt: null,
        rejectionReason: null,
        ...resetImage
      }
    });
    await prisma.trend.update({
      where: { id: trendId },
      data: {
        category: article.category,
        generationStatus: "completed",
        generationError: null,
        generatedAt: new Date()
      }
    });
    logInfo("article_draft_generated", { trendId, postId: post.id });
    return post;
  } catch (error) {
    await prisma.trend
      .update({
        where: { id: trendId },
        data: {
          generationStatus: "failed",
          generationError:
            error instanceof Error ? error.message.slice(0, 1000) : "Unknown error"
        }
      })
      .catch((updateError) =>
        logError("generation_status_update_failed", updateError, { trendId })
      );
    logError("article_draft_generation_failed", error, { trendId });
    throw error;
  }
}
