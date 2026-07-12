import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import sharp from "sharp";
import {
  buildEditorialImagePlan,
  type EditorialImagePlan,
  type EditorialImagePromptInput
} from "@/lib/editorialImagePrompt";
import { placeholderImageForCategory } from "@/lib/editorialImages";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";
export { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";

const FEATURED_SIZE = { width: 1600, height: 900 };
const THUMBNAIL_SIZE = { width: 1200, height: 675 };
const IMAGE_API_TIMEOUT_MS = 120_000;

type ImageContext = {
  id: string;
  title: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  content: string;
  tags?: string | null;
  imagePrompt: string | null;
  imageUrl?: string | null;
  featuredImage?: string | null;
  featuredImageUrl?: string | null;
  thumbnailImage?: string | null;
  openGraphImage?: string | null;
  twitterImage?: string | null;
  imageAlt?: string | null;
  imageCaption?: string | null;
  imageDisclosure?: string | null;
  imageSourceType?: string | null;
  imageLicense?: string | null;
  imageCredit?: string | null;
  imageStatus?: string | null;
  imageStorage?: string | null;
  imageModel?: string | null;
  imageGeneratedAt?: Date | null;
  trend?: { category: string | null } | null;
  category?: { name: string | null } | null;
  sourceStory?: { feed?: { category?: { name: string | null } | null } | null } | null;
};

export type ArticleImageRequest = {
  title: string;
  subtitle?: string | null;
  excerpt: string;
  category?: string | null;
  contentSummary: string;
  summary?: string | null;
  keywords?: string[] | string | null;
  imagePrompt?: string | null;
};

export type StoredImageAssets = {
  imageUrl: string;
  featuredImageUrl: string;
  featuredImage: string;
  thumbnailImage: string;
  openGraphImage: string;
  twitterImage: string;
  imageModel: string;
  imageGeneratedAt: Date;
  imageStatus: string;
  imageAlt: string;
  imageCaption: string;
  imageDisclosure: string;
  imageSourceType: "ai" | "upload" | "licensed_url" | "placeholder";
  imageLicense: string;
  imageCredit: string;
  imageStorage: string;
  imagePrompt?: string;
  imageError?: string | null;
  generatedImageId?: string;
  finalPrompt?: string;
};

type StoredVariantFiles = {
  imageStorage: string;
  featuredImage: string;
  thumbnailImage: string;
  webpImage?: string;
  avifImage?: string;
  featuredImageData: null;
  thumbnailImageData: null;
  width: number;
  height: number;
  format: string;
  responsiveImages: Record<string, string | undefined>;
};

function imageModel() {
  const configured = process.env.IMAGE_MODEL?.trim();
  if (!configured || configured === "gpt-image-2") return "gpt-image-1";
  return configured;
}

function imageDirectory() {
  return path.join(process.cwd(), "public", "generated");
}

function normalizedImageStorageMode() {
  const configured = process.env.IMAGE_STORAGE?.trim().toLowerCase();
  if (configured === "local") return "local";
  if (configured === "blob" || configured === "vercel-blob") return "blob";

  if (configured === "database") {
    return process.env.VERCEL || process.env.NODE_ENV === "production"
      ? "blob"
      : "local";
  }

  return process.env.VERCEL || process.env.NODE_ENV === "production"
    ? "blob"
    : "local";
}

export function isBlobStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)
  );
}

export function isGeneratedImageStorageConfigured() {
  const mode = normalizedImageStorageMode();
  if (mode === "local") return !process.env.VERCEL;
  return isBlobStorageConfigured();
}

export function configuredImageStorageLabel() {
  const mode = normalizedImageStorageMode();
  if (mode === "local") return "local";
  return isBlobStorageConfigured() ? "vercel-blob" : "vercel-blob-missing-token";
}

function articleCategory(post: ImageContext) {
  return (
    post.category?.name ||
    post.trend?.category ||
    post.sourceStory?.feed?.category?.name ||
    "Editorial"
  );
}

function hasReusableImage(post: ImageContext) {
  return Boolean(
    (post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage) &&
      ["accepted", "completed"].includes(post.imageStatus || "")
  );
}

function compactText(value: string, max = 900) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function planInputFromPost(post: ImageContext, promptOverride?: string): EditorialImagePromptInput {
  return {
    headline: post.title,
    subtitle: post.subtitle,
    excerpt: post.excerpt,
    summary: post.summary,
    content: post.content,
    category: articleCategory(post),
    keywords: post.tags,
    basePrompt: promptOverride?.trim() || post.imagePrompt
  };
}

function imageAltFor(title: string, plan?: EditorialImagePlan) {
  return plan?.alt || `Editorial news image for “${title}”`;
}

