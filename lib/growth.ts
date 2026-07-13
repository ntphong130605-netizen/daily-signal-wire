import { prisma } from "@/lib/prisma";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { absoluteUrl } from "@/lib/site";
import { slugify } from "@/lib/slug";

type Check = {
  key: string;
  label: string;
  ok: boolean;
  score: number;
  max: number;
  message: string;
};

type PublishablePost = {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  content: string;
  seoTitle: string;
  seoDescription: string;
  openGraphDescription?: string | null;
  tags: string;
  faq: string;
  sourceUrls: string;
  internalLinkSuggestions: string;
  imageStatus: string;
  imageUrl?: string | null;
  featuredImageUrl?: string | null;
  featuredImage?: string | null;
  thumbnailImage?: string | null;
  openGraphImage?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
  category?: { name: string; slug: string } | null;
  publishedAt?: Date | null;
  updatedAt: Date;
  createdAt: Date;
};

type PlannerCandidate = {
  topic: string;
  category: string;
  sourceType: string;
  sourceId?: string | null;
  keywords: string[];
  angle: string;
};

const evergreenTopics = [
  {
    topic: "How readers can spot weak sourcing in fast-moving stories",
    category: "Media Literacy",
    keywords: ["source review", "news literacy", "fact checking"],
    angle: "A practical evergreen guide for readers and newsletter subscribers."
  },
  {
    topic: "What Google Trends can and cannot tell newsrooms",
    category: "Technology",
    keywords: ["Google Trends", "search interest", "newsroom analytics"],
    angle: "Explain trends as editorial signals, not proof of importance."
  },
  {
    topic: "Why AI-generated images need clear editorial disclosure",
    category: "Technology",
    keywords: ["AI images", "editorial disclosure", "news trust"],
    angle: "Turn the newsroom policy into a reader-facing transparency story."
  },
  {
    topic: "A weekly guide to the US stories people searched for most",
    category: "US News",
    keywords: ["US trends", "weekly search trends", "reader interest"],
    angle: "Recurring search-led roundup with source-first context."
  }
];

export const distributionPlatforms = [
  {
    platform: "facebook",
    label: "Facebook",
    credentialKeys: ["FACEBOOK_PAGE_ACCESS_TOKEN", "FACEBOOK_PAGE_ID"]
  },
  {
    platform: "x",
    label: "X (Twitter)",
    credentialKeys: ["X_API_KEY", "X_ACCESS_TOKEN"]
  },
  {
    platform: "linkedin",
    label: "LinkedIn",
    credentialKeys: ["LINKEDIN_ACCESS_TOKEN"]
  },
  {
    platform: "pinterest",
    label: "Pinterest",
    credentialKeys: ["PINTEREST_ACCESS_TOKEN"]
  },
  {
    platform: "threads",
    label: "Threads",
    credentialKeys: ["THREADS_ACCESS_TOKEN"]
  },
  {
    platform: "bluesky",
    label: "Bluesky",
    credentialKeys: ["BLUESKY_IDENTIFIER", "BLUESKY_APP_PASSWORD"]
  },
  {
    platform: "rss",
    label: "RSS",
    credentialKeys: []
  },
  {
    platform: "newsletter",
    label: "Email Newsletter",
    credentialKeys: ["RESEND_API_KEY", "NEWSLETTER_FROM_EMAIL"]
  }
] as const;

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function wordCount(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function addCheck(
  checks: Check[],
  key: string,
  label: string,
  ok: boolean,
  max: number,
  message: string
) {
  checks.push({ key, label, ok, score: ok ? max : 0, max, message });
}

function postImage(post: PublishablePost) {
  return (
    post.openGraphImage ||
    post.featuredImageUrl ||
    post.featuredImage ||
    post.imageUrl ||
    post.thumbnailImage ||
    ""
  );
}

function linkCounts(content: string) {
  const markdownLinks = [...content.matchAll(/\[[^\]]+\]\((https?:\/\/[^)]+|\/[^)]+)\)/g)].map(
    (match) => match[1]
  );
  const rawLinks = [...content.matchAll(/https?:\/\/[^\s)]+/g)].map((match) => match[0]);
  const links = [...new Set([...markdownLinks, ...rawLinks])];
  return {
    links,
    internal: links.filter((link) => link.startsWith("/") || link.includes("daily-signal-wire")),
    external: links.filter((link) => /^https?:\/\//.test(link) && !link.includes("daily-signal-wire"))
  };
}

function keywordFromPost(post: PublishablePost) {
  const tags = parseStringArray(post.tags);
  return tags[0] || post.category?.name || post.title.split(/\s+/).slice(0, 2).join(" ");
}

