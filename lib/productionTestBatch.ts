import { parseJsonArray, parseStringArray } from "@/lib/json";
import { generateImageForPost } from "@/lib/aiImage";
import { generateJournalistDraftFromResearch } from "@/lib/aiJournalistDraft";
import { logError, logInfo } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { approvePost, recordStatusEvent, rejectPost, schedulePost } from "@/lib/publishing";
import { runResearchEngine } from "@/lib/research/engine";
import { absoluteUrl } from "@/lib/site";

export const TEST_BATCH_TIMEZONE = "America/New_York";
export const TEST_BATCH_SLOTS = [
  "08:00",
  "09:30",
  "11:00",
  "12:30",
  "14:00",
  "15:30",
  "17:00",
  "18:30",
  "20:00",
  "21:30"
] as const;

const MAX_ARTICLES = 10;
const ARTICLE_GENERATION_LIMIT = 10;
const IMAGE_GENERATION_LIMIT = 10;
const IMAGE_RETRY_LIMIT = 2;

type CandidateWithSources = Awaited<ReturnType<typeof eligibleCandidates>>[number];

function json(value: unknown) {
  return JSON.stringify(value ?? null);
}

function safeObject(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function ymdInTimezone(date: Date, timezone = TEST_BATCH_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function tomorrowInEditorialTimezone(now = new Date()) {
  const today = ymdInTimezone(now);
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function zonedDateTimeToUtc(dateKey: string, time: string, timezone = TEST_BATCH_TIMEZONE) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = desired;

  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(guess));
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value || 0);
    const represented = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second")
    );
    guess += desired - represented;
  }
  return new Date(guess);
}

function cleanDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function normalizeWords(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
}

