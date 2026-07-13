import { prisma } from "@/lib/prisma";
import { validatePostForPublishing } from "@/lib/publishGuard";
import { parseJsonArray } from "@/lib/json";
import { absoluteUrl } from "@/lib/site";
import { logError, logInfo } from "@/lib/logger";

export const PUBLISH_STATUSES = [
  "draft",
  "pending_review",
  "approved",
  "scheduled",
  "publishing",
  "published",
  "rejected",
  "archived"
] as const;

export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

type PublishingPost = Awaited<ReturnType<typeof loadPostForPublishing>>;

type PublishReadinessCheck = {
  key: string;
  label: string;
  ok: boolean;
  message?: string;
};

export type PublishReadiness = {
  ok: boolean;
  checks: PublishReadinessCheck[];
  errors: string[];
};

function actorLabel(actor?: string | null) {
  return actor?.trim() || "Daily Signal Wire";
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function imageUrl(post: NonNullable<PublishingPost>) {
  return (
    post.featuredImageUrl ||
    post.featuredImage ||
    post.imageUrl ||
    post.openGraphImage ||
    post.twitterImage ||
    post.thumbnailImage ||
    ""
  );
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

function loadPostForPublishing(postId: string) {
  return prisma.post.findUnique({
    where: { id: postId },
    include: {
      category: { select: { name: true, slug: true } },
      trend: { select: { category: true } }
    }
  });
}

export function publishStatusLabel(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function recordStatusEvent({
  postId,
  fromStatus,
  toStatus,
  action,
  actor,
  note,
  metadata
}: {
  postId: string;
  fromStatus?: string | null;
  toStatus: string;
  action: string;
  actor?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.postStatusEvent.create({
    data: {
      postId,
      fromStatus: fromStatus || null,
      toStatus,
      action,
      actor: actorLabel(actor),
      note: note?.trim() || null,
      metadata: json(metadata || {})
    }
  });
}

export async function recordApprovalEvent({
  postId,
  action,
  actor,
  note,
  metadata
}: {
  postId: string;
  action: string;
  actor?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await prisma.postApprovalEvent.create({
    data: {
      postId,
      action,
      actor: actorLabel(actor),
      note: note?.trim() || null,
      metadata: json(metadata || {})
    }
  });
}

export async function notifyEditor({
  postId,
  type,
  title,
  message,
  severity = "info",
  metadata
}: {
  postId?: string | null;
  type: string;
  title: string;
  message: string;
  severity?: "info" | "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  await prisma.editorialNotification.create({
    data: {
      postId: postId || null,
      type,
      title,
      message,
      severity,
      metadata: json(metadata || {})
    }
  });
}

export async function validatePostPublishReadiness(
  postId: string,
  options: { confirmedFactCheck?: boolean; requireApproval?: boolean } = {}
): Promise<PublishReadiness> {
  const post = await loadPostForPublishing(postId);
  if (!post) {
    return {
      ok: false,
      checks: [
        {
          key: "post_exists",
          label: "Post exists",
          ok: false,
          message: "Post was not found."
        }
      ],
      errors: ["Post was not found."]
    };
  }

  const image = imageUrl(post);
  const faq = parseJsonArray<{ question: string; answer: string }>(post.faq);
  const canonical = absoluteUrl(`/news/${post.slug}`);
  const duplicateSlugCount = await prisma.post.count({
    where: {
      slug: post.slug,
      NOT: { id: post.id }
    }
  });
  const baseError = validatePostForPublishing(
    post,
    Boolean(options.confirmedFactCheck)
  );
  const checks: PublishReadinessCheck[] = [
    {
      key: "publish_guard",
      label: "Editorial guardrail",
      ok: !baseError,
      message: baseError || undefined
    },
    {
      key: "approved",
      label: "Editor approval",
      ok:
        !options.requireApproval ||
        post.approvalStatus === "approved" ||
        post.status === "approved" ||
        post.status === "scheduled",
      message: "The article must be approved before scheduled publishing."
    },
    {
      key: "hero_image",
      label: "Hero image exists",
      ok: Boolean(image),
      message: "Hero image is required before publishing."
    },
    {
      key: "slug_unique",
      label: "Slug is unique",
      ok: duplicateSlugCount === 0,
      message: "Slug must be unique before publishing."
    },
    {
      key: "meta_complete",
      label: "Meta fields complete",
      ok: Boolean(
        post.seoTitle?.trim() &&
          post.seoDescription?.trim() &&
          post.openGraphDescription?.trim()
      ),
      message: "SEO title, meta description and OpenGraph description are required."
    },
    {
      key: "open_graph_ready",
      label: "OpenGraph image ready",
      ok: Boolean(post.openGraphImage || image),
      message: "OpenGraph image is required before publishing."
    },
    {
      key: "canonical_ready",
      label: "Canonical URL ready",
      ok: Boolean(canonical) && !canonical.includes("localhost"),
      message: "Canonical URL must be production-safe."
    },
    {
      key: "faq_ready",
      label: "FAQ ready",
      ok: faq.length >= 3,
      message: "At least three FAQ entries are required."
    },
    {
      key: "json_ld_ready",
      label: "JSON-LD ready",
      ok: Boolean(
        post.title?.trim() &&
          post.authorName?.trim() &&
          post.seoDescription?.trim() &&
          image &&
          post.createdAt
      ),
      message: "NewsArticle schema needs title, author, description and image."
    }
  ];

  const errors = unique(checks.filter((check) => !check.ok).map((check) => check.message || check.label));

  return { ok: errors.length === 0, checks, errors };
}

export async function approvePost({
  postId,
  actor,
  note,
  confirmedFactCheck = true
}: {
  postId: string;
  actor?: string | null;
  note?: string | null;
  confirmedFactCheck?: boolean;
}) {
  const post = await loadPostForPublishing(postId);
  if (!post) throw new Error("Post was not found.");
  const readiness = await validatePostPublishReadiness(postId, {
    confirmedFactCheck,
    requireApproval: false
  });
  if (!readiness.ok) {
    await notifyEditor({
      postId,
      type: "approval_blocked",
      title: "Approval blocked",
      message: readiness.errors[0] || "Resolve publishing checks before approval.",
      severity: "warning",
      metadata: { errors: readiness.errors }
    });
    throw new Error(readiness.errors[0] || "Resolve publishing checks before approval.");
  }

  const approvedAt = new Date();
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: "approved",
      approvalStatus: "approved",
      approvedAt,
      approvedBy: actorLabel(actor),
      publishError: null,
      rejectedAt: null,
      rejectionReason: null,
      scheduledAt: null,
      publishAt: null
    }
  });
  await recordApprovalEvent({
    postId,
    action: "approve",
    actor,
    note,
    metadata: { readinessChecks: readiness.checks }
  });
  await recordStatusEvent({
    postId,
    fromStatus: post.status,
    toStatus: "approved",
    action: "approve",
    actor,
    note
  });
  await notifyEditor({
    postId,
    type: "article_approved",
    title: "Article approved",
    message: `"${post.title}" is approved for scheduling or publish now.`,
    severity: "success"
  });
  return { post: updated, readiness };
}

export async function rejectPost({
  postId,
  actor,
  reason
}: {
  postId: string;
  actor?: string | null;
  reason?: string | null;
}) {
  const post = await loadPostForPublishing(postId);
  if (!post) throw new Error("Post was not found.");
  const rejectionReason = reason?.trim() || "Rejected by editor for revision.";
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: "rejected",
      approvalStatus: "rejected",
      rejectedAt: new Date(),
      rejectionReason,
      scheduledAt: null,
      publishAt: null,
      publishingStartedAt: null,
      publishError: null
    }
  });
  await recordApprovalEvent({
    postId,
    action: "reject",
    actor,
    note: rejectionReason
  });
  await recordStatusEvent({
    postId,
    fromStatus: post.status,
    toStatus: "rejected",
    action: "reject",
    actor,
    note: rejectionReason
  });
  await notifyEditor({
    postId,
    type: "article_rejected",
    title: "Article rejected",
    message: rejectionReason,
    severity: "warning"
  });
  return updated;
}

