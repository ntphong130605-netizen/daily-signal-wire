import { Prisma } from "@prisma/client";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { logError, logInfo } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { runFactCheckForPost } from "@/lib/aiFactChecker";
import { notifyEditor, recordStatusEvent } from "@/lib/publishing";
import type { SourceContext } from "@/lib/trends";
import {
  AI_JOURNALIST_PROMPT_VERSION,
  generateJournalistArticle,
  rewriteJournalistSection,
  JournalistToneSchema,
  type JournalistGenerationResult,
  type JournalistSection,
  type JournalistTone
} from "@/lib/aiJournalist";

type StoredInternalLink = {
  title: string;
  url: string;
  reason: string;
};

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

export async function categoryIdFor(name: string) {
  const cleanName = name || "Editorial";
  const slug = slugify(cleanName) || "editorial";
  const category = await prisma.category.upsert({
    where: { slug },
    update: { name: cleanName },
    create: { name: cleanName, slug }
  });
  return category.id;
}

async function uniquePostSlug(base: string, currentPostId?: string) {
  const cleanBase = slugify(base) || "daily-signal-wire-story";
  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? cleanBase : `${cleanBase}-${index + 1}`;
    const existing = await prisma.post.findUnique({
      where: { slug: candidate },
      select: { id: true }
    });
    if (!existing || existing.id === currentPostId) return candidate;
  }
  return `${cleanBase}-${Date.now().toString(36)}`;
}

function resetImageFields() {
  return {
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
    imageSourceType: "placeholder",
    imageLicense: null,
    imageCredit: null
  };
}

async function internalLinkCandidates(category?: string | null) {
  const posts = await prisma.post.findMany({
    where: {
      status: "published",
      ...(category
        ? {
            OR: [
              { category: { name: { contains: category } } },
              { trend: { category: { contains: category } } }
            ]
          }
        : {})
    },
    include: { category: { select: { name: true } }, trend: { select: { category: true } } },
    orderBy: { publishedAt: "desc" },
    take: 12
  });
  return posts.map((post) => ({
    title: post.title,
    url: `/news/${post.slug}`,
    category: post.category?.name || post.trend?.category
  }));
}

function sourceUrlFromContext(source: SourceContext) {
  return source.url;
}

function articleData(result: JournalistGenerationResult, version: number, tone: JournalistTone) {
  const { article, content, metadata, tokenUsage, generationTimeMs } = result;
  const tags = Array.from(new Set([...article.tags, ...article.keywords])).slice(0, 12);
  return {
    title: article.headline,
    subtitle: article.deck,
    excerpt: article.excerpt,
    summary: article.summary,
    content,
    seoTitle: article.seoTitle,
    seoDescription: article.metaDescription,
    openGraphDescription: article.openGraphDescription,
    facebookCaption:
      article.twitterDescription || `${article.headline}\n\n${article.excerpt}`,
    ...resetImageFields(),
    authorName: article.author || "Daily Signal Wire Desk",
    readingTimeMinutes: article.readingTimeMinutes || Math.max(1, Math.ceil(wordCount(content) / 220)),
    keyTakeaways: json(article.keyTakeaways),
    timeline: json(article.timeline),
    relatedTopics: json(article.relatedTopics),
    internalLinkSuggestions: json(article.internalLinkSuggestions),
    draftVersion: version,
    journalistTone: tone,
    generationMetadata: json(metadata),
    tokenUsage: json(tokenUsage),
    generationTimeMs,
    promptVersion: AI_JOURNALIST_PROMPT_VERSION,
    tags: json(tags),
    faq: json(article.faq),
    imagePrompt: article.imagePrompt,
    imageAlt: `${article.headline} — editorial image`,
    imageCaption: article.heroCaption,
    imageDisclosure: "AI-generated editorial illustration",
    aiGenerated: true,
    factCheckNotes: json(article.factCheckNotes),
    sourceUrls: json(article.sourceUrls),
    status: "draft",
    scheduledAt: null,
    publishAt: null,
    timezone: null,
    approvalStatus: "pending",
    approvedAt: null,
    approvedBy: null,
    publishingStartedAt: null,
    publishError: null,
    schedulerMetadata: json({}),
    rejectedAt: null,
    rejectionReason: null,
    publishedAt: null,
  };
}

