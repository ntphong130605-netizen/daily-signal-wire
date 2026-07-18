import { randomUUID } from "node:crypto";
import type { SocialPost } from "@prisma/client";
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { prisma } from "@/lib/prisma";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { logError, logInfo } from "@/lib/logger";
import { absoluteUrl, siteName } from "@/lib/site";

export const socialPlatforms = [
  {
    platform: "facebook",
    label: "Facebook Page",
    credentialKeys: ["FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"],
    maxLength: 900
  },
  {
    platform: "x",
    label: "X (Twitter)",
    credentialKeys: ["X_API_KEY", "X_ACCESS_TOKEN"],
    maxLength: 260
  },
  {
    platform: "threads",
    label: "Threads",
    credentialKeys: ["THREADS_ACCESS_TOKEN"],
    connectorKeys: ["THREADS_USER_ID"],
    maxLength: 450
  },
  {
    platform: "linkedin",
    label: "LinkedIn Company Page",
    credentialKeys: ["LINKEDIN_ACCESS_TOKEN"],
    connectorKeys: ["LINKEDIN_ORGANIZATION_URN or LINKEDIN_COMPANY_ID"],
    maxLength: 1200
  },
  {
    platform: "pinterest",
    label: "Pinterest",
    credentialKeys: ["PINTEREST_ACCESS_TOKEN"],
    connectorKeys: ["PINTEREST_BOARD_ID"],
    maxLength: 500
  },
  {
    platform: "bluesky",
    label: "Bluesky",
    credentialKeys: ["BLUESKY_IDENTIFIER", "BLUESKY_APP_PASSWORD"],
    maxLength: 290
  },
  {
    platform: "newsletter",
    label: "Newsletter",
    credentialKeys: ["RESEND_API_KEY", "NEWSLETTER_FROM_EMAIL"],
    maxLength: 1600
  },
  {
    platform: "rss",
    label: "RSS Push",
    credentialKeys: [],
    maxLength: 1200
  }
] as const;

export type SocialPlatform = (typeof socialPlatforms)[number]["platform"];

const SocialCopySchema = z.object({
  facebook: z.string().min(40).max(900),
  twitter: z.string().min(30).max(260),
  threads: z.string().min(40).max(450),
  linkedin: z.string().min(60).max(1200),
  bluesky: z.string().min(30).max(290),
  pinterestTitle: z.string().min(15).max(100),
  pinterestDescription: z.string().min(40).max(500),
  newsletterSubject: z.string().min(20).max(90),
  newsletterPreviewText: z.string().min(50).max(220),
  rssSummary: z.string().min(50).max(500),
  seoHeadline: z.string().min(20).max(100),
  socialHeadline: z.string().min(20).max(120),
  clickbaitHeadline: z.string().min(20).max(120),
  curiosityHeadline: z.string().min(20).max(120),
  questionHeadline: z.string().min(20).max(120),
  callToActions: z.array(z.string().min(8).max(80)).length(5),
  shortSummary: z.string().min(50).max(260),
  hashtags: z.array(z.string().min(2).max(40)).length(10),
  emojiVersion: z.string().min(30).max(450),
  professionalVersion: z.string().min(40).max(600),
  casualVersion: z.string().min(30).max(450)
});

type SocialCopyBundle = z.infer<typeof SocialCopySchema>;

type SocialPostWithArticle = Awaited<ReturnType<typeof loadSocialPost>>;

type PublishResult =
  | { status: "published"; externalPostId?: string; destinationUrl?: string; note: string }
  | { status: "waiting_credentials" | "waiting_audience"; error: string; note: string };

export const socialRecurrences = ["none", "daily", "weekly", "monthly"] as const;
export type SocialRecurrence = (typeof socialRecurrences)[number];

const platformPromptGuidance = {
  facebook:
    "Facebook Page: 40-900 characters, lead with useful context, one clear CTA, no engagement bait.",
  twitter:
    "X: 30-260 characters before the tracked URL, concise and specific, no more than two hashtags.",
  threads:
    "Threads: 40-450 characters, conversational but factual, suitable for a newsroom account.",
  linkedin:
    "LinkedIn organization: 60-1200 characters, professional framing and a clear why-it-matters sentence.",
  pinterest:
    "Pinterest: title 15-100 characters and description 40-500 characters, descriptive and search-friendly.",
  bluesky:
    "Bluesky: 30-290 characters, direct and conversational, with enough space for a tracked link.",
  newsletter:
    "Newsletter: subject 20-90 characters, preview 50-220 characters, factual and inbox-safe.",
  rss: "RSS: neutral summary 50-500 characters, no promotional language or hashtags."
} as const;

function stringify(value: unknown) {
  return JSON.stringify(value ?? {});
}

function compact(value: string | null | undefined, max = 220) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trim()}…`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function platformDefinition(platform: string) {
  return socialPlatforms.find((item) => item.platform === platform);
}

function baseArticleUrl(slug: string) {
  return absoluteUrl(`/news/${slug}`);
}

function utmUrl(slug: string, platform: string, articleId: string) {
  const url = new URL(baseArticleUrl(slug));
  url.searchParams.set("utm_source", platform);
  url.searchParams.set("utm_medium", platform === "newsletter" ? "email" : "social");
  url.searchParams.set("utm_campaign", "daily_signal_wire_distribution");
  url.searchParams.set("utm_content", articleId);
  return url.toString();
}

function hashtag(value: string) {
  const clean = value
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  return clean ? `#${clean}` : "";
}

function fallbackHashtags(post: {
  tags: string;
  category?: { name: string } | null;
}) {
  const tags = parseStringArray(post.tags);
  const values = [
    ...(post.category?.name ? [post.category.name] : []),
    ...tags,
    "Daily Signal Wire",
    "Latest News",
    "US News",
    "News Update",
    "Newsroom",
    "Top Stories",
    "Explainer",
    "What To Know",
    "Current Events",
    "News Analysis"
  ];
  return [...new Set(values.map(hashtag).filter(Boolean))].slice(0, 10);
}

function fallbackCopy(post: {
  title: string;
  excerpt: string;
  summary?: string | null;
  facebookCaption: string;
  tags: string;
  category?: { name: string } | null;
}): SocialCopyBundle {
  const summary = compact(post.summary || post.excerpt, 220);
  const hashtags = fallbackHashtags(post);
  const title = compact(post.title, 110);
  const professionalVersion = compact(`${title}\n\n${summary}`, 560);
  const casualVersion = compact(`${title}\n\nHere is what to know: ${summary}`, 420);
  return {
    facebook: compact(post.facebookCaption || `${title}\n\n${summary}`, 850),
    twitter: compact(`${title} — ${summary}`, 245),
    threads: compact(`${title}\n\n${summary}`, 430),
    linkedin: compact(`${title}\n\n${summary}\n\nWhy it matters: readers get the full context, sources and editorial notes on ${siteName}.`, 1100),
    bluesky: compact(`${title} — ${summary}`, 275),
    pinterestTitle: compact(title, 96),
    pinterestDescription: compact(`${title}: ${summary}`, 480),
    newsletterSubject: compact(title, 86),
    newsletterPreviewText: compact(summary, 200),
    rssSummary: compact(summary, 480),
    seoHeadline: compact(title, 96),
    socialHeadline: compact(title, 116),
    clickbaitHeadline: compact(`What the latest reporting reveals about ${title}`, 116),
    curiosityHeadline: compact(`The context behind ${title}`, 116),
    questionHeadline: compact(`What should readers know about ${title}?`, 116),
    callToActions: [
      "Read the full story",
      "Get the verified context",
      "See what happens next",
      "Review the sources",
      "Read the complete report"
    ],
    shortSummary: compact(summary, 240),
    hashtags,
    emojiVersion: compact(`📰 ${title}\n\n${summary}`, 430),
    professionalVersion,
    casualVersion
  };
}

function openaiClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function generateSocialCopy(post: {
  title: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  content: string;
  seoDescription: string;
  facebookCaption: string;
  tags: string;
  category?: { name: string } | null;
}): Promise<SocialCopyBundle> {
  const fallback = fallbackCopy(post);
  const client = openaiClient();
  if (!client) return fallback;

  try {
    const response = await client.responses.parse({
      model: process.env.AI_MODEL || "gpt-5.5",
      instructions:
        "You are the social distribution editor for Daily Signal Wire. Generate factual platform-specific promotion copy for an already-published article. Do not invent facts, quotes, numbers, organizations, or claims. A field named clickbaitHeadline means a high-interest but fully accurate headline: never use deception, engagement bait, or unsupported urgency. Keep every output within its platform limit. Return JSON only.",
      input: JSON.stringify({
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        summary: post.summary,
        seoDescription: post.seoDescription,
        category: post.category?.name,
        tags: parseStringArray(post.tags),
        articlePreview: compact(post.content, 1600),
        platformPrompts: platformPromptGuidance,
        optimizationRequirements: {
          headlines: ["SEO", "social", "high-interest factual", "curiosity", "question"],
          callToActions: 5,
          hashtags: 10,
          tones: ["emoji", "professional", "casual"]
        }
      }),
      text: {
        format: zodTextFormat(SocialCopySchema, "daily_signal_wire_social_copy")
      }
    });
    return response.output_parsed || fallback;
  } catch (error) {
    logError("social_copy_generation_failed", error, { title: post.title });
    return fallback;
  }
}

export function socialCredentialStatus(platform: string) {
  const definition = platformDefinition(platform);
  if (!definition) {
    return {
      configured: false,
      missing: ["Unsupported platform"],
      label: platform
    };
  }
  const missing: string[] = definition.credentialKeys.filter((key) => !process.env[key]?.trim());
  if (platform === "threads" && !process.env.THREADS_USER_ID?.trim()) {
    missing.push("THREADS_USER_ID");
  }
  if (
    platform === "linkedin" &&
    !process.env.LINKEDIN_ORGANIZATION_URN?.trim() &&
    !process.env.LINKEDIN_COMPANY_ID?.trim()
  ) {
    missing.push("LINKEDIN_ORGANIZATION_URN or LINKEDIN_COMPANY_ID");
  }
  if (platform === "pinterest" && !process.env.PINTEREST_BOARD_ID?.trim()) {
    missing.push("PINTEREST_BOARD_ID");
  }
  return {
    configured: missing.length === 0,
    missing,
    label: definition.label
  };
}

export function socialReadiness() {
  return socialPlatforms.map((platform) => ({
    ...platform,
    ...socialCredentialStatus(platform.platform)
  }));
}

function pickPlatformCopy(platform: string, bundle: SocialCopyBundle) {
  switch (platform) {
    case "facebook":
      return bundle.facebook;
    case "x":
      return bundle.twitter;
    case "threads":
      return bundle.threads;
    case "linkedin":
      return bundle.linkedin;
    case "pinterest":
      return bundle.pinterestDescription;
    case "bluesky":
      return bundle.bluesky;
    case "newsletter":
      return `${bundle.newsletterSubject}\n\n${bundle.newsletterPreviewText}`;
    case "rss":
      return bundle.rssSummary;
    default:
      return bundle.shortSummary;
  }
}

function renderCopy({
  platform,
  bundle,
  trackingUrl,
  maxLength,
  baseCopy,
  callToAction
}: {
  platform: string;
  bundle: SocialCopyBundle;
  trackingUrl: string;
  maxLength: number;
  baseCopy?: string;
  callToAction?: string;
}) {
  const base = baseCopy || pickPlatformCopy(platform, bundle);
  const hashtags =
    platform === "newsletter" || platform === "rss"
      ? ""
      : bundle.hashtags.slice(0, platform === "x" ? 2 : 5).join(" ");
  const cta =
    platform === "newsletter" || platform === "rss"
      ? ""
      : callToAction || bundle.callToActions[0];
  const suffix = [cta, trackingUrl, hashtags].filter(Boolean).join("\n");
  const available = Math.max(24, maxLength - suffix.length - 4);
  return [compact(base, available), suffix].filter(Boolean).join("\n\n").trim();
}

function variantTrackingUrl(id: string, variantKey: string) {
  const url = new URL(absoluteUrl(`/api/social/click/${id}`));
  url.searchParams.set("variant", variantKey);
  return url.toString();
}

function buildCopyVariants({
  id,
  platform,
  definition,
  bundle
}: {
  id: string;
  platform: string;
  definition: { maxLength: number };
  bundle: SocialCopyBundle;
}) {
  const bases = [
    {
      variantKey: "control",
      label: "Professional",
      headline: bundle.socialHeadline,
      body: pickPlatformCopy(platform, bundle) || bundle.professionalVersion,
      callToAction: bundle.callToActions[0],
      tone: "professional"
    },
    {
      variantKey: "curiosity",
      label: "Curiosity",
      headline: bundle.curiosityHeadline,
      body: bundle.casualVersion,
      callToAction: bundle.callToActions[1],
      tone: "casual"
    },
    {
      variantKey: "question",
      label: "Question",
      headline: bundle.questionHeadline,
      body: bundle.emojiVersion,
      callToAction: bundle.callToActions[2],
      tone: "emoji"
    }
  ];
  return bases.map((variant) => {
    const trackingUrl = variantTrackingUrl(id, variant.variantKey);
    const baseCopy = `${variant.headline}\n\n${variant.body}`;
    return {
      ...variant,
      trackingUrl,
      caption: renderCopy({
        platform,
        bundle,
        trackingUrl,
        maxLength: definition.maxLength,
        baseCopy,
        callToAction: variant.callToAction
      })
    };
  });
}

function primaryImage(post: {
  openGraphImage?: string | null;
  featuredImageUrl?: string | null;
  featuredImage?: string | null;
  imageUrl?: string | null;
  thumbnailImage?: string | null;
}) {
  return (
    post.openGraphImage ||
    post.featuredImageUrl ||
    post.featuredImage ||
    post.imageUrl ||
    post.thumbnailImage ||
    absoluteUrl("/editorial/ai/newsroom.jpg")
  );
}