export async function archivePost({
  postId,
  actor,
  note
}: {
  postId: string;
  actor?: string | null;
  note?: string | null;
}) {
  const post = await loadPostForPublishing(postId);
  if (!post) throw new Error("Post was not found.");
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: "archived",
      approvalStatus: "archived",
      scheduledAt: null,
      publishAt: null,
      publishingStartedAt: null
    }
  });
  await recordStatusEvent({
    postId,
    fromStatus: post.status,
    toStatus: "archived",
    action: "archive",
    actor,
    note
  });
  await notifyEditor({
    postId,
    type: "article_archived",
    title: "Article archived",
    message: `"${post.title}" was archived.`,
    severity: "info"
  });
  return updated;
}

export async function movePostToDraft({
  postId,
  actor,
  note
}: {
  postId: string;
  actor?: string | null;
  note?: string | null;
}) {
  const post = await loadPostForPublishing(postId);
  if (!post) throw new Error("Post was not found.");
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: "draft",
      approvalStatus: "pending",
      approvedAt: null,
      approvedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      scheduledAt: null,
      publishAt: null,
      publishingStartedAt: null,
      publishError: null
    }
  });
  await recordStatusEvent({
    postId,
    fromStatus: post.status,
    toStatus: "draft",
    action: "draft",
    actor,
    note
  });
  return updated;
}