async function createRevision({
  postId,
  version,
  changeType,
  section,
  tone,
  article,
  content,
  metadata,
  tokenUsage,
  generationTimeMs
}: {
  postId: string;
  version: number;
  changeType: string;
  section?: string;
  tone: string;
  article: {
    headline?: string;
    deck?: string;
    excerpt?: string;
    summary?: string;
    seoTitle?: string;
    metaDescription?: string;
    openGraphDescription?: string;
    facebookCaption?: string;
    tags?: string[];
    faq?: unknown[];
    keyTakeaways?: string[];
    timeline?: string[];
    relatedTopics?: string[];
    internalLinkSuggestions?: StoredInternalLink[];
    factCheckNotes?: string[];
    sourceUrls?: string[];
  };
  content?: string;
  metadata: unknown;
  tokenUsage: unknown;
  generationTimeMs?: number;
}) {
  await prisma.postRevision.create({
    data: {
      postId,
      version,
      changeType,
      section,
      tone,
      title: article.headline,
      subtitle: article.deck,
      excerpt: article.excerpt,
      summary: article.summary,
      content,
      seoTitle: article.seoTitle,
      seoDescription: article.metaDescription,
      openGraphDescription: article.openGraphDescription,
      facebookCaption: article.facebookCaption,
      tags: json(article.tags || []),
      faq: json(article.faq || []),
      keyTakeaways: json(article.keyTakeaways || []),
      timeline: json(article.timeline || []),
      relatedTopics: json(article.relatedTopics || []),
      internalLinkSuggestions: json(article.internalLinkSuggestions || []),
      factCheckNotes: json(article.factCheckNotes || []),
      sourceUrls: json(article.sourceUrls || []),
      generationMetadata: json(metadata),
      tokenUsage: json(tokenUsage),
      generationTimeMs,
      promptVersion: AI_JOURNALIST_PROMPT_VERSION
    }
  });
}

async function runDraftFactCheck(postId: string, context: Record<string, unknown>) {
  try {
    await runFactCheckForPost(postId);
  } catch (error) {
    logError("ai_fact_check_after_draft_failed", error, { postId, ...context });
    await prisma.post
      .update({
        where: { id: postId },
        data: {
          factCheckStatus: "Low Confidence",
          factCheckSummary:
            "Automated fact-checking failed. Run Fact Check manually before publication.",
          verificationMetadata: json({
            promptVersion: "ai-fact-checker-v1.0",
            generatedAt: new Date().toISOString(),
            method: "failed_after_draft_generation"
          }),
          verifiedAt: new Date()
        }
      })
      .catch((updateError) =>
        logError("ai_fact_check_failure_status_update_failed", updateError, { postId })
      );
  }
}