function keywordDensity(content: string, keyword: string) {
  const normalized = content.toLowerCase();
  const key = keyword.toLowerCase().trim();
  if (!key) return 0;
  const occurrences = normalized.split(key).length - 1;
  const words = Math.max(1, wordCount(content));
  return (occurrences / words) * 100;
}

function repeatedParagraphRisk(content: string) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 80);
  return new Set(paragraphs).size < paragraphs.length;
}

export function scoreSeo(post: PublishablePost) {
  const checks: Check[] = [];
  const words = wordCount(post.content);
  const tags = parseStringArray(post.tags);
  const faq = parseJsonArray(post.faq);
  const sources = parseStringArray(post.sourceUrls);
  const internalLinks = parseJsonArray(post.internalLinkSuggestions);
  const links = linkCounts(post.content);
  const keyword = keywordFromPost(post);
  const density = keywordDensity(`${post.title} ${post.excerpt} ${post.content}`, keyword);
  const image = postImage(post);

  addCheck(
    checks,
    "headline",
    "Headline length",
    post.title.length >= 45 && post.title.length <= 100,
    10,
    "Use a clear headline between 45 and 100 characters."
  );
  addCheck(
    checks,
    "meta",
    "Meta description",
    post.seoDescription.length >= 110 && post.seoDescription.length <= 170,
    12,
    "Meta description should be specific and around 110-170 characters."
  );
  addCheck(
    checks,
    "slug",
    "Readable slug",
    post.slug.length <= 80 && !post.slug.includes("_"),
    8,
    "Slug should be concise, readable and hyphenated."
  );
  addCheck(
    checks,
    "content_depth",
    "Content depth",
    words >= 500,
    12,
    "Article should have enough original reporting depth."
  );
  addCheck(
    checks,
    "keyword_density",
    "Keyword density",
    density >= 0.2 && density <= 3.5,
    8,
    "Primary keyword should appear naturally without stuffing."
  );
  addCheck(
    checks,
    "internal_links",
    "Internal links",
    internalLinks.length > 0 || links.internal.length > 0,
    10,
    "Add at least one relevant internal link suggestion or internal body link."
  );
  addCheck(
    checks,
    "external_sources",
    "External/source links",
    sources.length > 0 || links.external.length > 0,
    10,
    "Save source URLs or cite external references for editor verification."
  );
  addCheck(
    checks,
    "schema_inputs",
    "Schema inputs",
    Boolean(post.seoTitle && post.seoDescription && post.category?.name && faq.length >= 1),
    10,
    "Schema needs SEO fields, category and FAQ/source context where applicable."
  );
  addCheck(
    checks,
    "image_seo",
    "Image SEO",
    Boolean(image && post.imageAlt && post.imageCaption),
    10,
    "Featured image, alt text and caption should be complete."
  );
  addCheck(
    checks,
    "duplicate",
    "Duplicate content risk",
    !repeatedParagraphRisk(post.content),
    10,
    "Remove repeated paragraphs or duplicated blocks."
  );

  const score = clamp(Math.round(checks.reduce((sum, check) => sum + check.score, 0)));
  const suggestions = checks
    .filter((check) => !check.ok)
    .map((check) => check.message);

  return {
    score,
    keyword,
    checks,
    suggestions,
    keywords: [...new Set([keyword, ...tags])].filter(Boolean).slice(0, 12),
    duplicateRisk: repeatedParagraphRisk(post.content) ? "medium" : "low",
    thinContent: words < 500,
    brokenLinks: [] as string[],
    metadata: {
      words,
      density,
      canonical: absoluteUrl(`/news/${post.slug}`),
      internalLinks: links.internal.length + internalLinks.length,
      externalLinks: links.external.length,
      analyzedBy: "deterministic-seo-v1"
    }
  };
}