function similarity(left: string, right: string) {
  const a = new Set(normalizeWords(left));
  const b = new Set(normalizeWords(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / Math.max(1, Math.min(a.size, b.size));
}

function categoryBucket(category: string) {
  const value = category.toLowerCase();
  if (/technology|tech|artificial intelligence|software|cyber/.test(value)) return "Technology";
  if (/business|finance|money|economy|market/.test(value)) return "Business";
  if (/us news|united states|national|politic/.test(value)) return "US News";
  if (/world|international|global/.test(value)) return "World";
  if (/science|health|medicine|medical/.test(value)) return "Science or Health";
  if (/sport/.test(value)) return "Sports";
  if (/entertainment|culture|movie|music|television/.test(value)) return "Entertainment";
  if (/lifestyle|travel|food/.test(value)) return "Lifestyle or Travel";
  return null;
}

const CATEGORY_LIMITS = new Map<string, number>([
  ["Technology", 2],
  ["Business", 2],
  ["US News", 1],
  ["World", 1],
  ["Science or Health", 1],
  ["Sports", 1],
  ["Entertainment", 1],
  ["Lifestyle or Travel", 1]
]);

async function eligibleCandidates() {
  return prisma.researchCandidate.findMany({
    where: {
      region: "US",
      language: "en-US",
      trendScore: { gte: 65 },
      recommendedAction: "generate_draft",
      riskLevel: { in: ["low", "medium"] },
      sources: { some: {} }
    },
    include: {
      brief: true,
      sources: { orderBy: [{ credibilityTier: "asc" }, { publishedAt: "desc" }] }
    },
    orderBy: [{ lastSeenAt: "desc" }, { trendScore: "desc" }],
    take: 200
  });
}

async function selectCandidatesForBatch(candidates: CandidateWithSources[]) {
  const existingPosts = await prisma.post.findMany({
    where: {
      OR: [
        { researchCandidateId: { not: null } },
        { status: "published" }
      ]
    },
    select: { researchCandidateId: true, title: true, slug: true, status: true }
  });
  const usedCandidateIds = new Set(
    existingPosts.map((post) => post.researchCandidateId).filter((id): id is string => Boolean(id))
  );
  const publishedTitles = existingPosts
    .filter((post) => post.status === "published")
    .map((post) => post.title);
  const bucketCounts = new Map<string, number>();
  const selected: Array<CandidateWithSources & { bucket: string; domains: string[] }> = [];

  for (const candidate of candidates) {
    if (selected.length >= MAX_ARTICLES || usedCandidateIds.has(candidate.id)) continue;
    const domains = Array.from(
      new Set(
        candidate.sources
          .map((source) => cleanDomain(source.canonicalUrl || source.sourceUrl))
          .filter(Boolean)
      )
    );
    if (domains.length < 2) continue;
    const bucket = categoryBucket(candidate.category);
    if (!bucket) continue;
    if ((bucketCounts.get(bucket) || 0) >= (CATEGORY_LIMITS.get(bucket) || 0)) continue;
    if (publishedTitles.some((title) => similarity(candidate.topic, title) >= 0.72)) continue;
    if (selected.some((item) => similarity(candidate.topic, item.topic) >= 0.72)) continue;

    selected.push({ ...candidate, bucket, domains });
    bucketCounts.set(bucket, (bucketCounts.get(bucket) || 0) + 1);
  }

  return selected;
}

function tokenCost(tokenUsage: string | null | undefined) {
  const usage = safeObject(tokenUsage);
  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const inputRate = Number(process.env.AI_INPUT_COST_PER_MILLION_USD || "");
  const outputRate = Number(process.env.AI_OUTPUT_COST_PER_MILLION_USD || "");
  if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) return null;
  return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
}

function sumKnownCosts(costs: Array<number | null | undefined>) {
  const known = costs.filter((cost): cost is number => typeof cost === "number" && Number.isFinite(cost));
  return known.length ? known.reduce((total, cost) => total + cost, 0) : null;
}

function countWords(value: string) {
  return value
    .replace(/[#*_>`\[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function criticalFactCheckErrors(post: {
  factCheckStatus: string;
  trustScore: number | null;
  sourceDiversityScore: number | null;
  factCheckWarnings: string;
}) {
  const errors: string[] = [];
  const warnings = parseJsonArray<{
    type?: string;
    severity?: string;
    message?: string;
    claim?: string;
  }>(post.factCheckWarnings);
  if (!["Verified", "Approved"].includes(post.factCheckStatus)) {
    errors.push(`Fact-check status is ${post.factCheckStatus}.`);
  }
  if ((post.trustScore || 0) < 75) errors.push("Trust score is below 75.");
  if ((post.sourceDiversityScore || 0) < 50) errors.push("Source diversity score is below 50.");
  const critical = warnings.filter(
    (warning) =>
      warning.severity === "high" &&
      ["unsupported_claim", "possible_hallucination", "source_disagreement"].includes(
        warning.type || ""
      )
  );
  if (critical.length) {
    errors.push(...critical.map((warning) => warning.message || "Critical fact-check warning."));
  }
  const fabricatedQuote = warnings.some((warning) =>
    /fabricated|invented|unsupported quote|quote cannot be verified/i.test(
      `${warning.message || ""} ${warning.claim || ""}`
    )
  );
  if (fabricatedQuote) errors.push("A potentially fabricated quote was detected.");
  return errors;
}

async function validateGeneratedPost(postId: string) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { category: { select: { name: true } } }
  });
  const errors = criticalFactCheckErrors(post);
  const words = countWords(post.content);
  if (words < 800 || words > 1200) errors.push(`Article length is ${words} words; target is 800–1,200.`);
  if (!post.slug.trim()) errors.push("Slug is missing.");
  const slugCount = await prisma.post.count({ where: { slug: post.slug, NOT: { id: post.id } } });
  if (slugCount > 0) errors.push("Slug is not unique.");
  if (!post.seoTitle.trim() || !post.seoDescription.trim()) errors.push("SEO metadata is incomplete.");
  if (!post.openGraphDescription?.trim()) errors.push("OpenGraph description is missing.");
  if (!post.openGraphImage?.trim() && !post.featuredImageUrl?.trim()) errors.push("OpenGraph image is missing.");
  if (!post.twitterImage?.trim() && !post.featuredImageUrl?.trim()) errors.push("Twitter card image is missing.");
  if (!post.featuredImageUrl?.trim() && !post.featuredImage?.trim()) errors.push("Hero image is missing.");
  if (!post.imageAlt?.trim()) errors.push("Image alt text is missing.");
  if (!post.imageCaption?.trim()) errors.push("Image caption is missing.");
  if (!["completed", "accepted"].includes(post.imageStatus)) errors.push("Hero image is not complete.");
  if (post.imageSourceType === "ai" && !post.imageDisclosure?.trim()) {
    errors.push("AI image disclosure is missing.");
  }
  if (parseStringArray(post.sourceUrls).length < 2) errors.push("At least two sources are required.");
  if (parseStringArray(post.tags).length < 3) errors.push("At least three tags are required.");
  if (parseJsonArray(post.faq).length < 3) errors.push("At least three FAQ entries are required.");
  const canonical = absoluteUrl(`/news/${post.slug}`);
  if (!canonical.startsWith("https://") || canonical.includes("localhost")) {
    errors.push("Canonical URL is not production-safe.");
  }

  const comparablePosts = await prisma.post.findMany({
    where: { status: "published", NOT: { id: post.id } },
    select: { title: true },
    take: 500
  });
  if (comparablePosts.some((published) => similarity(post.title, published.title) >= 0.8)) {
    errors.push("Possible duplicate of an existing published article.");
  }
  return { post, errors: Array.from(new Set(errors)), wordCount: words, canonical };
}