function logEntry(status: string, note: string, metadata: Record<string, unknown> = {}) {
  return {
    at: new Date().toISOString(),
    status,
    note,
    ...metadata
  };
}

function appendLogs(logs: string, entry: Record<string, unknown>) {
  return stringify([entry, ...parseJsonArray(logs)].slice(0, 40));
}

const SOCIAL_QUEUE_PAUSED_KEY = "social_distribution_queue_paused";

export async function socialQueuePaused() {
  const setting = await prisma.siteSetting.findUnique({
    where: { key: SOCIAL_QUEUE_PAUSED_KEY },
    select: { value: true }
  });
  return setting?.value === "true";
}

export async function setSocialQueuePaused(paused: boolean) {
  await prisma.siteSetting.upsert({
    where: { key: SOCIAL_QUEUE_PAUSED_KEY },
    update: { value: String(paused), type: "boolean", group: "distribution" },
    create: {
      key: SOCIAL_QUEUE_PAUSED_KEY,
      value: String(paused),
      type: "boolean",
      group: "distribution"
    }
  });
  return paused;
}

async function recordAction({
  socialPostId,
  action,
  fromStatus,
  toStatus,
  message,
  attempt = 0,
  responseTimeMs,
  metadata = {}
}: {
  socialPostId: string;
  action: string;
  fromStatus?: string | null;
  toStatus: string;
  message: string;
  attempt?: number;
  responseTimeMs?: number | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.socialPostLog.create({
    data: {
      socialPostId,
      action,
      fromStatus: fromStatus || null,
      toStatus,
      message: compact(message, 1000),
      attempt,
      responseTimeMs: responseTimeMs || null,
      metadata: stringify(metadata)
    }
  });
}

function retryDelayMs(attempt: number) {
  const delays = [5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
  return delays[Math.min(Math.max(attempt - 1, 0), delays.length - 1)];
}

function nextRecurringDate(from: Date, recurrence: string) {
  const next = new Date(from);
  if (recurrence === "daily") next.setUTCDate(next.getUTCDate() + 1);
  else if (recurrence === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  else if (recurrence === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  else return null;
  return next;
}

export function zonedDateTimeToUtc(value: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    throw new Error("Scheduled time must use YYYY-MM-DDTHH:mm format.");
  }
  const naive = new Date(`${value.slice(0, 16)}:00.000Z`);
  if (Number.isNaN(naive.getTime())) throw new Error("Scheduled time is invalid.");
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(naive).map((part) => [part.type, part.value])
  );
  const represented = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  const offset = represented - naive.getTime();
  return new Date(naive.getTime() - offset);
}

export async function queueSocialPostsForArticle({
  articleId,
  platforms = socialPlatforms.map((item) => item.platform),
  scheduledAt = null,
  source = "auto",
  timezone = "America/New_York",
  priority = 3,
  recurrence = "none",
  recurrenceEndsAt = null,
  maxRetries = 3,
  publishImmediately
}: {
  articleId: string;
  platforms?: string[];
  scheduledAt?: Date | null;
  source?: "auto" | "manual" | "publish_workflow";
  timezone?: string;
  priority?: number;
  recurrence?: SocialRecurrence;
  recurrenceEndsAt?: Date | null;
  maxRetries?: number;
  publishImmediately?: boolean;
}) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: articleId },
    include: { category: { select: { name: true, slug: true } } }
  });
  if (post.status !== "published") {
    throw new Error("Social posts can only be queued after an article is published.");
  }

  const selectedPlatforms = [
    ...new Set(platforms.filter((platform) => platformDefinition(platform)))
  ];
  const image = primaryImage(post);
  const queueIsPaused = await socialQueuePaused();
  const created: SocialPost[] = [];
  const prepared: Array<{
    id: string;
    platform: string;
    definition: NonNullable<ReturnType<typeof platformDefinition>>;
    logs: string;
  }> = [];

  for (const platform of selectedPlatforms) {
    const definition = platformDefinition(platform)!;
    const existing = await prisma.socialPost.findUnique({
      where: { articleId_platform: { articleId, platform } }
    });
    if (existing?.status === "published" && recurrence === "none") {
      created.push(existing);
      continue;
    }

    const id = existing?.id || randomUUID();
    const preparingLog = logEntry("preparing", "Generating platform copy and media variants.", {
      source
    });
    const sourceImage = absoluteUrl(image);
    const preparedJob = await prisma.socialPost.upsert({
      where: { articleId_platform: { articleId, platform } },
      update: {
        status: platform === "rss" ? "published" : "preparing",
        priority,
        timezone,
        scheduledAt,
        nextAttemptAt: scheduledAt || new Date(),
        recurrence,
        recurrenceEndsAt,
        maxRetries,
        errorMessage: null,
        sourceImage,
        openGraphImage: absoluteUrl(`/api/social/image/${id}/og`),
        squareImage: absoluteUrl(`/api/social/image/${id}/square`),
        verticalImage: absoluteUrl(`/api/social/image/${id}/vertical`),
        facebookImage: absoluteUrl(`/api/social/image/${id}/facebook`),
        twitterImage: absoluteUrl(`/api/social/image/${id}/twitter`),
        linkedinImage: absoluteUrl(`/api/social/image/${id}/linkedin`),
        pinterestImage: absoluteUrl(`/api/social/image/${id}/pinterest`),
        logs: appendLogs(existing?.logs || "[]", preparingLog)
      },
      create: {
        id,
        articleId,
        platform,
        status: platform === "rss" ? "published" : "preparing",
        priority,
        timezone,
        scheduledAt,
        nextAttemptAt: scheduledAt || new Date(),
        recurrence,
        recurrenceEndsAt,
        maxRetries,
        sourceImage,
        openGraphImage: absoluteUrl(`/api/social/image/${id}/og`),
        squareImage: absoluteUrl(`/api/social/image/${id}/square`),
        verticalImage: absoluteUrl(`/api/social/image/${id}/vertical`),
        facebookImage: absoluteUrl(`/api/social/image/${id}/facebook`),
        twitterImage: absoluteUrl(`/api/social/image/${id}/twitter`),
        linkedinImage: absoluteUrl(`/api/social/image/${id}/linkedin`),
        pinterestImage: absoluteUrl(`/api/social/image/${id}/pinterest`),
        logs: stringify([preparingLog])
      }
    });
    await recordAction({
      socialPostId: id,
      action: "prepare",
      fromStatus: existing?.status,
      toStatus: preparedJob.status,
      message: "Generating platform copy and media variants.",
      metadata: { source, priority, timezone, recurrence }
    });
    prepared.push({ id, platform, definition, logs: preparedJob.logs });
  }

  if (prepared.length === 0) return created;
  const copyBundle = await generateSocialCopy(post);

  for (const item of prepared) {
    const { id, platform, definition } = item;
    const destinationUrl = utmUrl(post.slug, platform, articleId);
    const credentials = socialCredentialStatus(platform);
    const status =
      platform === "rss"
        ? "published"
        : queueIsPaused
          ? "paused"
          : !credentials.configured
            ? "waiting_credentials"
            : scheduledAt && scheduledAt > new Date()
              ? "scheduled"
              : "queued";
    const errorMessage =
      status === "waiting_credentials"
        ? `Credential Missing: ${credentials.missing.join(", ")}`
        : queueIsPaused && platform !== "rss"
          ? "Distribution queue is paused."
          : null;
    const variants = buildCopyVariants({ id, platform, definition, bundle: copyBundle });
    for (const variant of variants) {
      await prisma.socialPostVariant.upsert({
        where: { socialPostId_variantKey: { socialPostId: id, variantKey: variant.variantKey } },
        update: {
          label: variant.label,
          headline: variant.headline,
          caption: variant.caption,
          callToAction: variant.callToAction,
          tone: variant.tone,
          status: "active"
        },
        create: {
          socialPostId: id,
          variantKey: variant.variantKey,
          label: variant.label,
          headline: variant.headline,
          caption: variant.caption,
          callToAction: variant.callToAction,
          tone: variant.tone,
          isWinner: false
        }
      });
    }
    const control = variants[0];
    const payload = {
      source,
      platformLabel: definition.label,
      articleUrl: baseArticleUrl(post.slug),
      canonicalUrl: baseArticleUrl(post.slug),
      utmUrl: destinationUrl,
      newsletterSubject: copyBundle.newsletterSubject,
      newsletterPreviewText: copyBundle.newsletterPreviewText,
      pinterestTitle: copyBundle.pinterestTitle,
      socialOptimization: {
        seoHeadline: copyBundle.seoHeadline,
        socialHeadline: copyBundle.socialHeadline,
        clickbaitHeadline: copyBundle.clickbaitHeadline,
        curiosityHeadline: copyBundle.curiosityHeadline,
        questionHeadline: copyBundle.questionHeadline,
        callToActions: copyBundle.callToActions,
        emojiVersion: copyBundle.emojiVersion,
        professionalVersion: copyBundle.professionalVersion,
        casualVersion: copyBundle.casualVersion
      },
      generatedBy: process.env.OPENAI_API_KEY
        ? "ai-viral-distribution-v2"
        : "source-derived-distribution-v2"
    };
    const updated = await prisma.socialPost.update({
      where: { id },
      data: {
        status,
        publishedAt: platform === "rss" ? new Date() : null,
        lastPublishedAt: platform === "rss" ? new Date() : null,
        occurrenceCount: platform === "rss" ? { increment: 1 } : undefined,
        errorMessage,
        copy: control.caption,
        selectedVariantKey: control.variantKey,
        hashtags: stringify(copyBundle.hashtags),
        shortSummary: copyBundle.shortSummary,
        callToAction: control.callToAction,
        utmUrl: destinationUrl,
        trackingUrl: control.trackingUrl,
        payload: stringify(payload),
        logs: appendLogs(
          item.logs,
          logEntry(status, errorMessage || "Distribution package is ready.", { source })
        ),
        externalPostId: platform === "rss" ? absoluteUrl("/rss.xml") : null
      }
    });
    await recordAction({
      socialPostId: id,
      action: platform === "rss" ? "rss_live" : "queue",
      fromStatus: "preparing",
      toStatus: status,
      message: errorMessage || "Distribution package is ready.",
      metadata: { source, variants: variants.map((variant) => variant.variantKey) }
    });
    created.push(updated);
  }

  const shouldPublishImmediately = publishImmediately ?? source === "publish_workflow";
  if (shouldPublishImmediately && !queueIsPaused) {
    for (let index = 0; index < created.length; index += 1) {
      const job = created[index];
      if (job.status === "queued") {
        created[index] = await publishSocialPostNow(job.id, { manual: false });
      }
    }
  }

  return created;
}

