import { prisma } from "@/lib/prisma";
import { protectMutation, apiError } from "@/lib/apiSecurity";
import { generateArticleFromTrend } from "@/lib/aiWriter";
import { tryGenerateImageForPost } from "@/lib/aiImage";
import { slugify } from "@/lib/slug";
import { logError, logInfo } from "@/lib/logger";

async function uniquePostSlug(base: string, existingId?: string) {
  const root = slugify(base) || "rss-story-draft";
  let candidate = root;
  let index = 2;
  while (true) {
    const existing = await prisma.post.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === existingId) return candidate;
    candidate = `${root}-${index}`;
    index += 1;
  }
}

async function categoryIdFor(name: string) {
  const slug = slugify(name || "RSS");
  const category = await prisma.category.upsert({
    where: { slug },
    update: { name },
    create: { name, slug }
  });
  return category.id;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured. Configure it before creating AI drafts." },
        { status: 503 }
      );
    }

    const { id } = await params;
    const story = await prisma.feedStory.findUniqueOrThrow({
      where: { id },
      include: {
        feed: {
          include: { category: true }
        }
      }
    });

    const article = await generateArticleFromTrend({
      keyword: story.title,
      relatedQueries: [
        story.feed.title,
        story.feed.category?.name || "RSS source",
        "source-based rewrite"
      ],
      sources: [
        {
          title: story.title,
          source: story.feed.title,
          url: story.sourceUrl,
          snippet:
            story.excerpt ||
            "RSS metadata only. The editor must inspect the original source before publishing."
        }
      ]
    });

    const existing = await prisma.post.findFirst({
      where: { sourceStoryId: story.id },
      select: { id: true, slug: true }
    });
    const slug = await uniquePostSlug(article.slug || article.title, existing?.id);
    const categoryId = await categoryIdFor(article.category || story.feed.category?.name || "RSS");
    const post = existing
      ? await prisma.post.update({
          where: { id: existing.id },
          data: {
            title: article.title,
            slug,
            excerpt: article.excerpt,
            content: article.content,
            seoTitle: article.seoTitle,
            seoDescription: article.seoDescription,
            facebookCaption: article.facebookCaption,
            imagePrompt: article.imagePrompt,
            categoryId,
            aiGenerated: true,
            factCheckNotes: JSON.stringify([
              ...article.factCheckNotes,
              "Converted from an RSS story. Verify the original source before publishing.",
              "Fact-check before publishing."
            ]),
            sourceUrls: JSON.stringify(article.sourceUrls),
            status: "draft",
            publishedAt: null
          }
        })
      : await prisma.post.create({
          data: {
            sourceStoryId: story.id,
            title: article.title,
            slug,
            excerpt: article.excerpt,
            content: article.content,
            seoTitle: article.seoTitle,
            seoDescription: article.seoDescription,
            facebookCaption: article.facebookCaption,
            imagePrompt: article.imagePrompt,
            categoryId,
            aiGenerated: true,
            factCheckNotes: JSON.stringify([
              ...article.factCheckNotes,
              "Converted from an RSS story. Verify the original source before publishing.",
              "Fact-check before publishing."
            ]),
            sourceUrls: JSON.stringify(article.sourceUrls),
            status: "draft"
          }
        });

    logInfo("rss_story_converted_to_draft", { storyId: story.id, postId: post.id });
    await tryGenerateImageForPost(post.id);
    return Response.json({ postId: post.id, slug: post.slug });
  } catch (error) {
    logError("rss_story_convert_failed", error);
    return apiError(error);
  }
}