export async function generateJournalistDraftFromTrend(
  trendId: string,
  toneInput: JournalistTone = "Neutral"
) {
  const tone = JournalistToneSchema.parse(toneInput);
  const trend = await prisma.trend.findUniqueOrThrow({ where: { id: trendId } });
  const sources = parseJsonArray<SourceContext>(trend.sourceContext);
  if (!sources.length) {
    throw new Error("No verifiable source packet is available for this trend.");
  }
  const sourceUrls = sources.map(sourceUrlFromContext);
  const internalLinks = await internalLinkCandidates(trend.category);
  const result = await generateJournalistArticle(
    {
      topic: trend.keyword,
      category: trend.category || "US News",
      relatedQueries: parseStringArray(trend.relatedQueries),
      keywords: [trend.keyword, ...(trend.category ? [trend.category] : [])],
      entities: [],
      trendScore: undefined,
      sourceUrls,
      sourcePacket: sources.map((source) => ({
        headline: source.title,
        summary: source.snippet,
        publisher: source.source,
        url: source.url,
        credibilityTier: null,
        publishedAt: null
      })),
      internalLinks
    },
    tone
  );
  const existing = await prisma.post.findUnique({ where: { trendId } });
  const version = existing ? existing.draftVersion + 1 : 1;
  const categoryId = await categoryIdFor(result.article.category);
  const slug = existing?.slug || (await uniquePostSlug(`${result.article.slug}-${trend.id.slice(-6)}`));
  const data = articleData(result, version, tone);
  const post = await prisma.post.upsert({
    where: { trendId },
    update: {
      ...data,
      slug,
      category: { connect: { id: categoryId } }
    },
    create: {
      ...data,
      trend: { connect: { id: trendId } },
      slug,
      category: { connect: { id: categoryId } }
    }
  });
  await createRevision({
    postId: post.id,
    version,
    changeType: existing ? "regenerate_article" : "generate_article",
    tone,
    article: {
      ...result.article,
      metaDescription: result.article.metaDescription,
      facebookCaption: data.facebookCaption as string
    },
    content: result.content,
    metadata: result.metadata,
    tokenUsage: result.tokenUsage,
    generationTimeMs: result.generationTimeMs
  });
  await runDraftFactCheck(post.id, {
    trendId,
    version,
    source: "trend"
  });
  await recordStatusEvent({
    postId: post.id,
    fromStatus: existing?.status || null,
    toStatus: post.status,
    action: existing ? "regenerate_draft" : "draft_ready",
    actor: "AI Writer",
    metadata: { trendId, version, source: "trend" }
  }).catch((error) =>
    logError("draft_status_event_failed", error, { postId: post.id, trendId })
  );
  await notifyEditor({
    postId: post.id,
    type: "draft_ready",
    title: "AI draft ready",
    message: `"${post.title}" is ready for editor review.`,
    severity: "success",
    metadata: { trendId, version, source: "trend" }
  }).catch((error) =>
    logError("draft_ready_notification_failed", error, { postId: post.id, trendId })
  );
  return post;
}