function loadSocialPost(id: string) {
  return prisma.socialPost.findUnique({
    where: { id },
    include: {
      variants: { where: { status: "active" }, orderBy: { createdAt: "asc" } },
      article: {
        include: { category: { select: { name: true, slug: true } } }
      }
    }
  });
}

async function parseConnectorResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

function selectedVariant(job: NonNullable<SocialPostWithArticle>) {
  return (
    job.variants.find((variant) => variant.variantKey === job.selectedVariantKey) ||
    job.variants[0]
  );
}

function effectiveCopy(job: NonNullable<SocialPostWithArticle>) {
  return selectedVariant(job)?.caption || job.copy || job.shortSummary || "";
}

function effectiveTrackingUrl(job: NonNullable<SocialPostWithArticle>) {
  const variant = selectedVariant(job);
  return variant
    ? variantTrackingUrl(job.id, variant.variantKey)
    : job.trackingUrl || job.utmUrl || baseArticleUrl(job.article.slug);
}

function jobPayload(job: NonNullable<SocialPostWithArticle>) {
  try {
    return JSON.parse(job.payload || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function publishFacebook(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim();
  const graphBase = version
    ? `https://graph.facebook.com/${version}`
    : "https://graph.facebook.com";
  const body = new URLSearchParams({
    caption: effectiveCopy(job),
    url: job.facebookImage || job.openGraphImage || job.sourceImage || "",
    access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ""
  });
  const response = await fetch(`${graphBase}/${process.env.FACEBOOK_PAGE_ID}/photos`, {
    method: "POST",
    body
  });
  const payload = await parseConnectorResponse(response);
  if (!response.ok) throw new Error(String(payload.error || payload.raw || "Facebook publish failed."));
  return {
    status: "published",
    externalPostId: String(payload.id || ""),
    note: "Published to Facebook Page."
  };
}

async function publishX(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const response = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.X_ACCESS_TOKEN || ""}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: compact(effectiveCopy(job), 280) })
  });
  const payload = await parseConnectorResponse(response);
  if (!response.ok) throw new Error(String(payload.detail || payload.title || payload.raw || "X publish failed."));
  const data = payload.data as { id?: string } | undefined;
  return { status: "published", externalPostId: data?.id, note: "Published to X." };
}

async function publishThreads(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const userId = process.env.THREADS_USER_ID || "";
  const token = process.env.THREADS_ACCESS_TOKEN || "";
  const createUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads`);
  createUrl.searchParams.set("media_type", "TEXT");
  createUrl.searchParams.set("text", compact(effectiveCopy(job), 500));
  createUrl.searchParams.set("access_token", token);
  const createResponse = await fetch(createUrl, { method: "POST" });
  const createPayload = await parseConnectorResponse(createResponse);
  if (!createResponse.ok) {
    throw new Error(String(createPayload.error || createPayload.raw || "Threads create failed."));
  }
  const creationId = String(createPayload.id || "");
  const publishUrl = new URL(`https://graph.threads.net/v1.0/${userId}/threads_publish`);
  publishUrl.searchParams.set("creation_id", creationId);
  publishUrl.searchParams.set("access_token", token);
  const publishResponse = await fetch(publishUrl, { method: "POST" });
  const publishPayload = await parseConnectorResponse(publishResponse);
  if (!publishResponse.ok) {
    throw new Error(String(publishPayload.error || publishPayload.raw || "Threads publish failed."));
  }
  return {
    status: "published",
    externalPostId: String(publishPayload.id || creationId),
    note: "Published to Threads."
  };
}