async function refreshBatchCost(batchId: string) {
  const items = await prisma.productionTestItem.findMany({
    where: { batchId },
    select: { estimatedAiCostUsd: true }
  });
  const cost = sumKnownCosts(items.map((item) => item.estimatedAiCostUsd));
  await prisma.productionTestBatch.update({
    where: { id: batchId },
    data: { estimatedAiCostUsd: cost }
  });
  return cost;
}

export async function createOneTimeProductionTestBatch() {
  const targetDate = tomorrowInEditorialTimezone();
  const existing = await prisma.productionTestBatch.findFirst({
    where: { targetDate, status: { notIn: ["cancelled"] } },
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  if (existing && existing.items.length > 0) {
    return { batch: existing, reused: true, research: null };
  }

  const research = await runResearchEngine();
  const selected = await selectCandidatesForBatch(await eligibleCandidates());
  const batchData = {
    targetDate,
    timezone: TEST_BATCH_TIMEZONE,
    status: selected.length ? "ready" : "empty",
    maxArticles: MAX_ARTICLES,
    articleGenerationLimit: ARTICLE_GENERATION_LIMIT,
    imageGenerationLimit: IMAGE_GENERATION_LIMIT,
    imageRetryLimit: IMAGE_RETRY_LIMIT,
    researchRunId: research.runId,
    sourceSummary: json(research.sourceStatuses || {}),
    errorSummary: selected.length ? null : "No new research candidates passed every safety filter."
  };
  const itemData = selected.map((candidate, position) => ({
    researchCandidateId: candidate.id,
    position,
    topic: candidate.topic,
    category: candidate.bucket,
    trendScore: candidate.trendScore,
    sourceCount: candidate.domains.length,
    sourceDomains: json(candidate.domains),
    plannedPublishAt: zonedDateTimeToUtc(
      targetDate,
      TEST_BATCH_SLOTS[position],
      TEST_BATCH_TIMEZONE
    )
  }));
  const batch = existing
    ? await prisma.productionTestBatch.update({
        where: { id: existing.id },
        data: {
          ...batchData,
          completedAt: null,
          cancelledAt: null,
          items: { create: itemData }
        },
        include: { items: { orderBy: { position: "asc" } } }
      })
    : await prisma.productionTestBatch.create({
        data: { ...batchData, items: { create: itemData } },
        include: { items: { orderBy: { position: "asc" } } }
      });
  logInfo("production_test_batch_created", {
    batchId: batch.id,
    targetDate,
    selected: selected.length,
    researchRunId: research.runId
  });
  return { batch, reused: false, research };
}

async function finishBatchIfReady(batchId: string) {
  const remaining = await prisma.productionTestItem.count({
    where: { batchId, writingStatus: { in: ["queued", "generating"] } }
  });
  if (remaining > 0) return;
  const total = await prisma.productionTestItem.count({ where: { batchId } });
  await refreshBatchCost(batchId);
  await prisma.productionTestBatch.update({
    where: { id: batchId },
    data: { status: total ? "pending_review" : "empty", completedAt: new Date() }
  });
}

export async function processNextProductionTestItem(batchId: string) {
  const batch = await prisma.productionTestBatch.findUniqueOrThrow({ where: { id: batchId } });
  if (["cancelled", "scheduled"].includes(batch.status)) {
    throw new Error(`Batch cannot be processed while status is ${batch.status}.`);
  }
  const item = await prisma.productionTestItem.findFirst({
    where: { batchId, writingStatus: "queued" },
    orderBy: { position: "asc" }
  });
  if (!item) {
    await finishBatchIfReady(batchId);
    return { done: true, item: null };
  }
  if (batch.articleGenerationsUsed >= batch.articleGenerationLimit) {
    await prisma.productionTestBatch.update({
      where: { id: batchId },
      data: { status: "cost_limited", errorSummary: "Article generation limit reached." }
    });
    throw new Error("Article generation limit reached. The batch stopped safely.");
  }

  const claimed = await prisma.productionTestItem.updateMany({
    where: { id: item.id, writingStatus: "queued" },
    data: {
      writingStatus: "generating",
      articleGenerationCount: { increment: 1 },
      lastError: null
    }
  });
  if (!claimed.count) return { done: false, item: null };
  await prisma.productionTestBatch.update({
    where: { id: batchId },
    data: { status: "processing", articleGenerationsUsed: { increment: 1 } }
  });

  try {
    const post = await generateJournalistDraftFromResearch(item.researchCandidateId, "Neutral", {
      minWords: 800,
      maxWords: 1200,
      maxAttempts: 1
    });
    const originalMetadata = safeObject(post.generationMetadata);
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: "draft",
        approvalStatus: "pending",
        generationMetadata: json({
          ...originalMetadata,
          oneTimeProductionTest: true,
          productionTestBatchId: batchId,
          productionTestItemId: item.id,
          targetWordRange: { min: 800, max: 1200 }
        })
      }
    });
    const postAfterFactCheck = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    const writingCost = tokenCost(postAfterFactCheck.tokenUsage);
    const factErrors = criticalFactCheckErrors(postAfterFactCheck);
    await prisma.productionTestItem.update({
      where: { id: item.id },
      data: {
        postId: post.id,
        writingStatus: "completed",
        factCheckStatus: postAfterFactCheck.factCheckStatus,
        trustScore: postAfterFactCheck.trustScore,
        estimatedAiCostUsd: writingCost
      }
    });

    if (factErrors.length) {
      await prisma.productionTestItem.update({
        where: { id: item.id },
        data: {
          imageStatus: "skipped_fact_check",
          approvalStatus: "needs_review",
          validationStatus: "failed",
          validationErrors: json(factErrors),
          processedAt: new Date(),
          lastError: factErrors[0]
        }
      });
      await finishBatchIfReady(batchId);
      return { done: false, itemId: item.id, postId: post.id, eligible: false };
    }

    const freshBatch = await prisma.productionTestBatch.findUniqueOrThrow({ where: { id: batchId } });
    if (freshBatch.imageGenerationsUsed >= freshBatch.imageGenerationLimit) {
      throw new Error("Image generation success limit reached. The draft was kept safely.");
    }
    await prisma.productionTestItem.update({
      where: { id: item.id },
      data: { imageStatus: "generating", imageAttemptCount: { increment: 1 } }
    });
    const image = await generateImageForPost(post.id, { statusWhenDone: "completed" });
    await prisma.productionTestBatch.update({
      where: { id: batchId },
      data: { imageGenerationsUsed: { increment: 1 } }
    });
    const imageCost = image.generationCostUsd;
    const totalCost = sumKnownCosts([writingCost, imageCost]);
    const validation = await validateGeneratedPost(post.id);
    const eligible = validation.errors.length === 0;

    await prisma.productionTestItem.update({
      where: { id: item.id },
      data: {
        imageStatus: image.imageStatus,
        approvalStatus: eligible ? "eligible" : "needs_review",
        validationStatus: eligible ? "passed" : "failed",
        validationErrors: json(validation.errors),
        estimatedAiCostUsd: totalCost,
        processedAt: new Date(),
        lastError: eligible ? null : validation.errors[0]
      }
    });
    await prisma.post.update({
      where: { id: post.id },
      data: { status: eligible ? "pending_review" : "draft", approvalStatus: "pending" }
    });
    await recordStatusEvent({
      postId: post.id,
      fromStatus: "draft",
      toStatus: eligible ? "pending_review" : "draft",
      action: "production_test_validation",
      actor: "One-time Production Test",
      metadata: { batchId, itemId: item.id, eligible, errors: validation.errors }
    }).catch(() => null);
    await finishBatchIfReady(batchId);
    return { done: false, itemId: item.id, postId: post.id, eligible };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Unknown batch error";
    const failedItem = await prisma.productionTestItem.findUnique({ where: { id: item.id } });
    const writingCompleted = Boolean(failedItem?.postId);
    await prisma.productionTestItem.update({
      where: { id: item.id },
      data: {
        writingStatus: writingCompleted ? "completed" : "failed",
        imageStatus: writingCompleted ? "failed" : "pending",
        approvalStatus: "needs_review",
        validationStatus: "failed",
        validationErrors: json([message]),
        processedAt: new Date(),
        lastError: message
      }
    });
    logError("production_test_item_failed", error, { batchId, itemId: item.id });
    await finishBatchIfReady(batchId);
    return { done: false, itemId: item.id, postId: failedItem?.postId || null, eligible: false, error: message };
  }
}