export function scoreDiscover(post: PublishablePost) {
  const image = postImage(post);
  const tags = parseStringArray(post.tags);
  const sources = parseStringArray(post.sourceUrls);
  const published = post.publishedAt || post.updatedAt || post.createdAt;
  const ageHours = Math.max(0, (Date.now() - published.getTime()) / 36e5);
  const freshnessScore = clamp(Math.round(100 - Math.min(72, ageHours)));
  const entityScore = clamp(tags.length * 14 + sources.length * 8 + (post.category?.name ? 18 : 0));
  const imageScore = image && post.imageAlt ? 100 : image ? 60 : 0;
  const headlineScore = post.title.length >= 45 && post.title.length <= 95 ? 90 : 62;
  const score = clamp(Math.round((freshnessScore * 0.25) + (entityScore * 0.25) + (imageScore * 0.3) + (headlineScore * 0.2)));
  const category = post.category?.name || "Latest";
  const headlineRoot = post.title.replace(/[!?]+$/g, "");
  const headlineVariations = [
    `${headlineRoot}: What to know now`,
    `Why ${headlineRoot.charAt(0).toLowerCase()}${headlineRoot.slice(1)} matters`,
    `${category} watch: ${headlineRoot}`
  ].slice(0, 3);
  const suggestions = [
    imageScore < 100 ? "Use a large, high-quality 16:9 image with alt text." : "",
    freshnessScore < 60 ? "Refresh the article with updated context or a clearer modified date." : "",
    entityScore < 60 ? "Add specific entities, tags and source context to improve topical clarity." : "",
    headlineScore < 80 ? "Test a clearer headline between 45 and 95 characters." : ""
  ].filter(Boolean);

  return {
    score,
    freshnessScore,
    entityScore,
    imageScore,
    largePreviewReady: Boolean(image && post.imageAlt),
    headlineVariations,
    suggestions,
    metadata: {
      category,
      ageHours,
      tags,
      sourceCount: sources.length,
      image,
      analyzedBy: "discover-optimizer-v1"
    }
  };
}

export async function analyzeSeoForPost(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { category: { select: { name: true, slug: true } } }
  });
  const result = scoreSeo(post);
  return prisma.seoAudit.create({
    data: {
      postId,
      score: result.score,
      keyword: result.keyword,
      checks: json(result.checks),
      suggestions: json(result.suggestions),
      keywords: json(result.keywords),
      duplicateRisk: result.duplicateRisk,
      thinContent: result.thinContent,
      brokenLinks: json(result.brokenLinks),
      metadata: json(result.metadata)
    }
  });
}

export async function analyzeDiscoverForPost(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { category: { select: { name: true, slug: true } } }
  });
  const result = scoreDiscover(post);
  return prisma.discoverAudit.create({
    data: {
      postId,
      score: result.score,
      freshnessScore: result.freshnessScore,
      entityScore: result.entityScore,
      imageScore: result.imageScore,
      largePreviewReady: result.largePreviewReady,
      headlineVariations: json(result.headlineVariations),
      suggestions: json(result.suggestions),
      metadata: json(result.metadata)
    }
  });
}

export function channelConfigured(platform: string) {
  const channel = distributionPlatforms.find((item) => item.platform === platform);
  if (!channel) return false;
  if (channel.credentialKeys.length === 0) return true;
  return channel.credentialKeys.every((key) => Boolean(process.env[key]?.trim()));
}

export async function ensureDistributionChannels() {
  return Promise.all(
    distributionPlatforms.map((channel) => {
      const configured = channelConfigured(channel.platform);
      return prisma.distributionChannel.upsert({
        where: { platform: channel.platform },
        update: {
          label: channel.label,
          enabled: configured,
          status: configured ? "ready" : "not_configured",
          configStatus: configured ? "configured" : "missing_credentials",
          lastCheckedAt: new Date(),
          metadata: json({ credentialKeys: channel.credentialKeys })
        },
        create: {
          platform: channel.platform,
          label: channel.label,
          enabled: configured,
          status: configured ? "ready" : "not_configured",
          configStatus: configured ? "configured" : "missing_credentials",
          lastCheckedAt: new Date(),
          metadata: json({ credentialKeys: channel.credentialKeys })
        }
      });
    })
  );
}

export async function createDistributionJobs({
  postId,
  platforms,
  mode,
  scheduledAt
}: {
  postId: string;
  platforms: string[];
  mode: "manual" | "scheduled" | "auto";
  scheduledAt?: Date | null;
}) {
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  const channels = await ensureDistributionChannels();
  const created = [];
  for (const platform of platforms) {
    const channel = channels.find((item) => item.platform === platform);
    const configured = channelConfigured(platform);
    const status =
      platform === "rss"
        ? post.status === "published"
          ? "published"
          : "waiting_for_article_publish"
        : configured
          ? mode === "scheduled"
            ? "scheduled"
            : "ready"
          : "blocked";
    const lastError = configured || platform === "rss"
      ? null
      : `${platform} OAuth/API credentials are not configured.`;
    created.push(
      await prisma.distributionPublish.create({
        data: {
          postId,
          channelId: channel?.id,
          platform,
          mode,
          status,
          scheduledAt: mode === "scheduled" ? scheduledAt || null : null,
          publishedAt: status === "published" ? new Date() : null,
          lastError,
          destinationUrl:
            platform === "rss" && post.status === "published"
              ? absoluteUrl(`/news/${post.slug}`)
              : null,
          message: `${post.title}\n\n${post.facebookCaption || post.excerpt}\n\nRead full story:\n${absoluteUrl(`/news/${post.slug}`)}`,
          payload: json({ postId, slug: post.slug, title: post.title }),
          history: json([
            {
              at: new Date().toISOString(),
              status,
              note: lastError || "Distribution job created."
            }
          ])
        }
      })
    );
  }
  return created;
}