async function publishLinkedIn(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const organizationUrn =
    process.env.LINKEDIN_ORGANIZATION_URN ||
    (process.env.LINKEDIN_COMPANY_ID
      ? `urn:li:organization:${process.env.LINKEDIN_COMPANY_ID}`
      : "");
  const response = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN || ""}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "Linkedin-Version": process.env.LINKEDIN_API_VERSION || "202605"
    },
    body: JSON.stringify({
      author: organizationUrn,
      commentary: effectiveCopy(job),
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: []
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false
    })
  });
  const payload = await parseConnectorResponse(response);
  if (!response.ok) throw new Error(String(payload.message || payload.raw || "LinkedIn publish failed."));
  return {
    status: "published",
    externalPostId: response.headers.get("x-restli-id") || undefined,
    note: "Published to LinkedIn."
  };
}

async function publishPinterest(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const payloadData = jobPayload(job);
  const response = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN || ""}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      board_id: process.env.PINTEREST_BOARD_ID,
      title: compact(String(payloadData.pinterestTitle || job.article.title), 100),
      description: compact(effectiveCopy(job), 500),
      link: effectiveTrackingUrl(job),
      media_source: {
        source_type: "image_url",
        url: job.pinterestImage || job.verticalImage || job.openGraphImage
      }
    })
  });
  const payload = await parseConnectorResponse(response);
  if (!response.ok) throw new Error(String(payload.message || payload.raw || "Pinterest publish failed."));
  return {
    status: "published",
    externalPostId: String(payload.id || ""),
    note: "Published to Pinterest."
  };
}

async function publishBluesky(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const sessionResponse = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: process.env.BLUESKY_IDENTIFIER,
      password: process.env.BLUESKY_APP_PASSWORD
    })
  });
  const session = (await parseConnectorResponse(sessionResponse)) as {
    accessJwt?: string;
    did?: string;
    raw?: string;
    error?: string;
  };
  if (!sessionResponse.ok || !session.accessJwt || !session.did) {
    throw new Error(session.error || session.raw || "Bluesky login failed.");
  }
  const response = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      repo: session.did,
      collection: "app.bsky.feed.post",
      record: {
        $type: "app.bsky.feed.post",
        text: compact(effectiveCopy(job), 300),
        createdAt: new Date().toISOString(),
        embed: {
          $type: "app.bsky.embed.external",
          external: {
            uri: effectiveTrackingUrl(job),
            title: compact(job.article.title, 120),
            description: compact(job.shortSummary || job.article.excerpt, 300)
          }
        }
      }
    })
  });
  const payload = await parseConnectorResponse(response);
  if (!response.ok) throw new Error(String(payload.error || payload.raw || "Bluesky publish failed."));
  return {
    status: "published",
    externalPostId: String(payload.uri || ""),
    note: "Published to Bluesky."
  };
}

async function publishNewsletter(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { status: "active" },
    select: { id: true, email: true, unsubscribeToken: true },
    orderBy: { createdAt: "asc" },
    take: 1000
  });
  if (subscribers.length === 0) {
    return {
      status: "waiting_audience",
      error: "No active newsletter subscribers.",
      note: "Newsletter waits for active subscribers."
    };
  }
  let payload: { newsletterSubject?: string; newsletterPreviewText?: string } = {};
  try {
    payload = JSON.parse(job.payload || "{}");
  } catch {
    payload = {};
  }
  const subject = payload?.newsletterSubject || compact(job.article.title, 86);
  const preview = payload?.newsletterPreviewText || job.shortSummary || job.article.excerpt;
  const url = effectiveTrackingUrl(job);
  const ids: string[] = [];
  for (let offset = 0; offset < subscribers.length; offset += 100) {
    const batch = subscribers.slice(offset, offset + 100);
    const messages = [];
    for (const subscriber of batch) {
      const token = subscriber.unsubscribeToken || randomUUID();
      if (!subscriber.unsubscribeToken) {
        await prisma.newsletterSubscriber.update({
          where: { id: subscriber.id },
          data: { unsubscribeToken: token }
        });
      }
      const unsubscribeUrl = new URL(absoluteUrl("/api/newsletter/unsubscribe"));
      unsubscribeUrl.searchParams.set("token", token);
      messages.push({
        from: process.env.NEWSLETTER_FROM_EMAIL,
        to: [subscriber.email],
        subject,
        html: `
          <p>${escapeHtml(String(preview))}</p>
          <p><a href="${escapeHtml(url)}">Read the full story</a></p>
          <p style="color:#6b7280;font-size:12px">${escapeHtml(siteName)} · <a href="${escapeHtml(unsubscribeUrl.toString())}">Unsubscribe</a></p>
        `,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl.toString()}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
        },
        tags: [
          { name: "campaign", value: "daily_signal_wire" },
          { name: "article", value: job.articleId.replace(/[^a-z0-9_-]/gi, "_") }
        ]
      });
    }
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `dsw-${job.id}-${job.occurrenceCount + 1}-${offset / 100}`
      },
      body: JSON.stringify(messages)
    });
    const result = (await parseConnectorResponse(response)) as {
      data?: Array<{ id?: string }>;
      message?: string;
      raw?: string;
    };
    if (!response.ok) {
      throw new Error(String(result.message || result.raw || "Newsletter batch failed."));
    }
    ids.push(...(result.data || []).map((item) => item.id || "").filter(Boolean));
    await prisma.newsletterSubscriber.updateMany({
      where: { id: { in: batch.map((subscriber) => subscriber.id) } },
      data: { lastSentAt: new Date() }
    });
  }
  return {
    status: "published",
    externalPostId: ids[0],
    note: `Newsletter sent to ${subscribers.length} subscribers.`
  };
}

async function runConnector(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  if (job.platform === "rss") {
    return {
      status: "published",
      externalPostId: absoluteUrl("/rss.xml"),
      destinationUrl: absoluteUrl("/rss.xml"),
      note: "RSS push is live through /rss.xml."
    };
  }

  const credentials = socialCredentialStatus(job.platform);
  if (!credentials.configured) {
    return {
      status: "waiting_credentials",
      error: `Waiting for credentials: ${credentials.missing.join(", ")}`,
      note: "External publisher is waiting for official API credentials."
    };
  }

  switch (job.platform) {
    case "facebook":
      return publishFacebook(job);
    case "x":
      return publishX(job);
    case "threads":
      return publishThreads(job);
    case "linkedin":
      return publishLinkedIn(job);
    case "pinterest":
      return publishPinterest(job);
    case "bluesky":
      return publishBluesky(job);
    case "newsletter":
      return publishNewsletter(job);
    default:
      return {
        status: "waiting_credentials",
        error: "Unsupported platform connector.",
        note: "No connector is available for this platform."
      };
  }
}