export async function schedulePost({
  postId,
  publishAt,
  timezone,
  actor,
  note,
  recurrence = "none",
  queueMode = false,
  confirmedFactCheck = true
}: {
  postId: string;
  publishAt: Date;
  timezone?: string | null;
  actor?: string | null;
  note?: string | null;
  recurrence?: string | null;
  queueMode?: boolean;
  confirmedFactCheck?: boolean;
}) {
  if (Number.isNaN(publishAt.getTime())) {
    throw new Error("A valid schedule date and time is required.");
  }
  if (publishAt.getTime() <= Date.now()) {
    throw new Error("Schedule time must be in the future.");
  }
  const post = await loadPostForPublishing(postId);
  if (!post) throw new Error("Post was not found.");
  const readiness = await validatePostPublishReadiness(postId, {
    confirmedFactCheck,
    requireApproval: false
  });
  if (!readiness.ok) {
    await notifyEditor({
      postId,
      type: "schedule_blocked",
      title: "Schedule blocked",
      message: readiness.errors[0] || "Resolve publishing checks before scheduling.",
      severity: "warning",
      metadata: { errors: readiness.errors }
    });
    throw new Error(readiness.errors[0] || "Resolve publishing checks before scheduling.");
  }

  const approvedAt = post.approvedAt || new Date();
  const normalizedTimezone = timezone?.trim() || "UTC";
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: "scheduled",
      approvalStatus: "approved",
      approvedAt,
      approvedBy: post.approvedBy || actorLabel(actor),
      scheduledAt: publishAt,
      publishAt,
      timezone: normalizedTimezone,
      publishedAt: null,
      rejectedAt: null,
      rejectionReason: null,
      publishError: null,
      schedulerMetadata: json({
        publishAt: publishAt.toISOString(),
        timezone: normalizedTimezone,
        recurrence: recurrence || "none",
        queueMode,
        scheduledBy: actorLabel(actor),
        scheduledAt: new Date().toISOString()
      })
    }
  });
  await recordApprovalEvent({
    postId,
    action: "schedule",
    actor,
    note,
    metadata: { publishAt: publishAt.toISOString(), timezone: normalizedTimezone }
  });
  await recordStatusEvent({
    postId,
    fromStatus: post.status,
    toStatus: "scheduled",
    action: "schedule",
    actor,
    note,
    metadata: { publishAt: publishAt.toISOString(), timezone: normalizedTimezone }
  });
  await notifyEditor({
    postId,
    type: "article_scheduled",
    title: "Article scheduled",
    message: `"${post.title}" is queued for ${publishAt.toISOString()}.`,
    severity: "success",
    metadata: { timezone: normalizedTimezone, recurrence: recurrence || "none" }
  });
  return { post: updated, readiness };
}

