"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";
import { trackEvent, trackImageGeneration, trackPublish } from "@/lib/client/analytics";

type EditablePost = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  summary: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  openGraphDescription: string;
  facebookCaption: string;
  authorName: string;
  readingTimeMinutes: number | null;
  keyTakeaways: string[];
  timeline: string[];
  relatedTopics: string[];
  internalLinkSuggestions: { title: string; url: string; reason: string }[];
  draftVersion: number;
  journalistTone: string;
  generationMetadata: string;
  tokenUsage: string;
  generationTimeMs: number | null;
  promptVersion: string;
  tags: string[];
  faq: { question: string; answer: string }[];
  imagePrompt: string;
  imageStatus: string;
  imageError: string;
  imageUrl: string;
  featuredImageUrl: string;
  featuredImage: string;
  thumbnailImage: string;
  openGraphImage: string;
  twitterImage: string;
  imageAlt: string;
  imageCaption: string;
  imageDisclosure: string;
  imageSourceType: string;
  imageLicense: string;
  imageCredit: string;
  generatedImages: GeneratedImageVersion[];
  aiGenerated: boolean;
  factCheckNotes: string[];
  sourceUrls: string[];
  factCheckStatus: string;
  trustScore: number | null;
  evidenceScore: number | null;
  sourceDiversityScore: number | null;
  freshnessScore: number | null;
  confidenceLevel: string;
  factCheckSummary: string;
  factCheckEvidence: FactCheckEvidence[];
  factCheckWarnings: FactCheckWarning[];
  riskyParagraphs: RiskyParagraph[];
  verificationMetadata: string;
  verifiedAt: string;
  status: string;
  scheduledAt: string;
  rejectionReason: string;
};

type GeneratedImageVersion = {
  id: string;
  prompt: string;
  finalPrompt: string;
  generator: string;
  model: string;
  status: string;
  url: string;
  featuredUrl: string;
  thumbnailUrl: string;
  openGraphUrl: string;
  twitterUrl: string;
  webpUrl: string;
  avifUrl: string;
  width: number | null;
  height: number | null;
  format: string;
  alt: string;
  title: string;
  description: string;
  caption: string;
  disclosure: string;
  sourceType: string;
  illustrative: boolean;
  storage: string;
  category: string;
  metadata: string;
  validationNotes: string[];
  generationCostUsd: number | null;
  generationTimeMs: number | null;
  promptVersion: string;
  promptTemplate: string;
  license: string;
  credit: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

type FactCheckEvidence = {
  claim: string;
  verdict: string;
  sources: Array<{
    url: string;
    title?: string | null;
    publisher?: string | null;
    domain: string;
    trusted: boolean;
  }>;
  notes: string[];
};

type FactCheckWarning = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  paragraphIndex?: number;
  claim?: string;
};

type RiskyParagraph = {
  index: number;
  paragraph: string;
  reason: string;
  severity: "low" | "medium" | "high";
  suggestedAction: string;
};