function imageCaptionFor(
  sourceType: StoredImageAssets["imageSourceType"],
  plan?: EditorialImagePlan
) {
  if (sourceType === "ai") return plan?.caption || "AI-generated editorial image.";
  if (sourceType === "upload") return "Publisher-uploaded editorial image.";
  if (sourceType === "licensed_url") return "Licensed editorial image.";
  return "Daily Signal Wire fallback editorial image.";
}

function stringifyJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

export function buildArticleImagePlan({
  title,
  subtitle,
  excerpt,
  category,
  contentSummary,
  summary,
  keywords,
  imagePrompt
}: ArticleImageRequest) {
  return buildEditorialImagePlan({
    headline: title,
    subtitle,
    excerpt,
    summary,
    content: compactText(`${summary || ""}\n${contentSummary}`, 2200),
    category,
    keywords,
    basePrompt: imagePrompt
  });
}

export function buildArticleImagePrompt(request: ArticleImageRequest) {
  return buildArticleImagePlan(request).prompt;
}

export function buildEditorialImagePlanForPost(post: ImageContext, promptOverride?: string) {
  return buildEditorialImagePlan(planInputFromPost(post, promptOverride));
}

export function buildEditorialImagePrompt(post: ImageContext, promptOverride?: string) {
  return buildEditorialImagePlanForPost(post, promptOverride).prompt;
}