export async function retryDistributionJob(id: string) {
  const job = await prisma.distributionPublish.findUniqueOrThrow({ where: { id } });
  const configured = channelConfigured(job.platform);
  const status = configured || job.platform === "rss" ? "queued" : "blocked";
  const history = parseJsonArray(job.history);
  history.unshift({
    at: new Date().toISOString(),
    status,
    note: configured ? "Retry queued." : "Retry blocked; credentials still missing."
  });
  return prisma.distributionPublish.update({
    where: { id },
    data: {
      status,
      retryCount: { increment: 1 },
      lastError: configured ? null : `${job.platform} OAuth/API credentials are not configured.`,
      history: json(history.slice(0, 30))
    }
  });
}

export async function processDistributionQueue() {
  await ensureDistributionChannels();
  const now = new Date();
  const jobs = await prisma.distributionPublish.findMany({
    where: {
      status: { in: ["scheduled", "queued", "ready", "waiting_for_article_publish"] },
      OR: [{ scheduledAt: null }, { scheduledAt: { lte: now } }]
    },
    include: { post: { select: { id: true, title: true, slug: true, status: true } } },
    orderBy: { scheduledAt: "asc" },
    take: 50
  });
  const results = [];
  for (const job of jobs) {
    const history = parseJsonArray(job.history);
    if (!job.post) {
      results.push(
        await prisma.distributionPublish.update({
          where: { id: job.id },
          data: {
            status: "failed",
            lastError: "Post no longer exists.",
            history: json([
              { at: now.toISOString(), status: "failed", note: "Post no longer exists." },
              ...history
            ].slice(0, 30))
          }
        })
      );
      continue;
    }
    if (job.platform === "rss") {
      const published = job.post.status === "published";
      results.push(
        await prisma.distributionPublish.update({
          where: { id: job.id },
          data: {
            status: published ? "published" : "waiting_for_article_publish",
            publishedAt: published ? now : null,
            destinationUrl: published ? absoluteUrl(`/news/${job.post.slug}`) : null,
            lastError: published ? null : "RSS item waits until the article is published.",
            history: json([
              {
                at: now.toISOString(),
                status: published ? "published" : "waiting_for_article_publish",
                note: published
                  ? "RSS distribution is live through /rss.xml."
                  : "RSS item waits until the article is published."
              },
              ...history
            ].slice(0, 30))
          }
        })
      );
      continue;
    }
    const configured = channelConfigured(job.platform);
    results.push(
      await prisma.distributionPublish.update({
        where: { id: job.id },
        data: {
          status: configured ? "ready" : "blocked",
          lastError: configured
            ? "Official publisher worker is ready but not executed from this safe queue."
            : `${job.platform} OAuth/API credentials are not configured.`,
          history: json([
            {
              at: now.toISOString(),
              status: configured ? "ready" : "blocked",
              note: configured
                ? "Credentials detected; publish using the approved channel worker or manual action."
                : "Missing official API credentials."
            },
            ...history
          ].slice(0, 30))
        }
      })
    );
  }
  return {
    checked: jobs.length,
    updated: results.length,
    results
  };
}