export async function processProductionTestBatch(batchId: string) {
  const results = [];
  for (let index = 0; index < MAX_ARTICLES; index += 1) {
    const result = await processNextProductionTestItem(batchId);
    results.push(result);
    if (result.done) break;
  }
  return { batchId, results };
}

async function approveAndScheduleItem(itemId: string) {
  const item = await prisma.productionTestItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.approvalStatus !== "eligible" || !item.postId) {
    throw new Error("Only eligible test articles can be approved and scheduled.");
  }
  if (item.plannedPublishAt.getTime() <= Date.now()) {
    throw new Error("The planned test slot has passed. Review and reschedule this article manually.");
  }
  await prisma.post.update({ where: { id: item.postId }, data: { imageStatus: "accepted" } });
  await approvePost({
    postId: item.postId,
    actor: "Admin · One-time Production Test",
    note: `Approved from test batch ${item.batchId}.`,
    confirmedFactCheck: true
  });
  await schedulePost({
    postId: item.postId,
    publishAt: item.plannedPublishAt,
    timezone: TEST_BATCH_TIMEZONE,
    actor: "Admin · One-time Production Test",
    note: `One-time test batch ${item.batchId}. No recurrence.`,
    recurrence: "none",
    confirmedFactCheck: true
  });
  const updated = await prisma.productionTestItem.update({
    where: { id: item.id },
    data: {
      approvalStatus: "approved",
      scheduledAt: item.plannedPublishAt,
      approvedAt: new Date(),
      lastError: null
    }
  });
  return updated;
}

