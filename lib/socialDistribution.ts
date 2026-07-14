import { randomUUID } from "node:crypto";
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
  pinterestDescription: z.string().min(40).max(500),
  newsletterSubject: z.string().min(20).max(90),
  newsletterPreviewText: z.string().min(50).max(220),
  callToAction: z.string().min(8).max(80),
  shortSummary: z.string().min(50).max(260),
  hashtags: z.array(z.string().min(2).max(40)).min(2).max(8)
});

type SocialCopyBundle = z.infer<typeof SocialCopySchema>;

type SocialPostWithArticle = Awaited<ReturnType<typeof loadSocialPost>>;

type PublishResult =
  | { status: "published"; externalPostId?: string; destinationUrl?: string; note: string }
  | { status: "waiting_credentials" | "waiting_audience"; error: string; note: string };

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
    "Daily Signal Wire"
  ];
  return [...new Set(values.map(hashtag).filter(Boolean))].slice(0, 6);
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
  return {
    facebook: compact(post.facebookCaption || `${title}\n\n${summary}`, 850),
    twitter: compact(`${title} — ${summary}`, 245),
    threads: compact(`${title}\n\n${summary}`, 430),
    linkedin: compact(`${title}\n\n${summary}\n\nWhy it matters: readers get the full context, sources and editorial notes on ${siteName}.`, 1100),
    pinterestDescription: compact(`${title}: ${summary}`, 480),
    newsletterSubject: compact(title, 86),
    newsletterPreviewText: compact(summary, 200),
    callToAction: "Read the full story",
    shortSummary: compact(summary, 240),
    hashtags
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
        "You are the social distribution editor for Daily Signal Wire. Generate factual platform-specific promotion copy for an already-published article. Do not invent facts, quotes, numbers, organizations, or claims. Avoid clickbait. Keep the copy natural, concise, and newsroom-professional. Return JSON only.",
      input: JSON.stringify({
        title: post.title,
        subtitle: post.subtitle,
        excerpt: post.excerpt,
        summary: post.summary,
        seoDescription: post.seoDescription,
        category: post.category?.name,
        tags: parseStringArray(post.tags),
        articlePreview: compact(post.content, 1600)
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
    case "newsletter":
      return `${bundle.newsletterSubject}\n\n${bundle.newsletterPreviewText}`;
    case "rss":
      return bundle.shortSummary;
    default:
      return bundle.shortSummary;
  }
}

function renderCopy({
  platform,
  bundle,
  trackingUrl,
  maxLength
}: {
  platform: string;
  bundle: SocialCopyBundle;
  trackingUrl: string;
  maxLength: number;
}) {
  const base = pickPlatformCopy(platform, bundle);
  const hashtags =
    platform === "newsletter" || platform === "rss"
      ? ""
      : bundle.hashtags.slice(0, platform === "x" ? 2 : 5).join(" ");
  const cta = platform === "newsletter" || platform === "rss" ? "" : bundle.callToAction;
  const suffix = [cta, trackingUrl, hashtags].filter(Boolean).join("\n");
  const available = Math.max(24, maxLength - suffix.length - 4);
  return [compact(base, available), suffix].filter(Boolean).join("\n\n").trim();
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

function initialStatus(platform: string, scheduledAt?: Date | null) {
  if (platform === "rss") return "published";
  const credentials = socialCredentialStatus(platform);
  if (!credentials.configured) return "waiting_credentials";
  return scheduledAt ? "scheduled" : "queued";
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

export async function queueSocialPostsForArticle({
  articleId,
  platforms = socialPlatforms.map((item) => item.platform),
  scheduledAt = null,
  source = "auto"
}: {
  articleId: string;
  platforms?: string[];
  scheduledAt?: Date | null;
  source?: "auto" | "manual" | "publish_workflow";
}) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: articleId },
    include: { category: { select: { name: true, slug: true } } }
  });
  if (post.status !== "published") {
    throw new Error("Social posts can only be queued after an article is published.");
  }

  const copyBundle = await generateSocialCopy(post);
  const selectedPlatforms = [
    ...new Set(platforms.filter((platform) => platformDefinition(platform)))
  ];
  const image = primaryImage(post);
  const created = [];

  for (const platform of selectedPlatforms) {
    const definition = platformDefinition(platform)!;
    const existing = await prisma.socialPost.findUnique({
      where: { articleId_platform: { articleId, platform } }
    });
    if (existing?.status === "published") {
      created.push(existing);
      continue;
    }

    const id = existing?.id || randomUUID();
    const trackingUrl = absoluteUrl(`/api/social/click/${id}`);
    const destinationUrl = utmUrl(post.slug, platform, articleId);
    const status = initialStatus(platform, scheduledAt);
    const credentials = socialCredentialStatus(platform);
    const errorMessage =
      status === "waiting_credentials"
        ? `Waiting for credentials: ${credentials.missing.join(", ")}`
        : null;
    const payload = {
      source,
      platformLabel: definition.label,
      articleUrl: baseArticleUrl(post.slug),
      canonicalUrl: baseArticleUrl(post.slug),
      utmUrl: destinationUrl,
      trackingUrl,
      newsletterSubject: copyBundle.newsletterSubject,
      newsletterPreviewText: copyBundle.newsletterPreviewText,
      generatedBy: process.env.OPENAI_API_KEY ? "ai-social-copy-v1" : "deterministic-social-copy-v1"
    };
    const logs = stringify([
      logEntry(status, errorMessage || "Social post queued.", { source })
    ]);
    const data = {
      platform,
      status,
      scheduledAt: scheduledAt || null,
      publishedAt: platform === "rss" ? new Date() : null,
      retryCount: existing?.retryCount || 0,
      errorMessage,
      copy: renderCopy({
        platform,
        bundle: copyBundle,
        trackingUrl,
        maxLength: definition.maxLength
      }),
      hashtags: stringify(copyBundle.hashtags),
      shortSummary: copyBundle.shortSummary,
      callToAction: copyBundle.callToAction,
      utmUrl: destinationUrl,
      trackingUrl,
      openGraphImage: absoluteUrl(image),
      squareImage: absoluteUrl(`/api/social/image/${id}/square`),
      verticalImage: absoluteUrl(`/api/social/image/${id}/vertical`),
      payload: stringify(payload),
      logs,
      externalPostId: platform === "rss" ? absoluteUrl("/rss.xml") : null
    };

    created.push(
      await prisma.socialPost.upsert({
        where: { articleId_platform: { articleId, platform } },
        update: data,
        create: {
          id,
          articleId,
          ...data
        }
      })
    );
  }

  return created;
}