export async function publishPostNow({
  postId,
  actor,
  source = "manual",
  confirmedFactCheck = true,
  approvalOverride = false
}: {
  postId: string;
  actor?: string | null;
  source?: "manual" | "cron" | "api";
  confirmedFactCheck?: boolean;
  approvalOverride?: boolean;
}) {
  const post = await loadPostForPublishing(postId);
  if (!post) throw new Error("Post was not found.");
  const readiness = await validatePostPublishReadiness(postId, {
    confirmedFactCheck,
    requireApproval: !approvalOverride
  });
  if (!readiness.ok) {
    const message = readiness.errors[0] || "Resolve publishing checks before publishing.";
    await prisma.post.update({
      where: { id: postId },
      data: { publishError: message }
    });
    await notifyEditor({
      postId,
      type: "publishing_failed",
      title: "Publishing failed",
      message,
      severity: "error",
      metadata: { source, errors: readiness.errors }
    });
    throw new Error(message);
  }

  const publishingStartedAt = new Date();
  await prisma.post.update({
    where: { id: postId },
    data: {
      status: "publishing",
      publishingStartedAt,
      publishError: null
    }
  });
  await recordStatusEvent({
    postId,
    fromStatus: post.status,
    toStatus: "publishing",
    action: source === "cron" ? "auto_publish_start" : "publish_start",
    actor,
    metadata: { source }
  });

  const publishedAt = new Date();
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      status: "published",
      approvalStatus:
        post.approvalStatus === "approved" || approvalOverride
          ? "approved"
          : post.approvalStatus,
      approvedAt: post.approvedAt || (approvalOverride ? publishedAt : null),
      approvedBy: post.approvedBy || (approvalOverride ? actorLabel(actor) : null),
      publishedAt,
      scheduledAt: null,
      publishAt: null,
      publishingStartedAt: null,
      publishError: null,
      rejectedAt: null,
      rejectionReason: null
    }
  });
  await recordStatusEvent({
    postId,
    fromStatus: "publishing",
    toStatus: "published",
    action: source === "cron" ? "auto_publish_complete" : "publish_complete",
    actor,
    metadata: { source, publishedAt: publishedAt.toISOString() }
  });
  await notifyEditor({
    postId,
    type: "publishing_completed",
    title: "Publishing completed",
    message: `"${post.title}" is live at ${absoluteUrl(`/news/${post.slug}`)}.`,
    severity: "success",
    metadata: { source, publishedAt: publishedAt.toISOString() }
  });
  logInfo("post_published", { postId, source });
  return { post: updated, readiness };
}

export async function publishDueScheduledPosts(limit = 20) {
  const now = new Date();
  const due = await prisma.post.findMany({
    where: {
      status: "scheduled",
      approvalStatus: "approved",
      OR: [{ publishAt: { lte: now } }, { scheduledAt: { lte: now } }]
    },
    select: { id: true },
    orderBy: [{ publishAt: "asc" }, { scheduledAt: "asc" }],
    take: limit
  });

  let published = 0;
  let failed = 0;
  const failures: Array<{ postId: string; error: string }> = [];

  for (const post of due) {
    try {
      await publishPostNow({
        postId: post.id,
        actor: "Auto Publisher",
        source: "cron",
        confirmedFactCheck: true,
        approvalOverride: false
      });
      published += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ postId: post.id, error: message });
      logError("scheduled_post_publish_failed", error, { postId: post.id });
    }
  }

  logInfo("scheduled_posts_publish_checked", {
    due: due.length,
    published,
    failed
  });
  return { due: due.length, published, failed, failures };
}