export async function approveEligibleProductionTestItems(batchId: string) {
  const items = await prisma.productionTestItem.findMany({
    where: { batchId, approvalStatus: "eligible" },
    orderBy: { position: "asc" }
  });
  const results: Array<{ itemId: string; ok: boolean; error?: string }> = [];
  for (const item of items) {
    try {
      await approveAndScheduleItem(item.id);
      results.push({ itemId: item.id, ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval failed";
      results.push({ itemId: item.id, ok: false, error: message });
      await prisma.productionTestItem.update({ where: { id: item.id }, data: { lastError: message } });
    }
  }
  const scheduled = results.filter((result) => result.ok).length;
  await prisma.productionTestBatch.update({
    where: { id: batchId },
    data: {
      status: scheduled ? "scheduled" : "pending_review",
      approvedAt: scheduled ? new Date() : null,
      errorSummary: results.find((result) => !result.ok)?.error || null
    }
  });
  return { scheduled, results };
}

export async function approveProductionTestItem(itemId: string) {
  const item = await approveAndScheduleItem(itemId);
  const remaining = await prisma.productionTestItem.count({
    where: { batchId: item.batchId, approvalStatus: "eligible" }
  });
  if (remaining === 0) {
    await prisma.productionTestBatch.update({
      where: { id: item.batchId },
      data: { status: "scheduled", approvedAt: new Date() }
    });
  }
  return item;
}

export async function rejectProductionTestItem(itemId: string, reason?: string) {
  const item = await prisma.productionTestItem.findUniqueOrThrow({ where: { id: itemId } });
  if (item.postId) {
    await rejectPost({
      postId: item.postId,
      actor: "Admin · One-time Production Test",
      reason: reason || "Rejected during one-time production test review."
    });
  }
  return prisma.productionTestItem.update({
    where: { id: item.id },
    data: { approvalStatus: "rejected", rejectedAt: new Date(), scheduledAt: null }
  });
}

export async function retryProductionTestItem(itemId: string) {
  const item = await prisma.productionTestItem.findUniqueOrThrow({ where: { id: itemId } });
  const batch = await prisma.productionTestBatch.findUniqueOrThrow({ where: { id: item.batchId } });
  if (item.writingStatus === "failed") {
    if (batch.articleGenerationsUsed >= batch.articleGenerationLimit) {
      throw new Error("The absolute article generation limit has been reached.");
    }
    await prisma.productionTestItem.update({
      where: { id: item.id },
      data: { writingStatus: "queued", approvalStatus: "pending", lastError: null }
    });
    return processNextProductionTestItem(item.batchId);
  }
  if (item.imageStatus === "failed" && item.postId) {
    if (item.imageAttemptCount >= batch.imageRetryLimit) {
      throw new Error("The image retry limit has been reached for this article.");
    }
    await prisma.productionTestItem.update({
      where: { id: item.id },
      data: { imageStatus: "generating", imageAttemptCount: { increment: 1 }, lastError: null }
    });
    try {
      const image = await generateImageForPost(item.postId, { statusWhenDone: "completed", force: true });
      const validation = await validateGeneratedPost(item.postId);
      const writingCost = tokenCost(
        (await prisma.post.findUnique({ where: { id: item.postId }, select: { tokenUsage: true } }))
          ?.tokenUsage
      );
      const totalCost = sumKnownCosts([writingCost, image.generationCostUsd]);
      await prisma.productionTestItem.update({
        where: { id: item.id },
        data: {
          imageStatus: image.imageStatus,
          approvalStatus: validation.errors.length ? "needs_review" : "eligible",
          validationStatus: validation.errors.length ? "failed" : "passed",
          validationErrors: json(validation.errors),
          estimatedAiCostUsd: totalCost,
          processedAt: new Date(),
          lastError: validation.errors[0] || null
        }
      });
      await prisma.productionTestBatch.update({
        where: { id: item.batchId },
        data: { imageGenerationsUsed: { increment: 1 } }
      });
      await refreshBatchCost(item.batchId);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Image retry failed";
      await prisma.productionTestItem.update({
        where: { id: item.id },
        data: { imageStatus: "failed", approvalStatus: "needs_review", lastError: message }
      });
      throw error;
    }
  }
  throw new Error("This item has no retryable failed step.");
}

export async function cancelRemainingProductionTestBatch(batchId: string) {
  await prisma.productionTestItem.updateMany({
    where: {
      batchId,
      approvalStatus: { in: ["pending", "eligible", "needs_review"] },
      scheduledAt: null
    },
    data: { approvalStatus: "cancelled", writingStatus: "cancelled" }
  });
  return prisma.productionTestBatch.update({
    where: { id: batchId },
    data: { status: "cancelled", cancelledAt: new Date() }
  });
}

export async function loadLatestProductionTestBatch() {
  const batch = await prisma.productionTestBatch.findFirst({
    include: { items: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  if (!batch) return null;
  const postIds = batch.items.map((item) => item.postId).filter((id): id is string => Boolean(id));
  const posts = postIds.length
    ? await prisma.post.findMany({
        where: { id: { in: postIds } },
        select: { id: true, title: true, slug: true, status: true, publishedAt: true }
      })
    : [];
  return {
    ...batch,
    items: batch.items.map((item) => {
      const post = posts.find((value) => value.id === item.postId);
      return {
        ...item,
        postTitle: post?.title || null,
        postSlug: post?.slug || null,
        postStatus: post?.status || null,
        publishedUrl:
          post?.status === "published" && post.slug ? absoluteUrl(`/news/${post.slug}`) : item.publishedUrl
      };
    })
  };
}