export async function publishSocialPostNow(id: string, options: { manual?: boolean } = {}) {
  const job = await loadSocialPost(id);
  if (!job) throw new Error("Social post was not found.");
  if (job.status === "cancelled") throw new Error("Cancelled social posts cannot be published.");
  if (job.status === "published" && job.recurrence === "none") return job;
  if (!options.manual && job.scheduledAt && job.scheduledAt > new Date()) return job;
  if (!options.manual && (await socialQueuePaused())) {
    const paused = await prisma.socialPost.update({
      where: { id },
      data: {
        status: "paused",
        errorMessage: "Distribution queue is paused.",
        logs: appendLogs(job.logs, logEntry("paused", "Global distribution queue is paused."))
      }
    });
    await recordAction({
      socialPostId: id,
      action: "pause",
      fromStatus: job.status,
      toStatus: "paused",
      message: "Global distribution queue is paused."
    });
    return paused;
  }

  const startedAt = Date.now();
  const publishingLogs = appendLogs(
    job.logs,
    logEntry("publishing", "Publishing attempt started.", { manual: Boolean(options.manual) })
  );
  const claimed = await prisma.socialPost.updateMany({
    where: {
      id,
      status: {
        in: [
          "queued",
          "retry",
          "scheduled",
          "failed",
          "paused",
          "waiting_credentials",
          "waiting_audience"
        ]
      }
    },
    data: {
      status: "publishing",
      lastAttemptAt: new Date(),
      errorMessage: null,
      logs: publishingLogs
    }
  });
  if (claimed.count === 0) return (await loadSocialPost(id)) || job;
  await recordAction({
    socialPostId: id,
    action: "publish_attempt",
    fromStatus: job.status,
    toStatus: "publishing",
    message: "Publishing attempt started.",
    attempt: job.retryCount + 1,
    metadata: { manual: Boolean(options.manual), variant: job.selectedVariantKey }
  });

  try {
    const result = await runConnector(job);
    const responseTimeMs = Date.now() - startedAt;
    if (result.status !== "published") {
      const waiting = await prisma.socialPost.update({
        where: { id },
        data: {
          status: result.status,
          errorMessage: result.error,
          responseTimeMs,
          nextAttemptAt: new Date(Date.now() + 15 * 60_000),
          logs: appendLogs(publishingLogs, logEntry(result.status, result.note))
        }
      });
      await recordAction({
        socialPostId: id,
        action: "publish_waiting",
        fromStatus: "publishing",
        toStatus: result.status,
        message: result.note,
        attempt: job.retryCount + 1,
        responseTimeMs
      });
      return waiting;
    }
    const publishedAt = new Date();
    const recurringAt = nextRecurringDate(publishedAt, job.recurrence);
    const shouldRecur = Boolean(
      recurringAt && (!job.recurrenceEndsAt || recurringAt <= job.recurrenceEndsAt)
    );
    const nextStatus = shouldRecur ? "scheduled" : "published";
    const updated = await prisma.socialPost.update({
      where: { id },
      data: {
        status: nextStatus,
        publishedAt: job.publishedAt || publishedAt,
        lastPublishedAt: publishedAt,
        scheduledAt: shouldRecur ? recurringAt : null,
        nextAttemptAt: shouldRecur ? recurringAt : null,
        occurrenceCount: { increment: 1 },
        responseTimeMs,
        errorMessage: null,
        externalPostId: result.externalPostId || job.externalPostId,
        logs: appendLogs(
          publishingLogs,
          logEntry(
            nextStatus,
            shouldRecur
              ? `${result.note} Next recurring publish is scheduled.`
              : result.note,
            { nextScheduledAt: recurringAt?.toISOString() }
          )
        )
      }
    });
    await recordAction({
      socialPostId: id,
      action: "publish_success",
      fromStatus: "publishing",
      toStatus: nextStatus,
      message: shouldRecur ? `${result.note} Recurring publish scheduled.` : result.note,
      attempt: job.retryCount + 1,
      responseTimeMs,
      metadata: {
        externalPostId: result.externalPostId,
        nextScheduledAt: recurringAt?.toISOString(),
        variant: job.selectedVariantKey
      }
    });
    logInfo("social_post_published", { id, platform: job.platform, articleId: job.articleId });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social publish failed.";
    const responseTimeMs = Date.now() - startedAt;
    const retryCount = job.retryCount + 1;
    const shouldRetry = retryCount < job.maxRetries;
    const nextAttemptAt = shouldRetry
      ? new Date(Date.now() + retryDelayMs(retryCount))
      : null;
    logError("social_publish_failed", error, { id, platform: job.platform });
    const failed = await prisma.socialPost.update({
      where: { id },
      data: {
        status: shouldRetry ? "retry" : "failed",
        retryCount,
        nextAttemptAt,
        responseTimeMs,
        errorMessage: message.slice(0, 1000),
        logs: appendLogs(
          publishingLogs,
          logEntry(shouldRetry ? "retry" : "failed", message.slice(0, 1000), {
            nextAttemptAt: nextAttemptAt?.toISOString()
          })
        )
      }
    });
    await recordAction({
      socialPostId: id,
      action: shouldRetry ? "retry_scheduled" : "publish_failed",
      fromStatus: "publishing",
      toStatus: shouldRetry ? "retry" : "failed",
      message: message.slice(0, 1000),
      attempt: retryCount,
      responseTimeMs,
      metadata: { nextAttemptAt: nextAttemptAt?.toISOString() }
    });
    return failed;
  }
}

export async function retrySocialPost(id: string) {
  const job = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.socialPost.update({
    where: { id },
    data: {
      status: job.scheduledAt && job.scheduledAt > new Date() ? "scheduled" : "retry",
      nextAttemptAt: job.scheduledAt && job.scheduledAt > new Date() ? job.scheduledAt : new Date(),
      errorMessage: null,
      logs: appendLogs(job.logs, logEntry("retry", "Retry queued by editor."))
    }
  });
  await recordAction({
    socialPostId: id,
    action: "retry",
    fromStatus: job.status,
    toStatus: updated.status,
    message: "Retry queued by editor.",
    attempt: job.retryCount
  });
  return updated;
}

export async function cancelSocialPost(id: string) {
  const job = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
  const updated = await prisma.socialPost.update({
    where: { id },
    data: {
      status: "cancelled",
      nextAttemptAt: null,
      errorMessage: null,
      logs: appendLogs(job.logs, logEntry("cancelled", "Cancelled by editor."))
    }
  });
  await recordAction({
    socialPostId: id,
    action: "cancel",
    fromStatus: job.status,
    toStatus: "cancelled",
    message: "Cancelled by editor."
  });
  return updated;
}

export async function pauseSocialPost(id: string) {
  const job = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
  if (job.status === "published" || job.status === "cancelled") return job;
  const updated = await prisma.socialPost.update({
    where: { id },
    data: {
      status: "paused",
      errorMessage: "Paused by editor.",
      logs: appendLogs(job.logs, logEntry("paused", "Paused by editor."))
    }
  });
  await recordAction({
    socialPostId: id,
    action: "pause",
    fromStatus: job.status,
    toStatus: "paused",
    message: "Paused by editor."
  });
  return updated;
}