export async function generateEditorialImage(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_API_TIMEOUT_MS);
  let result: {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { message?: string };
  };

  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: imageModel(),
        prompt,
        size: "1536x1024",
        quality: "high"
      }),
      signal: controller.signal
    });

    const text = await response.text();
    result = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(
        result.error?.message || `Image API failed with HTTP ${response.status}.`
      );
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Image generation timed out. Try Regenerate Image, upload an image, or paste a licensed image URL."
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const item = result.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");

  if (item?.url) {
    const response = await fetch(item.url);
    if (!response.ok) {
      throw new Error(`Image download failed with HTTP ${response.status}.`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error("Image API returned no image data.");
}

async function validateSourceImage(sourceBytes: Buffer) {
  const metadata = await sharp(sourceBytes).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Generated image metadata could not be read.");
  }
  if (metadata.width < 768 || metadata.height < 512) {
    throw new Error("Generated image is too small for editorial use.");
  }
  return [
    `Source image validated at ${metadata.width}x${metadata.height}.`,
    "Image will be center-cropped to 16:9 and optimized into responsive assets."
  ];
}

async function renderImageVariants(sourceBytes: Buffer) {
  const validationNotes = await validateSourceImage(sourceBytes);
  const base = sharp(sourceBytes).rotate();
  const featuredSharp = base.clone().resize(FEATURED_SIZE.width, FEATURED_SIZE.height, {
    fit: "cover",
    position: "attention"
  });
  const thumbnailSharp = base.clone().resize(THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height, {
    fit: "cover",
    position: "attention"
  });

  const [
    featuredBuffer,
    thumbnailBuffer,
    featuredWebpBuffer,
    thumbnailWebpBuffer,
    featuredAvifBuffer,
    thumbnailAvifBuffer
  ] = await Promise.all([
    featuredSharp.clone().jpeg({ quality: 90, mozjpeg: true }).toBuffer(),
    thumbnailSharp.clone().jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
    featuredSharp.clone().webp({ quality: 84 }).toBuffer(),
    thumbnailSharp.clone().webp({ quality: 82 }).toBuffer(),
    featuredSharp.clone().avif({ quality: 58 }).toBuffer(),
    thumbnailSharp.clone().avif({ quality: 56 }).toBuffer()
  ]);

  return {
    featuredBuffer,
    thumbnailBuffer,
    featuredWebpBuffer,
    thumbnailWebpBuffer,
    featuredAvifBuffer,
    thumbnailAvifBuffer,
    validationNotes
  };
}

async function uploadToVercelBlob(
  postId: string,
  stamp: string,
  buffers: Awaited<ReturnType<typeof renderImageVariants>>
): Promise<StoredVariantFiles> {
  if (!isBlobStorageConfigured()) {
    throw new Error(
      "AI image storage is not configured. Connect Vercel Blob or add BLOB_READ_WRITE_TOKEN."
    );
  }

  const folder = `daily-signal-wire/posts/${postId}`;
  const upload = (name: string, buffer: Buffer, contentType: string) =>
    put(`${folder}/${stamp}-${name}`, new Blob([new Uint8Array(buffer)], { type: contentType }), {
      access: "public",
      addRandomSuffix: false,
      contentType,
      cacheControlMaxAge: 60 * 60 * 24 * 365
    });
  const [featured, thumbnail, featuredWebp, thumbnailWebp, featuredAvif, thumbnailAvif] =
    await Promise.all([
      upload("1600x900.jpg", buffers.featuredBuffer, "image/jpeg"),
      upload("1200x675.jpg", buffers.thumbnailBuffer, "image/jpeg"),
      upload("1600x900.webp", buffers.featuredWebpBuffer, "image/webp"),
      upload("1200x675.webp", buffers.thumbnailWebpBuffer, "image/webp"),
      upload("1600x900.avif", buffers.featuredAvifBuffer, "image/avif"),
      upload("1200x675.avif", buffers.thumbnailAvifBuffer, "image/avif")
    ]);

  return {
    imageStorage: "vercel-blob",
    featuredImage: featured.url,
    thumbnailImage: thumbnail.url,
    webpImage: featuredWebp.url,
    avifImage: featuredAvif.url,
    featuredImageData: null,
    thumbnailImageData: null,
    width: FEATURED_SIZE.width,
    height: FEATURED_SIZE.height,
    format: "jpeg",
    responsiveImages: {
      featuredJpeg: featured.url,
      thumbnailJpeg: thumbnail.url,
      featuredWebp: featuredWebp.url,
      thumbnailWebp: thumbnailWebp.url,
      featuredAvif: featuredAvif.url,
      thumbnailAvif: thumbnailAvif.url
    }
  };
}

export async function storePostImageVariants(
  postId: string,
  sourceBytes: Buffer
): Promise<StoredVariantFiles> {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const buffers = await renderImageVariants(sourceBytes);
  const mode = normalizedImageStorageMode();

  if (mode === "blob") {
    return uploadToVercelBlob(postId, stamp, buffers);
  }

  if (mode === "local" && !process.env.VERCEL) {
    const directory = imageDirectory();
    await mkdir(directory, { recursive: true });
    const names = {
      featured: `${postId}-${stamp}-1600x900.jpg`,
      thumbnail: `${postId}-${stamp}-1200x675.jpg`,
      featuredWebp: `${postId}-${stamp}-1600x900.webp`,
      thumbnailWebp: `${postId}-${stamp}-1200x675.webp`,
      featuredAvif: `${postId}-${stamp}-1600x900.avif`,
      thumbnailAvif: `${postId}-${stamp}-1200x675.avif`
    };

    await Promise.all([
      writeFile(path.join(directory, names.featured), buffers.featuredBuffer),
      writeFile(path.join(directory, names.thumbnail), buffers.thumbnailBuffer),
      writeFile(path.join(directory, names.featuredWebp), buffers.featuredWebpBuffer),
      writeFile(path.join(directory, names.thumbnailWebp), buffers.thumbnailWebpBuffer),
      writeFile(path.join(directory, names.featuredAvif), buffers.featuredAvifBuffer),
      writeFile(path.join(directory, names.thumbnailAvif), buffers.thumbnailAvifBuffer)
    ]);

    const urls = {
      featuredJpeg: `/generated/${names.featured}`,
      thumbnailJpeg: `/generated/${names.thumbnail}`,
      featuredWebp: `/generated/${names.featuredWebp}`,
      thumbnailWebp: `/generated/${names.thumbnailWebp}`,
      featuredAvif: `/generated/${names.featuredAvif}`,
      thumbnailAvif: `/generated/${names.thumbnailAvif}`
    };

    return {
      imageStorage: "local",
      featuredImage: urls.featuredJpeg,
      thumbnailImage: urls.thumbnailJpeg,
      webpImage: urls.featuredWebp,
      avifImage: urls.featuredAvif,
      featuredImageData: null,
      thumbnailImageData: null,
      width: FEATURED_SIZE.width,
      height: FEATURED_SIZE.height,
      format: "jpeg",
      responsiveImages: urls
    };
  }

  throw new Error(
    "Persistent image storage is not configured. Use Vercel Blob for production AI images."
  );
}

export async function generateArticleImage({
  postId,
  title,
  subtitle,
  excerpt,
  category,
  contentSummary,
  summary,
  keywords,
  imagePrompt
}: ArticleImageRequest & { postId: string }) {
  const plan = buildArticleImagePlan({
    title,
    subtitle,
    excerpt,
    category,
    contentSummary,
    summary,
    keywords,
    imagePrompt
  });
  const sourceBytes = await generateEditorialImage(plan.prompt);
  const variants = await storePostImageVariants(postId, sourceBytes);
  return { finalPrompt: plan.prompt, plan, variants };
}

async function createGeneratedImageAudit(
  postId: string,
  plan: EditorialImagePlan,
  model: string,
  status: string,
  prompt: string,
  storage?: string
) {
  return prisma.generatedImage.create({
    data: {
      postId,
      prompt,
      finalPrompt: plan.prompt,
      generator: "openai-images",
      model,
      status,
      alt: plan.alt,
      title: plan.title,
      description: plan.description,
      caption: plan.caption,
      disclosure: plan.disclosure,
      sourceType: "ai",
      illustrative: plan.illustrative,
      storage: storage || configuredImageStorageLabel(),
      category: plan.category,
      width: FEATURED_SIZE.width,
      height: FEATURED_SIZE.height,
      format: "jpeg",
      metadata: stringifyJson(plan.metadata),
      validationNotes: stringifyJson(plan.validationNotes),
      license: plan.license,
      credit: plan.credit
    }
  });
}

async function markAuditStatus(
  id: string | undefined,
  status: string,
  data: Record<string, unknown> = {}
) {
  if (!id) return;
  await prisma.generatedImage.update({
    where: { id },
    data: { status, ...data }
  });
}

async function applyPlaceholderImageForPost(
  postId: string,
  post: ImageContext,
  reason: string,
  status: "failed" | "idle" = "failed",
  plan?: EditorialImagePlan
) {
  const category = articleCategory(post);
  const placeholder = placeholderImageForCategory(category);
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      imageUrl: placeholder,
      featuredImageUrl: placeholder,
      featuredImage: placeholder,
      thumbnailImage: placeholder,
      openGraphImage: placeholder,
      twitterImage: placeholder,
      imageStorage: "url",
      featuredImageData: null,
      thumbnailImageData: null,
      imageAlt: imageAltFor(post.title, plan),
      imageCaption: imageCaptionFor("placeholder"),
      imageDisclosure: null,
      imageSourceType: "placeholder",
      imageStatus: status,
      imageError: reason
    }
  });
  return updated;
}