export async function generateJournalistDraftFromResearch(
  researchCandidateId: string,
  toneInput: JournalistTone = "Neutral"
) {
  const tone = JournalistToneSchema.parse(toneInput);
  const candidate = await prisma.researchCandidate.findUnique({
    where: { id: researchCandidateId },
    include: { brief: true, sources: { orderBy: [{ credibilityTier: "asc" }, { publishedAt: "desc" }] } }
  });
  if (!candidate) throw new Error("Research candidate not found.");
  if (candidate.riskLevel === "blocked" || candidate.recommendedAction === "blocked") {
    throw new Error("Blocked research candidates cannot be turned into drafts.");
  }
  if (!candidate.sources.length) {
    throw new Error("No source URLs are attached to this research candidate.");
  }

  const sourceUrls = candidate.sources.map((source) => source.canonicalUrl || source.sourceUrl);
  const relatedQueries = parseStringArray(candidate.brief?.relatedQueries);
  const keywords = parseStringArray(candidate.brief?.suggestedKeywords);
  const entities = parseStringArray(candidate.brief?.keyEntities);
  const internalLinks = await internalLinkCandidates(candidate.category);
  const result = await generateJournalistArticle(
    {
      topic: candidate.topic,
      category: candidate.category,
      trendScore: candidate.trendScore,
      relatedQueries,
      keywords,
      entities,
      sourceUrls,
      sourcePacket: candidate.sources.map((source) => ({
        headline: source.headline,
        summary: source.summary,
        publisher: source.publisher || source.source,
        url: source.canonicalUrl || source.sourceUrl,
        credibilityTier: source.credibilityTier,
        publishedAt: source.publishedAt?.toISOString() || null
      })),
      researchBrief: candidate.brief
        ? {
            whyTrending: candidate.brief.whyTrending,
            readerValue: candidate.brief.readerValue,
            verifiedFacts: parseStringArray(candidate.brief.verifiedFacts),
            uncertainClaims: parseStringArray(candidate.brief.uncertainClaims),
            timeline: parseStringArray(candidate.brief.timeline),
            suggestedAngles: parseStringArray(candidate.brief.suggestedAngles),
            factCheckNotes: parseStringArray(candidate.brief.factCheckNotes),
            riskLevel: candidate.brief.riskLevel,
            recommendedAction: candidate.brief.recommendedAction,
            scoreBreakdown: (() => {
              try {
                return JSON.parse(candidate.brief?.scoreBreakdown || "{}") as Record<string, unknown>;
              } catch {
                return {};
              }
            })()
          }
        : undefined,
      internalLinks
    },
    tone
  );

  const existing = await prisma.post.findFirst({
    where: { researchCandidateId },
    select: { id: true, slug: true, draftVersion: true }
  });
  const version = existing ? existing.draftVersion + 1 : 1;
  const categoryId = await categoryIdFor(result.article.category || candidate.category);
  const slug = existing?.slug || (await uniquePostSlug(`${result.article.slug}-${candidate.id.slice(-6)}`));
  const data = articleData(result, version, tone);
  const post = existing
    ? await prisma.post.update({
        where: { id: existing.id },
        data: {
          ...data,
          slug,
          category: { connect: { id: categoryId } },
          researchCandidateId
        }
      })
    : await prisma.post.create({
        data: {
          ...data,
          slug,
          category: { connect: { id: categoryId } },
          researchCandidateId
        }
      });

  await prisma.researchCandidate.update({
    where: { id: researchCandidateId },
    data: {
      status: "sent_to_pipeline",
      recommendedAction: "generate_draft"
    }
  });

  await createRevision({
    postId: post.id,
    version,
    changeType: existing ? "regenerate_article" : "generate_article",
    tone,
    article: {
      ...result.article,
      metaDescription: result.article.metaDescription,
      facebookCaption: data.facebookCaption as string
    },
    content: result.content,
    metadata: result.metadata,
    tokenUsage: result.tokenUsage,
    generationTimeMs: result.generationTimeMs
  });
  await runDraftFactCheck(post.id, {
    researchCandidateId,
    version,
    source: "research"
  });
  await recordStatusEvent({
    postId: post.id,
    fromStatus: existing ? "draft" : null,
    toStatus: post.status,
    action: existing ? "regenerate_draft" : "draft_ready",
    actor: "AI Writer",
    metadata: { researchCandidateId, version, source: "research" }
  }).catch((error) =>
    logError("draft_status_event_failed", error, { postId: post.id, researchCandidateId })
  );
  await notifyEditor({
    postId: post.id,
    type: "draft_ready",
    title: "AI draft ready",
    message: `"${post.title}" is ready for editor review.`,
    severity: "success",
    metadata: { researchCandidateId, version, source: "research" }
  }).catch((error) =>
    logError("draft_ready_notification_failed", error, {
      postId: post.id,
      researchCandidateId
    })
  );

  logInfo("journalist_research_draft_generated", {
    researchCandidateId,
    postId: post.id,
    version
  });
  return post;
}