export async function resumeSocialPost(id: string) {
  const job = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
  if (job.status !== "paused") return job;
  const credentials = socialCredentialStatus(job.platform);
  const status = !credentials.configured
    ? "waiting_credentials"
    : job.scheduledAt && job.scheduledAt > new Date()
      ? "scheduled"
      : "queued";
  const updated = await prisma.socialPost.update({
    where: { id },
    data: {
      status,
      nextAttemptAt: job.scheduledAt || new Date(),
      errorMessage:
        status === "waiting_credentials"
          ? `Credential Missing: ${credentials.missing.join(", ")}`
          : null,
      logs: appendLogs(job.logs, logEntry(status, "Resumed by editor."))
    }
  });
  await recordAction({
    socialPostId: id,
    action: "resume",
    fromStatus: "paused",
    toStatus: status,
    message: "Resumed by editor."
  });
  return updated;
}

export async function selectSocialVariant(id: string, variantKey: string) {
  const job = await prisma.socialPost.findUniqueOrThrow({
    where: { id },
    include: { variants: true }
  });
  const variant = job.variants.find((item) => item.variantKey === variantKey);
  if (!variant) throw new Error("A/B variant was not found.");
  const trackingUrl = variantTrackingUrl(id, variant.variantKey);
  const updated = await prisma.socialPost.update({
    where: { id },
    data: {
      selectedVariantKey: variant.variantKey,
      copy: variant.caption,
      callToAction: variant.callToAction,
      trackingUrl,
      logs: appendLogs(
        job.logs,
        logEntry(job.status, `Selected A/B variant ${variant.label}.`, {
          variantKey: variant.variantKey
        })
      )
    }
  });
  await recordAction({
    socialPostId: id,
    action: "select_variant",
    fromStatus: job.status,
    toStatus: job.status,
    message: `Selected A/B variant ${variant.label}.`,
    metadata: { variantKey: variant.variantKey }
  });
  return updated;
}

export async function processSocialQueue(limit = 40) {
  const now = new Date();
  if (await socialQueuePaused()) {
    return { paused: true, checked: 0, updated: 0, results: [] };
  }
  await prisma.socialPost.updateMany({
    where: {
      status: "preparing",
      updatedAt: { lt: new Date(now.getTime() - 15 * 60_000) }
    },
    data: {
      status: "retry",
      nextAttemptAt: now,
      errorMessage: "Preparation timed out and was returned to the retry queue."
    }
  });
  const jobs = await prisma.socialPost.findMany({
    where: {
      OR: [
        { status: "queued", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "retry", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "waiting_credentials", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "waiting_audience", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
        { status: "scheduled", scheduledAt: { lte: now } },
        { status: "failed", retryCount: { lt: 3 }, nextAttemptAt: { lte: now } }
      ]
    },
    orderBy: [{ priority: "asc" }, { scheduledAt: "asc" }, { updatedAt: "asc" }],
    take: limit
  });

  const results = [];
  for (const job of jobs) {
    results.push(await publishSocialPostNow(job.id));
  }
  return {
    paused: false,
    checked: jobs.length,
    updated: results.length,
    results
  };
}

type PlatformMetrics = Partial<{
  clicks: number;
  impressions: number;
  reach: number;
  shares: number;
  likes: number;
  comments: number;
}>;

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : undefined;
}