export async function generateContentPlan(days = 7) {
  const now = new Date();
  const trends = await prisma.trend.findMany({
    orderBy: { discoveredAt: "desc" },
    take: days * 2
  });
  const categories = await prisma.category.findMany({ take: 20, orderBy: { name: "asc" } });
  const candidates: PlannerCandidate[] = [
    ...trends.map((trend) => ({
      topic: trend.keyword,
      category: trend.category || "US News",
      sourceType: "google_trends",
      sourceId: trend.id,
      keywords: [trend.keyword, ...parseStringArray(trend.relatedQueries).slice(0, 3)],
      angle: "Source-first article based on US search demand."
    })),
    ...evergreenTopics.map((topic) => ({
      ...topic,
      sourceType: "evergreen",
      sourceId: null
    })),
    ...categories.slice(0, 4).map((category) => ({
      topic: `What readers should watch next in ${category.name}`,
      category: category.name,
      sourceType: "category_balance",
      sourceId: category.id,
      keywords: [category.name],
      angle: "Category balance assignment for a healthy publishing mix."
    }))
  ];

  const created = [];
  for (let index = 0; index < Math.min(days * 3, candidates.length); index += 1) {
    const item = candidates[index];
    const plannedFor = new Date(now);
    plannedFor.setDate(now.getDate() + Math.floor(index / 3));
    plannedFor.setHours(9 + (index % 3) * 4, 0, 0, 0);
    const existing = await prisma.contentPlanItem.findFirst({
      where: {
        topic: item.topic,
        plannedFor: {
          gte: new Date(plannedFor.getTime() - 12 * 36e5),
          lte: new Date(plannedFor.getTime() + 12 * 36e5)
        }
      }
    });
    if (existing) continue;
    created.push(
      await prisma.contentPlanItem.create({
        data: {
          topic: item.topic,
          slug: slugify(item.topic),
          category: item.category,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
          priority: item.sourceType === "google_trends" ? 1 : 3,
          plannedFor,
          timezone: process.env.EDITORIAL_TIMEZONE || "America/New_York",
          angle: item.angle,
          targetKeywords: json(item.keywords),
          metadata: json({ generatedBy: "content-planner-v1" })
        }
      })
    );
  }
  return created;
}

export async function systemChecks() {
  const [dbOk, publishingQueue, failedPublishes, distributionBlocked, plannerUpcoming, searchIndex, latestResearchRun] =
    await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      prisma.post.count({ where: { status: "scheduled" } }).catch(() => 0),
      prisma.post.count({ where: { publishError: { not: null } } }).catch(() => 0),
      prisma.distributionPublish.count({ where: { status: { in: ["blocked", "failed"] } } }).catch(() => 0),
      prisma.contentPlanItem.count({ where: { plannedFor: { gte: new Date() } } }).catch(() => 0),
      prisma.post.count({ where: { status: "published" } }).catch(() => 0),
      prisma.researchRun.findFirst({ orderBy: { startedAt: "desc" } }).catch(() => null)
    ]);

  return [
    {
      key: "database",
      label: "Database",
      status: dbOk ? "healthy" : "failed",
      message: dbOk ? "Database query succeeded." : "Database query failed."
    },
    {
      key: "publishing_queue",
      label: "Publishing Queue",
      status: failedPublishes > 0 ? "warning" : "healthy",
      message: `${publishingQueue} scheduled, ${failedPublishes} failed publishes.`
    },
    {
      key: "content_planner",
      label: "Content Planner",
      status: plannerUpcoming > 0 ? "healthy" : "empty",
      message: `${plannerUpcoming} upcoming planned assignments.`
    },
    {
      key: "distribution_queue",
      label: "Distribution Queue",
      status: distributionBlocked > 0 ? "warning" : "healthy",
      message: `${distributionBlocked} blocked or failed distribution jobs.`
    },
    {
      key: "openai",
      label: "OpenAI",
      status: process.env.OPENAI_API_KEY ? "configured" : "not_configured",
      message: process.env.OPENAI_API_KEY
        ? "OPENAI_API_KEY is configured."
        : "OPENAI_API_KEY is missing; AI actions are disabled."
    },
    {
      key: "blob_storage",
      label: "Blob Storage",
      status: process.env.BLOB_READ_WRITE_TOKEN ? "configured" : "not_configured",
      message: process.env.BLOB_READ_WRITE_TOKEN
        ? "Vercel Blob token is configured."
        : "Image storage token is missing; generation may fall back or fail."
    },
    {
      key: "search_index",
      label: "Search Index",
      status: searchIndex > 0 ? "healthy" : "empty",
      message: `${searchIndex} published posts available to search.`
    },
    {
      key: "adsense",
      label: "AdSense",
      status: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ? "configured" : "not_configured",
      message: process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID
        ? "AdSense client ID is configured."
        : "AdSense client ID is not configured."
    },
    {
      key: "analytics",
      label: "Google Analytics",
      status: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? "configured" : "not_configured",
      message: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
        ? "GA4 measurement ID is configured."
        : "GA4 measurement ID is not configured."
    },
    {
      key: "cron_research",
      label: "Research Cron",
      status: latestResearchRun?.status === "completed" ? "healthy" : "unknown",
      message: latestResearchRun
        ? `Last research run: ${latestResearchRun.status}.`
        : "No research cron run recorded yet."
    }
  ];
}

export function estimatedRevenue(pageviews: number) {
  const rpm = Number(process.env.ADSENSE_ESTIMATED_RPM || "");
  if (!Number.isFinite(rpm) || rpm <= 0) return { rpm: null, revenue: null };
  return { rpm, revenue: (pageviews / 1000) * rpm };
}