function assetsFromExisting(post: ImageContext, plan: EditorialImagePlan): StoredImageAssets {
  const category = articleCategory(post);
  const featured =
    post.featuredImageUrl ||
    post.featuredImage ||
    post.imageUrl ||
    placeholderImageForCategory(category);
  const thumbnail = post.thumbnailImage || post.imageUrl || featured;
  const now = post.imageGeneratedAt || new Date();
  return {
    imageUrl: post.imageUrl || thumbnail,
    featuredImageUrl: post.featuredImageUrl || featured,
    featuredImage: post.featuredImage || featured,
    thumbnailImage: thumbnail,
    openGraphImage: post.openGraphImage || featured,
    twitterImage: post.twitterImage || thumbnail,
    imageModel: post.imageModel || imageModel(),
    imageGeneratedAt: now,
    imageStatus: post.imageStatus || "completed",
    imageAlt: post.imageAlt || imageAltFor(post.title, plan),
    imageCaption: post.imageCaption || imageCaptionFor("ai", plan),
    imageDisclosure: post.imageDisclosure || plan.disclosure,
    imageSourceType: (post.imageSourceType as StoredImageAssets["imageSourceType"]) || "ai",
    imageLicense: post.imageLicense || plan.license,
    imageCredit: post.imageCredit || plan.credit,
    imageStorage: post.imageStorage || "url",
    imagePrompt: post.imagePrompt || plan.prompt,
    imageError: null,
    finalPrompt: plan.prompt
  };
}