async function fetchPlatformMetrics(job: NonNullable<SocialPostWithArticle>): Promise<PlatformMetrics | null> {
  if (!job.externalPostId || ["rss", "newsletter", "linkedin"].includes(job.platform)) return null;
  if (job.platform === "x") {
    const url = new URL(`https://api.x.com/2/tweets/${job.externalPostId}`);
    url.searchParams.set("tweet.fields", "public_metrics,non_public_metrics,organic_metrics");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.X_ACCESS_TOKEN || ""}` }
    });
    const payload = (await parseConnectorResponse(response)) as {
      data?: {
        public_metrics?: Record<string, unknown>;
        non_public_metrics?: Record<string, unknown>;
        organic_metrics?: Record<string, unknown>;
      };
    };
    if (!response.ok) throw new Error(String((payload as Record<string, unknown>).detail || "X metrics failed."));
    const metrics = {
      ...(payload.data?.public_metrics || {}),
      ...(payload.data?.non_public_metrics || {}),
      ...(payload.data?.organic_metrics || {})
    };
    return {
      clicks: numeric(metrics.url_link_clicks),
      impressions: numeric(metrics.impression_count),
      reach: numeric(metrics.impression_count),
      likes: numeric(metrics.like_count),
      comments: numeric(metrics.reply_count),
      shares:
        (numeric(metrics.retweet_count) || 0) + (numeric(metrics.quote_count) || 0)
    };
  }
  if (job.platform === "bluesky") {
    const url = new URL("https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts");
    url.searchParams.append("uris", job.externalPostId);
    const response = await fetch(url);
    const payload = (await parseConnectorResponse(response)) as {
      posts?: Array<{
        likeCount?: number;
        replyCount?: number;
        repostCount?: number;
        quoteCount?: number;
      }>;
    };
    if (!response.ok) throw new Error("Bluesky metrics failed.");
    const post = payload.posts?.[0];
    return post
      ? {
          likes: numeric(post.likeCount),
          comments: numeric(post.replyCount),
          shares: (numeric(post.repostCount) || 0) + (numeric(post.quoteCount) || 0)
        }
      : null;
  }
  if (job.platform === "facebook") {
    const version = process.env.FACEBOOK_GRAPH_API_VERSION?.trim();
    const graphBase = version
      ? `https://graph.facebook.com/${version}`
      : "https://graph.facebook.com";
    const url = new URL(`${graphBase}/${job.externalPostId}/insights`);
    url.searchParams.set("metric", "post_impressions,post_impressions_unique,post_engaged_users");
    url.searchParams.set("access_token", process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "");
    const response = await fetch(url);
    const payload = (await parseConnectorResponse(response)) as {
      data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
    };
    if (!response.ok) throw new Error("Facebook metrics failed.");
    const values = Object.fromEntries(
      (payload.data || []).map((item) => [item.name || "", item.values?.[0]?.value || 0])
    );
    return {
      impressions: numeric(values.post_impressions),
      reach: numeric(values.post_impressions_unique)
    };
  }
  if (job.platform === "threads") {
    const url = new URL(`https://graph.threads.net/v1.0/${job.externalPostId}/insights`);
    url.searchParams.set("metric", "views,likes,replies,reposts,quotes,shares");
    url.searchParams.set("access_token", process.env.THREADS_ACCESS_TOKEN || "");
    const response = await fetch(url);
    const payload = (await parseConnectorResponse(response)) as {
      data?: Array<{ name?: string; values?: Array<{ value?: number }> }>;
    };
    if (!response.ok) throw new Error("Threads metrics failed.");
    const values = Object.fromEntries(
      (payload.data || []).map((item) => [item.name || "", item.values?.[0]?.value || 0])
    );
    return {
      impressions: numeric(values.views),
      reach: numeric(values.views),
      likes: numeric(values.likes),
      comments: numeric(values.replies),
      shares:
        (numeric(values.reposts) || 0) +
        (numeric(values.quotes) || 0) +
        (numeric(values.shares) || 0)
    };
  }
  if (job.platform === "pinterest") {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60_000);
    const url = new URL(`https://api.pinterest.com/v5/pins/${job.externalPostId}/analytics`);
    url.searchParams.set("start_date", start.toISOString().slice(0, 10));
    url.searchParams.set("end_date", end.toISOString().slice(0, 10));
    url.searchParams.set("metric_types", "IMPRESSION,OUTBOUND_CLICK,SAVE");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN || ""}` }
    });
    const payload = (await parseConnectorResponse(response)) as {
      all?: { summary_metrics?: Record<string, number> };
      summary_metrics?: Record<string, number>;
    };
    if (!response.ok) throw new Error("Pinterest metrics failed.");
    const metrics = payload.all?.summary_metrics || payload.summary_metrics || {};
    return {
      clicks: numeric(metrics.OUTBOUND_CLICK),
      impressions: numeric(metrics.IMPRESSION),
      reach: numeric(metrics.IMPRESSION),
      shares: numeric(metrics.SAVE)
    };
  }
  return null;
}

export async function refreshSocialMetrics(limit = 30) {
  const jobs = await prisma.socialPost.findMany({
    where: {
      externalPostId: { not: null },
      platform: { in: ["facebook", "x", "threads", "pinterest", "bluesky"] }
    },
    orderBy: { lastPublishedAt: "desc" },
    take: limit,
    select: { id: true }
  });
  let updated = 0;
  let failed = 0;
  for (const row of jobs) {
    const job = await loadSocialPost(row.id);
    if (!job) continue;
    try {
      const metrics = await fetchPlatformMetrics(job);
      if (!metrics || Object.values(metrics).every((value) => value === undefined)) continue;
      const data = {
        clicks: Math.max(job.clicks, metrics.clicks ?? job.clicks),
        impressions: Math.max(job.impressions, metrics.impressions ?? job.impressions),
        reach: Math.max(job.reach, metrics.reach ?? job.reach),
        shares: Math.max(job.shares, metrics.shares ?? job.shares),
        likes: Math.max(job.likes, metrics.likes ?? job.likes),
        comments: Math.max(job.comments, metrics.comments ?? job.comments)
      };
      await prisma.socialPost.update({ where: { id: job.id }, data });
      await prisma.socialPostVariant.updateMany({
        where: { socialPostId: job.id, variantKey: job.selectedVariantKey },
        data: {
          impressions: data.impressions,
          reach: data.reach,
          shares: data.shares
        }
      });
      await recordAction({
        socialPostId: job.id,
        action: "metrics_sync",
        fromStatus: job.status,
        toStatus: job.status,
        message: "Verified platform metrics synchronized.",
        metadata: data
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      logError("social_metrics_sync_failed", error, { id: job.id, platform: job.platform });
    }
  }
  return { checked: jobs.length, updated, failed };
}

export async function recordSocialClick(id: string, variantKey?: string | null) {
  const job = await prisma.socialPost.update({
    where: { id },
    data: { clicks: { increment: 1 } },
    include: { article: { select: { slug: true, category: { select: { name: true } } } } }
  });
  if (variantKey) {
    await prisma.socialPostVariant.updateMany({
      where: { socialPostId: id, variantKey },
      data: { clicks: { increment: 1 } }
    });
    const variants = await prisma.socialPostVariant.findMany({
      where: { socialPostId: id, status: "active" },
      select: { id: true, clicks: true, impressions: true }
    });
    const ranked = variants
      .filter((variant) => variant.clicks > 0 || variant.impressions > 0)
      .sort((a, b) => {
        const aCtr = a.impressions > 0 ? a.clicks / a.impressions : a.clicks;
        const bCtr = b.impressions > 0 ? b.clicks / b.impressions : b.clicks;
        return bCtr - aCtr || b.clicks - a.clicks;
      });
    if (ranked[0]) {
      await prisma.$transaction([
        prisma.socialPostVariant.updateMany({
          where: { socialPostId: id },
          data: { isWinner: false }
        }),
        prisma.socialPostVariant.update({
          where: { id: ranked[0].id },
          data: { isWinner: true }
        })
      ]);
    }
  }
  await prisma.analyticsEvent
    .create({
      data: {
        eventName: "social_click",
        path: `/news/${job.article.slug}`,
        articleSlug: job.article.slug,
        category: job.article.category?.name || null,
        source: job.platform,
        metadata: stringify({
          socialPostId: id,
          platform: job.platform,
          variantKey: variantKey || job.selectedVariantKey
        })
      }
    })
    .catch((error) => logError("social_click_analytics_failed", error, { id }));
  return job;
}

export function socialAnalyticsSummary<
  T extends {
    clicks: number;
    impressions: number;
    shares?: number;
    likes?: number;
    comments?: number;
    reach?: number;
    platform?: string;
    publishedAt?: Date | null;
    lastPublishedAt?: Date | null;
  }
>(
  jobs: T[]
) {
  const clicks = jobs.reduce((sum, job) => sum + job.clicks, 0);
  const impressions = jobs.reduce((sum, job) => sum + job.impressions, 0);
  const shares = jobs.reduce((sum, job) => sum + (job.shares || 0), 0);
  const likes = jobs.reduce((sum, job) => sum + (job.likes || 0), 0);
  const comments = jobs.reduce((sum, job) => sum + (job.comments || 0), 0);
  const reach = jobs.reduce((sum, job) => sum + (job.reach || 0), 0);
  const engagement = clicks + shares + likes + comments;
  const platforms = jobs.reduce<Record<string, { clicks: number; engagement: number }>>(
    (accumulator, job) => {
      if (!job.platform) return accumulator;
      accumulator[job.platform] ||= { clicks: 0, engagement: 0 };
      accumulator[job.platform].clicks += job.clicks;
      accumulator[job.platform].engagement +=
        job.clicks + (job.shares || 0) + (job.likes || 0) + (job.comments || 0);
      return accumulator;
    },
    {}
  );
  const bestPlatform =
    Object.entries(platforms).sort(
      (a, b) => b[1].clicks - a[1].clicks || b[1].engagement - a[1].engagement
    )[0]?.[0] || null;
  const hours = jobs.reduce<Record<string, number>>((accumulator, job) => {
    const published = job.lastPublishedAt || job.publishedAt;
    if (!published || job.clicks <= 0) return accumulator;
    const hour = String(published.getUTCHours()).padStart(2, "0");
    accumulator[hour] = (accumulator[hour] || 0) + job.clicks;
    return accumulator;
  }, {});
  const bestPublishHour =
    Object.entries(hours).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return {
    clicks,
    impressions,
    reach,
    shares,
    likes,
    comments,
    engagement,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null,
    bestPlatform,
    bestPublishHour
  };
}