function loadSocialPost(id: string) {
  return prisma.socialPost.findUnique({
    where: { id },
    include: {
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

async function publishFacebook(job: NonNullable<SocialPostWithArticle>): Promise<PublishResult> {
  const version = process.env.FACEBOOK_GRAPH_API_VERSION || "v20.0";
  const body = new URLSearchParams({
    message: job.copy || "",
    link: job.trackingUrl || job.utmUrl || baseArticleUrl(job.article.slug),
    access_token: process.env.FACEBOOK_PAGE_ACCESS_TOKEN || ""
  });
  const response = await fetch(`https://graph.facebook.com/${version}/${process.env.FACEBOOK_PAGE_ID}/feed`, {
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
    body: JSON.stringify({ text: compact(job.copy || "", 280) })
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
  createUrl.searchParams.set("text", compact(job.copy || "", 500));
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
  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN || ""}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify({
      author: organizationUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: job.copy || "" },
          shareMediaCategory: "ARTICLE",
          media: [
            {
              status: "READY",
              originalUrl: job.trackingUrl || job.utmUrl,
              title: { text: job.article.title }
            }
          ]
        }
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
      }
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
  const response = await fetch("https://api.pinterest.com/v5/pins", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN || ""}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      board_id: process.env.PINTEREST_BOARD_ID,
      title: compact(job.article.title, 90),
      description: compact(job.copy || job.shortSummary || "", 500),
      link: job.trackingUrl || job.utmUrl,
      media_source: {
        source_type: "image_url",
        url: job.squareImage || job.openGraphImage
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
        text: compact(job.copy || "", 300),
        createdAt: new Date().toISOString()
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
    select: { email: true },
    take: 50
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
  const url = job.trackingUrl || job.utmUrl || baseArticleUrl(job.article.slug);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY || ""}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.NEWSLETTER_FROM_EMAIL,
      to: subscribers.map((subscriber) => subscriber.email),
      subject,
      html: `
        <p>${preview}</p>
        <p><a href="${url}">Read the full story</a></p>
        <p style="color:#6b7280;font-size:12px">${siteName}</p>
      `
    })
  });
  const result = await parseConnectorResponse(response);
  if (!response.ok) throw new Error(String(result.message || result.raw || "Newsletter send failed."));
  return {
    status: "published",
    externalPostId: String(result.id || ""),
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
  if (job.status === "published") return job;
  if (!options.manual && job.scheduledAt && job.scheduledAt > new Date()) return job;

  const publishingLogs = appendLogs(
    job.logs,
    logEntry("publishing", "Publishing attempt started.", { manual: Boolean(options.manual) })
  );
  await prisma.socialPost.update({
    where: { id },
    data: { status: "publishing", errorMessage: null, logs: publishingLogs }
  });

  try {
    const result = await runConnector(job);
    if (result.status !== "published") {
      return prisma.socialPost.update({
        where: { id },
        data: {
          status: result.status,
          errorMessage: result.error,
          logs: appendLogs(publishingLogs, logEntry(result.status, result.note))
        }
      });
    }
    const updated = await prisma.socialPost.update({
      where: { id },
      data: {
        status: "published",
        publishedAt: new Date(),
        errorMessage: null,
        externalPostId: result.externalPostId || job.externalPostId,
        logs: appendLogs(publishingLogs, logEntry("published", result.note))
      }
    });
    logInfo("social_post_published", { id, platform: job.platform, articleId: job.articleId });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Social publish failed.";
    logError("social_publish_failed", error, { id, platform: job.platform });
    return prisma.socialPost.update({
      where: { id },
      data: {
        status: "failed",
        retryCount: { increment: 1 },
        errorMessage: message.slice(0, 1000),
        logs: appendLogs(publishingLogs, logEntry("failed", message.slice(0, 1000)))
      }
    });
  }
}

export async function retrySocialPost(id: string) {
  const job = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
  return prisma.socialPost.update({
    where: { id },
    data: {
      status: job.scheduledAt && job.scheduledAt > new Date() ? "scheduled" : "queued",
      errorMessage: null,
      logs: appendLogs(job.logs, logEntry("queued", "Retry queued by editor."))
    }
  });
}

export async function cancelSocialPost(id: string) {
  const job = await prisma.socialPost.findUniqueOrThrow({ where: { id } });
  return prisma.socialPost.update({
    where: { id },
    data: {
      status: "cancelled",
      errorMessage: null,
      logs: appendLogs(job.logs, logEntry("cancelled", "Cancelled by editor."))
    }
  });
}

export async function processSocialQueue(limit = 40) {
  const now = new Date();
  const jobs = await prisma.socialPost.findMany({
    where: {
      OR: [
        { status: "queued" },
        { status: "waiting_credentials" },
        { status: "scheduled", scheduledAt: { lte: now } },
        { status: "failed", retryCount: { lt: 3 } }
      ]
    },
    orderBy: [{ scheduledAt: "asc" }, { updatedAt: "asc" }],
    take: limit
  });

  const results = [];
  for (const job of jobs) {
    results.push(await publishSocialPostNow(job.id));
  }
  return {
    checked: jobs.length,
    updated: results.length,
    results
  };
}

export async function recordSocialClick(id: string) {
  const job = await prisma.socialPost.update({
    where: { id },
    data: { clicks: { increment: 1 } },
    include: { article: { select: { slug: true, category: { select: { name: true } } } } }
  });
  await prisma.analyticsEvent
    .create({
      data: {
        eventName: "social_click",
        path: `/news/${job.article.slug}`,
        articleSlug: job.article.slug,
        category: job.article.category?.name || null,
        source: job.platform,
        metadata: stringify({ socialPostId: id, platform: job.platform })
      }
    })
    .catch((error) => logError("social_click_analytics_failed", error, { id }));
  return job;
}

export function socialAnalyticsSummary<T extends { clicks: number; impressions: number }>(
  jobs: T[]
) {
  const clicks = jobs.reduce((sum, job) => sum + job.clicks, 0);
  const impressions = jobs.reduce((sum, job) => sum + job.impressions, 0);
  return {
    clicks,
    impressions,
    ctr: impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0
  };
}