type FactCheckResult = {
  status: string;
  trustScore: number;
  evidenceScore: number;
  sourceDiversityScore: number;
  freshnessScore: number;
  confidenceLevel: string;
  summary: string;
  evidence: FactCheckEvidence[];
  warnings: FactCheckWarning[];
  riskyParagraphs: RiskyParagraph[];
  metadata: Record<string, unknown>;
};

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export default function AdminPostEditor({
  initialPost,
  aiConfigured
}: {
  initialPost: EditablePost;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [post, setPost] = useState(initialPost);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(initialPost.scheduledAt);
  const [rewriteTone, setRewriteTone] = useState(initialPost.journalistTone || "Neutral");
  const [urlFields, setUrlFields] = useState({
    imageUrl: "",
    imageAlt: "",
    imageCaption: "",
    imageDisclosure: "",
    imageLicense: "",
    imageCredit: ""
  });

  function previewImageUrl() {
    return post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage || "";
  }

  function articleUrl() {
    return `${window.location.origin}/news/${post.slug}`;
  }

  function field<K extends keyof EditablePost>(key: K, value: EditablePost[K]) {
    setPost((current) => ({ ...current, [key]: value }));
  }

  function applyFactCheckResult(result: FactCheckResult) {
    setPost((current) => ({
      ...current,
      factCheckStatus: result.status,
      trustScore: result.trustScore,
      evidenceScore: result.evidenceScore,
      sourceDiversityScore: result.sourceDiversityScore,
      freshnessScore: result.freshnessScore,
      confidenceLevel: result.confidenceLevel,
      factCheckSummary: result.summary,
      factCheckEvidence: result.evidence,
      factCheckWarnings: result.warnings,
      riskyParagraphs: result.riskyParagraphs,
      verificationMetadata: JSON.stringify(result.metadata || {}),
      verifiedAt: new Date().toISOString()
    }));
  }

  async function call(url: string, init: RequestInit, label: string) {
    setBusy(label);
    setMessage("");
    const response = await fetch(url, init);
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) {
      setMessage(body.error || `${label} failed`);
      return null;
    }
    return body;
  }

  async function save() {
    const result = await call(
      `/api/admin/posts/${post.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: post.title,
          subtitle: post.subtitle,
          excerpt: post.excerpt,
          summary: post.summary,
          content: post.content,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          openGraphDescription: post.openGraphDescription,
          facebookCaption: post.facebookCaption,
          authorName: post.authorName,
          readingTimeMinutes: post.readingTimeMinutes,
          keyTakeaways: post.keyTakeaways,
          timeline: post.timeline,
          relatedTopics: post.relatedTopics,
          internalLinkSuggestions: post.internalLinkSuggestions,
          tags: post.tags,
          faq: post.faq,
          imagePrompt: post.imagePrompt,
          imageAlt: post.imageAlt,
          imageCaption: post.imageCaption,
          imageDisclosure: post.imageDisclosure,
          factCheckNotes: post.factCheckNotes,
          sourceUrls: post.sourceUrls
        })
      },
      "save"
    );
    if (result) {
      setMessage("Draft saved.");
      router.refresh();
    }
  }

  async function regenerateArticle() {
    const result = await call(
      `/api/admin/posts/${post.id}/regenerate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "article" })
      },
      "regenerate article"
    );
    if (result?.article) {
      setPost((current) => ({
        ...current,
        title: result.article.title ?? current.title,
        subtitle: result.article.subtitle ?? current.subtitle,
        excerpt: result.article.excerpt ?? current.excerpt,
        summary: result.article.summary ?? current.summary,
        content: result.article.content ?? current.content,
        seoTitle: result.article.seoTitle ?? current.seoTitle,
        seoDescription: result.article.seoDescription ?? current.seoDescription,
        openGraphDescription:
          result.article.openGraphDescription ?? current.openGraphDescription,
        facebookCaption: result.article.facebookCaption ?? current.facebookCaption,
        authorName: result.article.authorName ?? current.authorName,
        readingTimeMinutes:
          result.article.readingTimeMinutes ?? current.readingTimeMinutes,
        keyTakeaways: result.article.keyTakeaways ?? current.keyTakeaways,
        timeline: result.article.timeline ?? current.timeline,
        relatedTopics: result.article.relatedTopics ?? current.relatedTopics,
        internalLinkSuggestions:
          result.article.internalLinkSuggestions ?? current.internalLinkSuggestions,
        draftVersion: result.article.draftVersion ?? current.draftVersion,
        journalistTone: result.article.journalistTone ?? current.journalistTone,
        generationMetadata:
          result.article.generationMetadata ?? current.generationMetadata,
        tokenUsage: result.article.tokenUsage ?? current.tokenUsage,
        generationTimeMs: result.article.generationTimeMs ?? current.generationTimeMs,
        promptVersion: result.article.promptVersion ?? current.promptVersion,
        tags: result.article.tags ?? current.tags,
        faq: result.article.faq ?? current.faq,
        imagePrompt: result.article.imagePrompt ?? current.imagePrompt,
        factCheckNotes: result.article.factCheckNotes ?? current.factCheckNotes,
        sourceUrls: result.article.sourceUrls ?? current.sourceUrls,
        imageStatus: "idle",
        imageError: ""
      }));
      setMessage("Article regenerated. Review all facts again before publishing.");
      trackEvent("generate_ai_article", { post_id: post.id, mode: "regenerate" });
      router.refresh();
    }
  }

  async function rewriteSection(
    section: "headline" | "lead" | "body" | "faq" | "meta" | "summary"
  ) {
    const result = await call(
      "/api/ai/rewrite",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, section, tone: rewriteTone })
      },
      `rewrite ${section}`
    );
    if (result?.post) {
      const updated = result.post;
      setPost((current) => ({
        ...current,
        title: updated.title ?? current.title,
        subtitle: updated.subtitle ?? current.subtitle,
        excerpt: updated.excerpt ?? current.excerpt,
        summary: updated.summary ?? current.summary,
        content: updated.content ?? current.content,
        seoTitle: updated.seoTitle ?? current.seoTitle,
        seoDescription: updated.seoDescription ?? current.seoDescription,
        openGraphDescription: updated.openGraphDescription ?? current.openGraphDescription,
        facebookCaption: updated.facebookCaption ?? current.facebookCaption,
        tags: parseJsonArray<string>(updated.tags).length
          ? parseJsonArray<string>(updated.tags)
          : current.tags,
        faq: parseJsonArray<{ question: string; answer: string }>(updated.faq).length
          ? parseJsonArray<{ question: string; answer: string }>(updated.faq)
          : current.faq,
        keyTakeaways: parseJsonArray<string>(updated.keyTakeaways).length
          ? parseJsonArray<string>(updated.keyTakeaways)
          : current.keyTakeaways,
        timeline: parseJsonArray<string>(updated.timeline).length
          ? parseJsonArray<string>(updated.timeline)
          : current.timeline,
        relatedTopics: parseJsonArray<string>(updated.relatedTopics).length
          ? parseJsonArray<string>(updated.relatedTopics)
          : current.relatedTopics,
        internalLinkSuggestions: parseJsonArray<{
          title: string;
          url: string;
          reason: string;
        }>(updated.internalLinkSuggestions).length
          ? parseJsonArray<{ title: string; url: string; reason: string }>(
              updated.internalLinkSuggestions
            )
          : current.internalLinkSuggestions,
        draftVersion: updated.draftVersion ?? current.draftVersion,
        journalistTone: updated.journalistTone ?? current.journalistTone,
        generationMetadata: updated.generationMetadata ?? current.generationMetadata,
        tokenUsage: updated.tokenUsage ?? current.tokenUsage,
        generationTimeMs: updated.generationTimeMs ?? current.generationTimeMs,
        promptVersion: updated.promptVersion ?? current.promptVersion,
        factCheckNotes: parseJsonArray<string>(updated.factCheckNotes).length
          ? parseJsonArray<string>(updated.factCheckNotes)
          : current.factCheckNotes
      }));
      setMessage(`${section} rewritten. Review before saving or publishing.`);
      trackEvent("generate_ai_article", { post_id: post.id, mode: `rewrite_${section}` });
      router.refresh();
    }
  }

  async function runFactCheck(action: "run" | "regenerate_failed_sections") {
    const result = await call(
      "/api/ai/fact-check",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, action, tone: rewriteTone })
      },
      action === "run" ? "fact-check" : "regenerate flagged sections"
    );
    if (result?.result) {
      applyFactCheckResult(result.result);
      setMessage(
        action === "run"
          ? "Fact check complete."
          : "Flagged sections regenerated and fact-checked."
      );
      trackEvent("generate_ai_article", {
        post_id: post.id,
        mode: action === "run" ? "fact_check" : "regenerate_failed_sections"
      });
      router.refresh();
    }
  }

  async function verifyFactCheck(action: "approve" | "reject" | "needs_review" | "low_confidence") {
    const result = await call(
      "/api/ai/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, action })
      },
      action
    );
    if (result) {
      setPost((current) => ({
        ...current,
        factCheckStatus: result.factCheckStatus || current.factCheckStatus,
        trustScore: result.trustScore ?? current.trustScore,
        verifiedAt: result.verifiedAt || current.verifiedAt,
        status: action === "reject" ? "rejected" : current.status,
        rejectionReason:
          action === "reject"
            ? "Rejected by fact-check workflow. Resolve unsupported or conflicting claims before publication."
            : current.rejectionReason
      }));
      setMessage(`${action.replace("_", " ")} saved.`);
      router.refresh();
    }
  }

  async function image(mode: "generate" | "regenerate" | "accept" | "reject" | "remove") {
    const result = await call(
      `/api/admin/posts/${post.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, imagePrompt: post.imagePrompt })
      },
      mode
    );
    if (result) {
      setPost((current) => ({
        ...current,
        imagePrompt: result.imagePrompt ?? current.imagePrompt,
        imageStatus: result.imageStatus ?? current.imageStatus,
        imageError: result.imageError ?? "",
        imageUrl: result.imageUrl ?? "",
        featuredImageUrl: result.featuredImageUrl ?? "",
        featuredImage: result.featuredImage ?? "",
        thumbnailImage: result.thumbnailImage ?? "",
        openGraphImage: result.openGraphImage ?? "",
        twitterImage: result.twitterImage ?? "",
        imageAlt: result.imageAlt ?? "",
        imageCaption: result.imageCaption ?? "",
        imageDisclosure: result.imageDisclosure ?? "",
        imageSourceType: result.imageSourceType ?? current.imageSourceType,
        imageLicense: result.imageLicense ?? "",
        imageCredit: result.imageCredit ?? "",
        generatedImages: result.generatedImageId
          ? [
              {
                id: result.generatedImageId,
                prompt: result.imagePrompt ?? current.imagePrompt,
                finalPrompt: result.finalPrompt ?? result.imagePrompt ?? current.imagePrompt,
                generator: "openai-images",
                model: result.imageModel ?? "",
                status: result.imageStatus ?? "completed",
                url: result.imageUrl ?? "",
                featuredUrl: result.featuredImageUrl ?? result.featuredImage ?? "",
                thumbnailUrl: result.thumbnailImage ?? "",
                openGraphUrl: result.openGraphImage ?? "",
                twitterUrl: result.twitterImage ?? "",
                webpUrl: "",
                avifUrl: "",
                width: 1600,
                height: 900,
                format: "jpeg",
                alt: result.imageAlt ?? "",
                title: result.imageAlt ?? current.title,
                description: result.imageCaption ?? "",
                caption: result.imageCaption ?? "",
                disclosure: result.imageDisclosure ?? "",
                sourceType: result.imageSourceType ?? "ai",
                illustrative: result.imageSourceType === "ai",
                storage: result.imageStorage ?? "",
                category: "",
                metadata: "{}",
                validationNotes: [],
                generationCostUsd: result.generationCostUsd ?? null,
                generationTimeMs: result.generationTimeMs ?? null,
                promptVersion: result.promptVersion ?? "",
                promptTemplate: result.promptTemplate ?? "",
                license: result.imageLicense ?? "",
                credit: result.imageCredit ?? "",
                error: result.imageError ?? "",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              },
              ...current.generatedImages.filter((item) => item.id !== result.generatedImageId)
            ]
          : current.generatedImages
      }));
      setMessage(`${mode} complete.`);
      if (mode === "generate" || mode === "regenerate") {
        trackImageGeneration({
          post_id: post.id,
          mode
        });
      }
      router.refresh();
    }
  }

  async function imageVersion(mode: "use-version" | "delete-version", imageId: string) {
    const result = await call(
      `/api/admin/posts/${post.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, imageId })
      },
      mode === "use-version" ? "use image version" : "delete image version"
    );
    if (result) {
      if (mode === "delete-version") {
        setPost((current) => ({
          ...current,
          generatedImages: current.generatedImages.filter((item) => item.id !== imageId)
        }));
        setMessage("Image version removed from history.");
        return;
      }
      setPost((current) => ({
        ...current,
        imagePrompt: result.imagePrompt ?? current.imagePrompt,
        imageStatus: result.imageStatus ?? current.imageStatus,
        imageError: result.imageError ?? "",
        imageUrl: result.imageUrl ?? "",
        featuredImageUrl: result.featuredImageUrl ?? "",
        featuredImage: result.featuredImage ?? "",
        thumbnailImage: result.thumbnailImage ?? "",
        openGraphImage: result.openGraphImage ?? "",
        twitterImage: result.twitterImage ?? "",
        imageAlt: result.imageAlt ?? "",
        imageCaption: result.imageCaption ?? "",
        imageDisclosure: result.imageDisclosure ?? "",
        imageSourceType: result.imageSourceType ?? current.imageSourceType,
        imageLicense: result.imageLicense ?? "",
        imageCredit: result.imageCredit ?? "",
        generatedImages: current.generatedImages.map((item) =>
          item.id === imageId ? { ...item, status: "accepted" } : item
        )
      }));
      setMessage("Image version selected.");
      router.refresh();
    }
  }

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    if (!event.target.files?.[0]) return;
    const form = new FormData();
    form.append("file", event.target.files[0]);
    form.append("alt", post.imageAlt);
    form.append("caption", post.imageCaption);
    form.append("license", "Owned/uploaded by publisher");
    form.append("credit", "Daily Signal Wire");
    const result = await call(
      `/api/admin/posts/${post.id}/image`,
      { method: "POST", body: form },
      "upload"
    );
    if (result) {
      setPost((current) => ({
        ...current,
        imageStatus: result.imageStatus ?? current.imageStatus,
        imageError: result.imageError ?? "",
        imageUrl: result.imageUrl ?? "",
        featuredImageUrl: result.featuredImageUrl ?? "",
        featuredImage: result.featuredImage ?? "",
        thumbnailImage: result.thumbnailImage ?? "",
        openGraphImage: result.openGraphImage ?? "",
        twitterImage: result.twitterImage ?? "",
        imageAlt: result.imageAlt ?? current.imageAlt,
        imageCaption: result.imageCaption ?? current.imageCaption,
        imageDisclosure: result.imageDisclosure ?? "",
        imageSourceType: result.imageSourceType ?? "upload",
        imageLicense: result.imageLicense ?? "",
        imageCredit: result.imageCredit ?? ""
      }));
      setMessage("Image uploaded and resized.");
      router.refresh();
    }
  }

  async function pasteImageUrl() {
    const result = await call(
      `/api/admin/posts/${post.id}/image`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "url", ...urlFields })
      },
      "url"
    );
    if (result) {
      setPost((current) => ({
        ...current,
        imageStatus: result.imageStatus ?? current.imageStatus,
        imageError: result.imageError ?? "",
        imageUrl: result.imageUrl ?? "",
        featuredImageUrl: result.featuredImageUrl ?? "",
        featuredImage: result.featuredImage ?? "",
        thumbnailImage: result.thumbnailImage ?? "",
        openGraphImage: result.openGraphImage ?? "",
        twitterImage: result.twitterImage ?? "",
        imageAlt: result.imageAlt ?? current.imageAlt,
        imageCaption: result.imageCaption ?? current.imageCaption,
        imageDisclosure: result.imageDisclosure ?? current.imageDisclosure,
        imageSourceType: result.imageSourceType ?? "licensed_url",
        imageLicense: result.imageLicense ?? "",
        imageCredit: result.imageCredit ?? ""
      }));
      setMessage("Licensed image URL saved.");
      router.refresh();
    }
  }

  async function publish() {
    const result = await call(
      `/api/admin/posts/${post.id}/publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmedFactCheck: confirmed })
      },
      "publish"
    );
    if (result) {
      setPost((current) => ({ ...current, status: "published" }));
      setMessage("Published.");
      trackPublish({
        post_id: post.id,
        article_slug: post.slug
      });
      router.refresh();
    }
  }

  async function statusAction(action: "approve" | "reject" | "draft" | "schedule") {
    const payload: Record<string, unknown> = { action };
    if (action === "reject") {
      payload.rejectionReason =
        window.prompt("Why is this draft rejected?", post.rejectionReason || "") ||
        "Rejected by editor for revision.";
    }
    if (action === "schedule") {
      if (!scheduleAt) {
        setMessage("Choose a future schedule time first.");
        return;
      }
      payload.scheduledAt = new Date(scheduleAt).toISOString();
      payload.confirmedFactCheck = confirmed;
    }
    if (action === "approve") {
      payload.confirmedFactCheck = confirmed;
      payload.note = "Approved from post editor.";
    }
    const result = await call(
      `/api/admin/posts/${post.id}/status`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      },
      action
    );
    if (result) {
      setPost((current) => ({
        ...current,
        status: result.status || (action === "schedule" ? "scheduled" : "draft"),
        rejectionReason:
          action === "reject" ? String(payload.rejectionReason || "") : "",
        scheduledAt: result.scheduledAt || (action === "schedule" ? scheduleAt : "")
      }));
      setMessage(`${action} complete.`);
      router.refresh();
    }
  }

  async function copyFacebook() {
    const hook =
      post.facebookCaption.length > 180
        ? `${post.facebookCaption.slice(0, 177).trimEnd()}…`
        : post.facebookCaption;
    setMessage(
      (await copyText(`${post.title}\n\n${hook}\n\nRead full story:\n${articleUrl()}`))
        ? "Facebook post copied."
        : "Copy blocked."
    );
    trackEvent("copy_facebook_post", {
      post_id: post.id,
      article_slug: post.slug
    });
  }

  async function copyUrl() {
    setMessage((await copyText(articleUrl())) ? "URL copied." : "Copy blocked.");
  }

  const contentWordCount = post.content.trim().split(/\s+/).filter(Boolean).length;
  const placeholderPattern =
    /\b(lorem ipsum|placeholder|sample draft|demonstration draft|todo)\b/i;
  const hasPlaceholderText = placeholderPattern.test(
    `${post.title}\n${post.subtitle}\n${post.excerpt}\n${post.summary}\n${post.content}\n${post.seoTitle}\n${post.seoDescription}`
  );
  const publishChecklist: { label: string; done: boolean }[] = [
    { label: "Headline is present", done: Boolean(post.title.trim()) },
    { label: "Subtitle is present", done: Boolean(post.subtitle.trim()) },
    { label: "Excerpt is present", done: Boolean(post.excerpt.trim()) },
    { label: "Summary is present", done: Boolean(post.summary.trim()) },
    { label: "At least three tags are attached", done: post.tags.length >= 3 },
    { label: "FAQ has at least three entries", done: post.faq.length >= 3 },
    { label: "Source URLs are attached", done: post.sourceUrls.length > 0 },
    { label: "Fact-check notes are attached", done: post.factCheckNotes.length > 0 },
    {
      label: "AI Fact Checker is verified",
      done: !post.aiGenerated || post.factCheckStatus === "Verified"
    },
    {
      label: "Trust score is at least 75",
      done: !post.aiGenerated || (post.trustScore ?? 0) >= 75
    },
    { label: "Placeholder text has been removed", done: !hasPlaceholderText },
    { label: "No fabricated quotes or unsupported numbers", done: confirmed },
    { label: "Article is original and not copied verbatim", done: confirmed },
    { label: "Featured image is present", done: Boolean(previewImageUrl()) },
    { label: "Featured image is accepted", done: post.imageStatus === "accepted" },
    { label: "Image alt text is present", done: Boolean(post.imageAlt.trim()) },
    {
      label: "AI image disclosure is present when needed",
      done: post.imageSourceType !== "ai" || Boolean(post.imageDisclosure.trim())
    },
    { label: "SEO title is present", done: Boolean(post.seoTitle.trim()) },
    { label: "Meta description is present", done: Boolean(post.seoDescription.trim()) },
    {
      label: "OpenGraph description is present",
      done: Boolean(post.openGraphDescription.trim())
    },
    {
      label: "Article length is 500–900 words",
      done: contentWordCount >= 500 && contentWordCount <= 900
    }
  ];
  const imagePipelineBusy = ["queued", "generating", "retrying", "upscaling", "optimizing"].includes(
    post.imageStatus
  );
  const factCheckBlocksPublish =
    post.aiGenerated && (post.factCheckStatus !== "Verified" || (post.trustScore ?? 0) < 75);
  const factCheckStatusClass = post.factCheckStatus.toLowerCase().replace(/\s+/g, "-");
  const evidenceSources = Array.from(
    new Map(
      post.factCheckEvidence
        .flatMap((item) => item.sources)
        .map((source) => [source.url, source] as const)
    ).values()
  );
  const latestGeneratedImage = post.generatedImages.find((image) => image.sourceType === "ai") || post.generatedImages[0];

  return (
    <main className="admin-content">
      {message && <div className="toast">{message}</div>}
      <section className="panel admin-editor-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Edit post</p>
            <h2>{post.title}</h2>
          </div>
          <span className={`post-status post-status-${post.status}`}>
            {post.status}
          </span>
        </div>

        <section className="writer-assist-panel">
          <div>
            <p className="eyebrow">AI Journalist</p>
            <h3>Selective rewrite</h3>
            <p>
              Rewrite one section at a time. Existing sources and fact-check notes stay attached.
            </p>
            <small>
              Draft v{post.draftVersion} · {post.promptVersion || "manual"} ·{" "}
              {post.generationTimeMs ? `${post.generationTimeMs}ms` : "no generation timing"}
            </small>
          </div>
          <div className="writer-assist-controls">
            <select
              value={rewriteTone}
              onChange={(event) => setRewriteTone(event.target.value)}
              aria-label="Rewrite tone"
            >
              <option>Neutral</option>
              <option>Business</option>
              <option>Breaking</option>
              <option>Analysis</option>
            </select>
            {(["headline", "lead", "body", "faq", "meta", "summary"] as const).map((section) => (
              <button
                key={section}
                className="button button-secondary"
                onClick={() => rewriteSection(section)}
                disabled={Boolean(busy) || !aiConfigured || post.status === "published"}
              >
                Rewrite {section}
              </button>
            ))}
          </div>
        </section>

        <div className="edit-form">
          <div className="two-col">
            <label>
              Author
              <input
                value={post.authorName}
                onChange={(event) => field("authorName", event.target.value)}
              />
            </label>
            <label>
              Reading time
              <input
                type="number"
                min="1"
                value={post.readingTimeMinutes ?? ""}
                onChange={(event) =>
                  field(
                    "readingTimeMinutes",
                    event.target.value ? Number(event.target.value) : null
                  )
                }
              />
            </label>
          </div>
          <label>
            Headline
            <input value={post.title} onChange={(event) => field("title", event.target.value)} />
          </label>
          <label>
            Subtitle
            <input
              value={post.subtitle}
              onChange={(event) => field("subtitle", event.target.value)}
              placeholder="One precise sentence below the headline"
            />
          </label>
          <label>
            Excerpt
            <textarea
              rows={3}
              value={post.excerpt}
              onChange={(event) => field("excerpt", event.target.value)}
            />
          </label>
          <label>
            Summary
            <textarea
              rows={4}
              value={post.summary}
              onChange={(event) => field("summary", event.target.value)}
              placeholder="Short editor-facing summary for homepage, SEO and reader context"
            />
          </label>
          <label>
            Article
            <textarea
              className="article-textarea"
              rows={24}
              value={post.content}
              onChange={(event) => field("content", event.target.value)}
            />
          </label>
          <div className="two-col">
            <label>
              SEO title
              <input
                value={post.seoTitle}
                onChange={(event) => field("seoTitle", event.target.value)}
              />
            </label>
            <label>
              Meta description
              <textarea
                rows={3}
                value={post.seoDescription}
                onChange={(event) => field("seoDescription", event.target.value)}
              />
            </label>
          </div>
          <label>
            OpenGraph description
            <textarea
              rows={3}
              value={post.openGraphDescription}
              onChange={(event) => field("openGraphDescription", event.target.value)}
              placeholder="Description used for Facebook, X and rich previews"
            />
          </label>
          <label>
            Facebook caption
            <textarea
              rows={4}
              value={post.facebookCaption}
              onChange={(event) => field("facebookCaption", event.target.value)}
            />
          </label>
          <label>
            Image prompt
            <textarea
              rows={6}
              value={post.imagePrompt}
              onChange={(event) => field("imagePrompt", event.target.value)}
            />
          </label>
          <div className="two-col">
            <label>
              Image alt text
              <input
                value={post.imageAlt}
                onChange={(event) => field("imageAlt", event.target.value)}
                placeholder="Describe the cover image for accessibility"
              />
            </label>
            <label>
              Image caption
              <input
                value={post.imageCaption}
                onChange={(event) => field("imageCaption", event.target.value)}
                placeholder="Caption shown under the article image"
              />
            </label>
          </div>
          <label>
            Image disclosure
            <input
              value={post.imageDisclosure}
              onChange={(event) => field("imageDisclosure", event.target.value)}
              placeholder="AI-generated editorial image."
            />
          </label>
          <div className="two-col">
            <label>
              Tags, one per line
              <textarea
                rows={6}
                value={post.tags.join("\n")}
                onChange={(event) =>
                  field(
                    "tags",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              FAQ
              <textarea
                rows={6}
                value={post.faq
                  .map((item) => `${item.question}\n${item.answer}`)
                  .join("\n\n")}
                onChange={(event) => {
                  const faq = event.target.value
                    .split(/\n{2,}/)
                    .map((block) => {
                      const [question = "", ...answerLines] = block
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean);
                      return { question, answer: answerLines.join(" ") };
                    })
                    .filter((item) => item.question && item.answer);
                  field("faq", faq);
                }}
                placeholder={"Question one?\nAnswer one.\n\nQuestion two?\nAnswer two."}
              />
            </label>
          </div>
          <div className="two-col">
            <label>
              Key takeaways, one per line
              <textarea
                rows={6}
                value={post.keyTakeaways.join("\n")}
                onChange={(event) =>
                  field(
                    "keyTakeaways",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              Timeline, one per line
              <textarea
                rows={6}
                value={post.timeline.join("\n")}
                onChange={(event) =>
                  field(
                    "timeline",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
          </div>
          <div className="two-col">
            <label>
              Related topics, one per line
              <textarea
                rows={5}
                value={post.relatedTopics.join("\n")}
                onChange={(event) =>
                  field(
                    "relatedTopics",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              Internal link suggestions
              <textarea
                rows={5}
                value={post.internalLinkSuggestions
                  .map((item) => `${item.title} | ${item.url} | ${item.reason}`)
                  .join("\n")}
                onChange={(event) =>
                  field(
                    "internalLinkSuggestions",
                    event.target.value
                      .split("\n")
                      .map((line) => {
                        const [title = "", url = "", reason = ""] = line
                          .split("|")
                          .map((item) => item.trim());
                        return { title, url, reason };
                      })
                      .filter((item) => item.title && item.url)
                  )
                }
                placeholder="Title | /news/story | Why this link helps"
              />
            </label>
          </div>
          <div className="two-col">
            <label>
              Fact-check notes, one per line
              <textarea
                rows={6}
                value={post.factCheckNotes.join("\n")}
                onChange={(event) =>
                  field(
                    "factCheckNotes",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
            <label>
              Source URLs, one per line
              <textarea
                rows={6}
                value={post.sourceUrls.join("\n")}
                onChange={(event) =>
                  field(
                    "sourceUrls",
                    event.target.value
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section className="panel fact-check-detail-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">AI Fact Checker</p>
            <h2>Verification report</h2>
          </div>
          <span className={`fact-status fact-status-${factCheckStatusClass}`}>
            {post.factCheckStatus}
          </span>
        </div>
        <div className="fact-check-score-grid">
          <div className="fact-score-card">
            <span>Trust score</span>
            <strong>{post.trustScore ?? "—"}</strong>
            <small>{post.confidenceLevel || "Pending"}</small>
          </div>
          <div className="fact-score-card">
            <span>Evidence</span>
            <strong>{post.evidenceScore ?? "—"}</strong>
            <small>{post.factCheckEvidence.length} claims</small>
          </div>
          <div className="fact-score-card">
            <span>Source diversity</span>
            <strong>{post.sourceDiversityScore ?? "—"}</strong>
            <small>{evidenceSources.length || post.sourceUrls.length} sources</small>
          </div>
          <div className="fact-score-card">
            <span>Freshness</span>
            <strong>{post.freshnessScore ?? "—"}</strong>
            <small>{post.verifiedAt ? new Date(post.verifiedAt).toLocaleString() : "Not checked"}</small>
          </div>
        </div>
        <p className="fact-check-summary">
          {post.factCheckSummary ||
            "Run the AI Fact Checker to verify important claims against saved source URLs before publishing."}
        </p>
        <div className="fact-check-actions">
          <button
            className="button button-secondary"
            onClick={() => runFactCheck("run")}
            disabled={Boolean(busy)}
          >
            {busy === "fact-check" ? "Checking…" : "Run Fact Check"}
          </button>
          <button
            className="button button-secondary"
            onClick={() => runFactCheck("regenerate_failed_sections")}
            disabled={Boolean(busy) || !aiConfigured || post.status === "published"}
          >
            {busy === "regenerate flagged sections" ? "Regenerating…" : "Regenerate Failed Sections"}
          </button>
          <button
            className="button button-publish"
            onClick={() => verifyFactCheck("approve")}
            disabled={Boolean(busy)}
          >
            Approve
          </button>
          <button
            className="button button-secondary"
            onClick={() => verifyFactCheck("needs_review")}
            disabled={Boolean(busy)}
          >
            Needs Review
          </button>
          <button
            className="button button-secondary"
            onClick={() => verifyFactCheck("reject")}
            disabled={Boolean(busy)}
          >
            Reject
          </button>
        </div>
        {!aiConfigured && (
          <p className="settings-help-text">
            Source-based fact-checking is available. Regenerating failed sections needs{" "}
            <code>OPENAI_API_KEY</code>.
          </p>
        )}
        {post.factCheckWarnings.length > 0 && (
          <section className="fact-warning-panel">
            <h3>Warnings</h3>
            <ul className="fact-warning-list">
              {post.factCheckWarnings.map((warning, index) => (
                <li className={`severity-${warning.severity}`} key={`${warning.type}-${index}`}>
                  <span>{warning.severity}</span>
                  <div>
                    <strong>{warning.type.replaceAll("_", " ")}</strong>
                    <p>{warning.message}</p>
                    {warning.claim && <small>{warning.claim}</small>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {post.riskyParagraphs.length > 0 && (
          <section className="fact-warning-panel">
            <h3>Highlighted risky paragraphs</h3>
            <div className="risky-paragraph-list">
              {post.riskyParagraphs.map((paragraph) => (
                <article className={`risky-paragraph severity-${paragraph.severity}`} key={paragraph.index}>
                  <strong>Paragraph {paragraph.index + 1}</strong>
                  <p>{paragraph.paragraph}</p>
                  <small>{paragraph.reason}</small>
                  <em>{paragraph.suggestedAction}</em>
                </article>
              ))}
            </div>
          </section>
        )}
        {post.factCheckEvidence.length > 0 && (
          <section className="fact-warning-panel">
            <h3>Evidence list</h3>
            <div className="fact-evidence-list">
              {post.factCheckEvidence.map((item, index) => (
                <details key={`${item.claim}-${index}`}>
                  <summary>
                    <span className={`fact-verdict fact-verdict-${item.verdict}`}>{item.verdict}</span>
                    {item.claim}
                  </summary>
                  {item.sources.length > 0 ? (
                    <ul>
                      {item.sources.map((source) => (
                        <li key={source.url}>
                          <a href={source.url} target="_blank" rel="noreferrer">
                            {source.publisher || source.domain}
                          </a>
                          {source.trusted && <span> trusted</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No matching source in saved source packet.</p>
                  )}
                  {item.notes.length > 0 && (
                    <small>{item.notes.slice(0, 3).join(" · ")}</small>
                  )}
                </details>
              ))}
            </div>
          </section>
        )}
      </section>

      <section className="panel admin-editor-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">Image</p>
            <h2>Featured visual</h2>
          </div>
          <span className={`status status-${post.imageStatus}`}>
            {post.imageStatus}
          </span>
        </div>
        <div className="image-badge-row">
          <span className={`image-source-badge image-source-${post.imageSourceType}`}>
            {post.imageSourceType === "ai"
              ? "Generated"
              : post.imageSourceType === "upload"
                ? "Manual Upload"
                : post.imageSourceType === "licensed_url"
                  ? "Licensed URL"
                  : "Placeholder"}
          </span>
          {imagePipelineBusy && <span>Pipeline running…</span>}
          {post.imageStatus === "failed" && <span>Failed · retry available</span>}
        </div>
        {imagePipelineBusy && (
          <ol className="image-progress-steps" aria-label="Image generation progress">
            {["queued", "generating", "upscaling", "optimizing", "completed"].map((step) => (
              <li
                key={step}
                className={
                  step === post.imageStatus ||
                  (post.imageStatus === "accepted" && step === "completed")
                    ? "active"
                    : ""
                }
              >
                {step}
              </li>
            ))}
          </ol>
        )}
        {!aiConfigured && (
          <div className="warning-banner">
            AI image generation is not configured.
          </div>
        )}
        {previewImageUrl() ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="admin-editor-image" src={previewImageUrl()} alt={post.imageAlt} />
            {post.imageDisclosure && (
              <p className="ai-image-disclosure">{post.imageDisclosure}</p>
            )}
          </>
        ) : (
          <div className="reader-empty-state compact">
            <h2>No featured image yet.</h2>
            <p>Generate an editorial image, upload one, or paste a licensed URL from the trend editor.</p>
          </div>
        )}
        {post.imageError && <div className="error-banner">{post.imageError}</div>}
        {(post.featuredImage || post.thumbnailImage) && (
          <div className="image-asset-list">
            <span>1200×675: {post.thumbnailImage || "pending"}</span>
            <span>1920×1080: {post.featuredImageUrl || post.featuredImage || "pending"}</span>
            <span>OpenGraph: {post.openGraphImage || "pending"}</span>
            <span>Twitter: {post.twitterImage || "pending"}</span>
          </div>
        )}
        <div className="image-meta-preview">
          <span>Alt: {post.imageAlt || "Not set"}</span>
          <span>Caption: {post.imageCaption || "Not set"}</span>
          <span>Disclosure: {post.imageDisclosure || "None"}</span>
          <span>
            Generation:{" "}
            {latestGeneratedImage?.generationTimeMs
              ? `${(latestGeneratedImage.generationTimeMs / 1000).toFixed(1)}s`
              : "not recorded"}
          </span>
          <span>
            Cost:{" "}
            {latestGeneratedImage?.generationCostUsd !== undefined &&
            latestGeneratedImage?.generationCostUsd !== null
              ? `$${latestGeneratedImage.generationCostUsd.toFixed(4)} est.`
              : "not configured"}
          </span>
          <span>
            Prompt: {latestGeneratedImage?.promptVersion || "not recorded"}
            {latestGeneratedImage?.promptTemplate ? ` · ${latestGeneratedImage.promptTemplate}` : ""}
          </span>
        </div>
        <p className="license-line">
          {post.imageLicense || "License not set"}
          {post.imageCredit ? ` · ${post.imageCredit}` : ""}
        </p>
        {post.generatedImages.length > 0 && (
          <section className="image-version-panel" aria-labelledby="image-version-heading">
            <div className="panel-heading compact">
              <div>
                <p className="eyebrow">Image pipeline</p>
                <h3 id="image-version-heading">Generated versions</h3>
              </div>
              <span>{post.generatedImages.length} saved</span>
            </div>
            <div className="image-version-list">
              {post.generatedImages.map((image) => {
                const imageUrl = image.thumbnailUrl || image.featuredUrl || image.url;
                const downloadUrl = image.featuredUrl || image.url || image.thumbnailUrl;
                return (
                  <article className="image-version-card" key={image.id}>
                    <div className="image-version-thumb">
                      {imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={image.alt || image.caption || "Image version"} />
                      ) : (
                        <span>No preview</span>
                      )}
                    </div>
                    <div className="image-version-body">
                      <div className="image-badge-row">
                        <span className={`image-source-badge image-source-${image.sourceType}`}>
                          {image.sourceType}
                        </span>
                        <span className={`status status-${image.status}`}>{image.status}</span>
                        {image.illustrative && <span className="image-source-badge">Illustrative</span>}
                      </div>
                      <strong>{image.title || image.caption || "Editorial image version"}</strong>
                      <small>
                {image.width && image.height ? `${image.width}×${image.height}` : "Size pending"}
                        {image.format ? ` · ${image.format.toUpperCase()}` : ""}
                        {image.model ? ` · ${image.model}` : ""}
                        {image.generationTimeMs ? ` · ${(image.generationTimeMs / 1000).toFixed(1)}s` : ""}
                        {image.generationCostUsd !== null
                          ? ` · $${image.generationCostUsd.toFixed(4)} est.`
                          : " · cost not configured"}
                      </small>
                      {(image.promptVersion || image.promptTemplate) && (
                        <small>
                          {image.promptVersion || "prompt"} · {image.promptTemplate || "default template"}
                        </small>
                      )}
                      <p>{image.description || image.caption || "No description recorded."}</p>
                      {image.validationNotes.length > 0 && (
                        <ul>
                          {image.validationNotes.slice(0, 3).map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      )}
                      <details>
                        <summary>Prompt and metadata</summary>
                        <p>{image.finalPrompt || image.prompt}</p>
                        {image.webpUrl && <code>WebP: {image.webpUrl}</code>}
                        {image.avifUrl && <code>AVIF: {image.avifUrl}</code>}
                      </details>
                      {image.error && <div className="error-banner">{image.error}</div>}
                      <div className="image-version-actions">
                        {downloadUrl && (
                          <a className="button button-secondary" href={downloadUrl} download>
                            Download
                          </a>
                        )}
                        {downloadUrl && (
                          <a
                            className="button button-secondary"
                            href={downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Preview
                          </a>
                        )}
                        <button
                          className="button button-publish"
                          onClick={() => imageVersion("use-version", image.id)}
                          disabled={Boolean(busy) || !downloadUrl}
                        >
                          Use version
                        </button>
                        <button
                          className="button button-secondary"
                          onClick={() => imageVersion("delete-version", image.id)}
                          disabled={Boolean(busy)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
        <label className="upload-button">
          Replace / Upload image
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={uploadImage}
          />
        </label>
        <details className="url-details">
          <summary>Paste licensed image URL</summary>
          <input
            placeholder="https://images.unsplash.com/…"
            value={urlFields.imageUrl}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageUrl: event.target.value })
            }
          />
          <input
            placeholder="Alt text"
            value={urlFields.imageAlt}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageAlt: event.target.value })
            }
          />
          <input
            placeholder="Caption"
            value={urlFields.imageCaption}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageCaption: event.target.value })
            }
          />
          <input
            placeholder="Disclosure (optional)"
            value={urlFields.imageDisclosure}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageDisclosure: event.target.value })
            }
          />
          <input
            placeholder="License"
            value={urlFields.imageLicense}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageLicense: event.target.value })
            }
          />
          <input
            placeholder="Photographer / source credit"
            value={urlFields.imageCredit}
            onChange={(event) =>
              setUrlFields({ ...urlFields, imageCredit: event.target.value })
            }
          />
          <button
            className="button button-secondary button-full"
            onClick={pasteImageUrl}
            disabled={Boolean(busy)}
          >
            Save image URL
          </button>
        </details>
      </section>

      <section className="panel publish-checklist-panel">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">AdSense-ready review</p>
            <h2>Pre-publish checklist</h2>
          </div>
        </div>
        <ul className="publish-checklist">
          {publishChecklist.map(({ label, done }) => (
            <li key={label} className={done ? "done" : "needs-review"}>
              <span>{done ? "✓" : "!"}</span>
              {label}
            </li>
          ))}
        </ul>
        <p className="settings-help-text">
          Manual checks are required before publishing. AI drafts are never
          published automatically.
        </p>
      </section>

      <section className="action-bar sticky-action-bar">
        <button className="button button-dark" onClick={save} disabled={Boolean(busy)}>
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          className="button button-secondary"
          onClick={regenerateArticle}
          disabled={Boolean(busy) || !aiConfigured || post.status === "published"}
        >
          {busy === "regenerate article" ? "Regenerating…" : "Regenerate Article"}
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("generate")}
          disabled={Boolean(busy) || !aiConfigured || imagePipelineBusy}
        >
          {imagePipelineBusy ? "Image pipeline running…" : "Generate Image"}
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("regenerate")}
          disabled={Boolean(busy) || !aiConfigured || !previewImageUrl() || imagePipelineBusy}
        >
          Regenerate Image
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("accept")}
          disabled={Boolean(busy) || !previewImageUrl()}
        >
          Accept Image
        </button>
        <button
          className="button button-secondary"
          onClick={() => image("remove")}
          disabled={Boolean(busy) || !previewImageUrl()}
        >
          Remove Image
        </button>
        <button
          className="button button-secondary"
          onClick={copyFacebook}
          disabled={Boolean(busy)}
        >
          Copy Facebook Post
        </button>
        <button className="button button-secondary" onClick={copyUrl} disabled={Boolean(busy)}>
          Copy URL
        </button>
        <Link
          className="button button-secondary"
          href={`/news/${post.slug}${post.status === "published" ? "" : "?preview=1"}`}
          target="_blank"
        >
          Preview
        </Link>
        {post.status !== "published" && (
          <label className="confirm-row compact-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>I completed the source, quote, copyright, SEO and image review.</span>
          </label>
        )}
        {post.status !== "published" && (
          <label className="schedule-control">
            Schedule
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
          </label>
        )}
        {post.status !== "published" && (
          <button
            className="button button-secondary"
            onClick={() => statusAction("schedule")}
            disabled={Boolean(busy) || !confirmed || factCheckBlocksPublish}
          >
            Schedule
          </button>
        )}
        {post.status !== "published" && post.status !== "rejected" && (
          <button
            className="button button-secondary"
            onClick={() => statusAction("reject")}
            disabled={Boolean(busy)}
          >
            Reject
          </button>
        )}
        {post.status === "rejected" && (
          <button
            className="button button-secondary"
            onClick={() => statusAction("approve")}
            disabled={Boolean(busy) || !confirmed || factCheckBlocksPublish}
          >
            Approve Draft
          </button>
        )}
        {post.status !== "published" && (
          <button
            className="button button-publish"
            onClick={publish}
            disabled={Boolean(busy) || !confirmed || factCheckBlocksPublish}
          >
            Publish
          </button>
        )}
      </section>
    </main>
  );
}