export async function rewritePostSection({
  postId,
  section,
  toneInput = "Neutral"
}: {
  postId: string;
  section: JournalistSection;
  toneInput?: JournalistTone;
}) {
  const tone = JournalistToneSchema.parse(toneInput);
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { category: { select: { name: true } }, trend: { select: { category: true } } }
  });
  if (post.status === "published") {
    throw new Error("Published articles cannot be AI-rewritten. Create a new draft revision first.");
  }
  const result = await rewriteJournalistSection({
    section,
    tone,
    draft: {
      title: post.title,
      subtitle: post.subtitle,
      excerpt: post.excerpt,
      summary: post.summary,
      content: post.content,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      openGraphDescription: post.openGraphDescription,
      facebookCaption: post.facebookCaption,
      tags: parseStringArray(post.tags),
      faq: parseJsonArray(post.faq),
      keyTakeaways: parseStringArray(post.keyTakeaways),
      timeline: parseStringArray(post.timeline),
      sourceUrls: parseStringArray(post.sourceUrls),
      factCheckNotes: parseStringArray(post.factCheckNotes),
      category: post.category?.name || post.trend?.category
    }
  });
  const rewrite = result.rewrite;
  const nextVersion = post.draftVersion + 1;
  const update: Prisma.PostUpdateInput = {
    draftVersion: nextVersion,
    journalistTone: tone,
    generationMetadata: json(result.metadata),
    tokenUsage: json(result.tokenUsage),
    generationTimeMs: result.generationTimeMs,
    promptVersion: AI_JOURNALIST_PROMPT_VERSION,
    rejectedAt: null,
    rejectionReason: null
  };

  if (section === "headline") {
    if (rewrite.headline) update.title = rewrite.headline;
    if (rewrite.deck) update.subtitle = rewrite.deck;
    if (rewrite.excerpt) update.excerpt = rewrite.excerpt;
  }
  if (section === "lead") {
    if (rewrite.lead) {
      const paragraphs = post.content.split(/\n{2,}/);
      update.content = [rewrite.lead, ...paragraphs.slice(1)].join("\n\n");
    }
  }
  if (section === "body" && rewrite.body) {
    const lead = post.content.split(/\n{2,}/)[0] || "";
    update.content = `${lead}\n\n${rewrite.body}`.trim();
  }
  if (section === "faq" && rewrite.faq) update.faq = json(rewrite.faq);
  if (section === "meta") {
    if (rewrite.seoTitle) update.seoTitle = rewrite.seoTitle;
    if (rewrite.metaDescription) update.seoDescription = rewrite.metaDescription;
    if (rewrite.openGraphDescription) update.openGraphDescription = rewrite.openGraphDescription;
    if (rewrite.facebookCaption) update.facebookCaption = rewrite.facebookCaption;
  }
  if (section === "summary") {
    if (rewrite.summary) update.summary = rewrite.summary;
    if (rewrite.excerpt) update.excerpt = rewrite.excerpt;
  }
  if (rewrite.factCheckNotes) update.factCheckNotes = json(rewrite.factCheckNotes);

  const updated = await prisma.post.update({
    where: { id: postId },
    data: update
  });

  await createRevision({
    postId,
    version: nextVersion,
    changeType: "rewrite_section",
    section,
    tone,
    article: {
      headline: typeof update.title === "string" ? update.title : post.title,
      deck: typeof update.subtitle === "string" ? update.subtitle : post.subtitle || undefined,
      excerpt: typeof update.excerpt === "string" ? update.excerpt : post.excerpt,
      summary: typeof update.summary === "string" ? update.summary : post.summary || undefined,
      seoTitle: typeof update.seoTitle === "string" ? update.seoTitle : post.seoTitle,
      metaDescription:
        typeof update.seoDescription === "string" ? update.seoDescription : post.seoDescription,
      openGraphDescription:
        typeof update.openGraphDescription === "string"
          ? update.openGraphDescription
          : post.openGraphDescription || undefined,
      facebookCaption:
        typeof update.facebookCaption === "string" ? update.facebookCaption : post.facebookCaption,
      faq: rewrite.faq || parseJsonArray(post.faq),
      factCheckNotes: rewrite.factCheckNotes || parseStringArray(post.factCheckNotes),
      sourceUrls: parseStringArray(post.sourceUrls)
    },
    content: typeof update.content === "string" ? update.content : post.content,
    metadata: result.metadata,
    tokenUsage: result.tokenUsage,
    generationTimeMs: result.generationTimeMs
  });
  await runDraftFactCheck(postId, {
    version: nextVersion,
    source: "rewrite",
    section
  });

  logInfo("journalist_section_rewritten", { postId, section, version: nextVersion });
  return { post: updated, rewrite, section, version: nextVersion };
}

export async function generateDraftForTrendWithStatus(trendId: string, tone: JournalistTone = "Neutral") {
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
  if (locked.count === 0) throw new Error("This trend is already generating.");

  try {
    const post = await generateJournalistDraftFromTrend(trendId, tone);
    const categoryName = await prisma.post
      .findUnique({ where: { id: post.id }, include: { category: { select: { name: true } } } })
      .then((item) => item?.category?.name || null);
    await prisma.trend.update({
      where: { id: trendId },
      data: {
        category: categoryName,
        generationStatus: "completed",
        generationError: null,
        generatedAt: new Date()
      }
    });
    logInfo("journalist_trend_draft_generated", { trendId, postId: post.id });
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
      .catch((updateError) => logError("generation_status_update_failed", updateError, { trendId }));
    logError("journalist_trend_draft_generation_failed", error, { trendId });
    throw error;
  }
}