export async function generateImageForPost(
  postId: string,
  options: {
    promptOverride?: string;
    statusWhenDone?: "completed" | "accepted";
    force?: boolean;
  } = {}
) {
  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: {
      trend: { select: { category: true } },
      category: { select: { name: true } },
      sourceStory: {
        include: {
          feed: { include: { category: { select: { name: true } } } }
        }
      }
    }
  });
  const plan = buildEditorialImagePlanForPost(post, options.promptOverride);
  const model = imageModel();
  const category = articleCategory(post);
  const prompt = options.promptOverride?.trim() || post.imagePrompt || plan.prompt;

  if (!options.force && !options.promptOverride && hasReusableImage(post)) {
    logInfo("post_image_reused", { postId, category, status: post.imageStatus });
    return assetsFromExisting(post, plan);
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      imagePrompt: plan.prompt,
      imageModel: model,
      imageStatus: "queued",
      imageError: null,
      imageAlt: plan.alt,
      imageCaption: plan.caption,
      imageDisclosure: plan.disclosure,
      imageSourceType: "ai",
      imageLicense: plan.license,
      imageCredit: plan.credit
    }
  });

  const audit = await createGeneratedImageAudit(postId, plan, model, "queued", prompt);

  if (!process.env.OPENAI_API_KEY) {
    const reason = "AI image generation is not configured.";
    await applyPlaceholderImageForPost(postId, post, reason, "failed", plan);
    await markAuditStatus(audit.id, "failed", { error: reason });
    throw new Error(reason);
  }

  if (!isGeneratedImageStorageConfigured()) {
    const reason =
      "AI image storage is not configured. Connect Vercel Blob before generating production images.";
    await applyPlaceholderImageForPost(postId, post, reason, "failed", plan);
    await markAuditStatus(audit.id, "failed", { error: reason });
    throw new Error(reason);
  }

  try {
    await prisma.post.update({
      where: { id: postId },
      data: { imageStatus: "generating", imageError: null }
    });
    await markAuditStatus(audit.id, "generating");

    let sourceBytes: Buffer;
    const validationNotes = [...plan.validationNotes];
    try {
      sourceBytes = await generateEditorialImage(plan.prompt);
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 700) : "Initial image generation failed.";
      validationNotes.push(`Initial prompt failed: ${message}`);
      await markAuditStatus(audit.id, "retrying", {
        error: message,
        validationNotes: stringifyJson(validationNotes)
      });
      sourceBytes = await generateEditorialImage(plan.simplifiedPrompt);
      validationNotes.push("Retry succeeded with simplified prompt.");
    }

    await prisma.post.update({
      where: { id: postId },
      data: { imageStatus: "upscaling" }
    });
    await markAuditStatus(audit.id, "upscaling");

    await prisma.post.update({
      where: { id: postId },
      data: { imageStatus: "optimizing" }
    });
    const variants = await storePostImageVariants(postId, sourceBytes);
    validationNotes.push("Responsive JPEG, WebP and AVIF variants generated.");
    await markAuditStatus(audit.id, "optimizing", {
      storage: variants.imageStorage,
      validationNotes: stringifyJson(validationNotes)
    });

    const now = new Date();
    const imageUrl = variants.thumbnailImage;
    const assets: StoredImageAssets = {
      imageUrl,
      featuredImageUrl: variants.featuredImage,
      featuredImage: variants.featuredImage,
      thumbnailImage: variants.thumbnailImage,
      openGraphImage: variants.featuredImage,
      twitterImage: variants.thumbnailImage,
      imageModel: model,
      imageGeneratedAt: now,
      imageStatus: options.statusWhenDone || "completed",
      imageAlt: plan.alt,
      imageCaption: plan.caption,
      imageDisclosure: plan.disclosure,
      imageSourceType: "ai",
      imageLicense: plan.license,
      imageCredit: plan.credit,
      imageStorage: variants.imageStorage,
      imagePrompt: plan.prompt,
      imageError: null,
      generatedImageId: audit.id,
      finalPrompt: plan.prompt
    };

    await prisma.post.update({
      where: { id: postId },
      data: {
        ...assets,
        imageError: null,
        featuredImageData: null,
        thumbnailImageData: null
      }
    });
    await markAuditStatus(audit.id, assets.imageStatus, {
      url: imageUrl,
      featuredUrl: variants.featuredImage,
      thumbnailUrl: variants.thumbnailImage,
      openGraphUrl: variants.featuredImage,
      twitterUrl: variants.thumbnailImage,
      webpUrl: variants.webpImage,
      avifUrl: variants.avifImage,
      width: variants.width,
      height: variants.height,
      format: variants.format,
      storage: variants.imageStorage,
      alt: assets.imageAlt,
      caption: assets.imageCaption,
      disclosure: assets.imageDisclosure,
      validationNotes: stringifyJson(validationNotes),
      metadata: stringifyJson({
        ...plan.metadata,
        responsiveImages: variants.responsiveImages
      }),
      error: null
    });
    logInfo("post_image_generated", {
      postId,
      model,
      category,
      imageStorage: variants.imageStorage,
      generatedImageId: audit.id
    });
    return assets;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 1000) : "Image generation failed.";
    const hasExisting = Boolean(
      post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage
    );
    if (hasExisting) {
      await prisma.post.update({
        where: { id: postId },
        data: {
          imageStatus: "failed",
          imageError: message,
          imageModel: model
        }
      });
    } else {
      await applyPlaceholderImageForPost(postId, post, message, "failed", plan);
    }
    await markAuditStatus(audit.id, "failed", { error: message });
    logError("post_image_generation_failed", error, { postId, model });
    throw error;
  }
}

export async function tryGenerateImageForPost(postId: string) {
  try {
    return await generateImageForPost(postId, { statusWhenDone: "completed" });
  } catch {
    return null;
  }
}
