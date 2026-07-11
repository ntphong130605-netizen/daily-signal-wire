import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";

const FEATURED_SIZE = { width: 1600, height: 900 };
const THUMBNAIL_SIZE = { width: 1200, height: 675 };
const AI_DISCLOSURE = "AI-generated editorial image.";
const IMAGE_API_TIMEOUT_MS = 120_000;

type ImageContext = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  imagePrompt: string | null;
  imageUrl?: string | null;
  featuredImage?: string | null;
  featuredImageUrl?: string | null;
  thumbnailImage?: string | null;
  trend?: { category: string | null } | null;
  category?: { name: string | null } | null;
  sourceStory?: { feed?: { category?: { name: string | null } | null } | null } | null;
};

export type ArticleImageRequest = {
  title: string;
  excerpt: string;
  category?: string | null;
  contentSummary: string;
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

  // `database` existed in an older build. Keep the app safe, but do not write
  // new image files into database columns anymore.
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

function compactText(value: string, max = 900) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function placeholderImageForCategory(category?: string | null) {
  const value = (category || "").toLowerCase();
  if (value.includes("sport")) return "/editorial/sports-desk.svg";
  if (value.includes("money") || value.includes("business")) {
    return "/editorial/money-context.svg";
  }
  if (value.includes("tech") || value.includes("ai")) {
    return "/editorial/responsible-ai.svg";
  }
  if (value.includes("entertain") || value.includes("culture")) {
    return "/editorial/culture-wire.svg";
  }
  if (value.includes("science")) return "/editorial/science-context.svg";
  if (value.includes("world") || value.includes("us news")) {
    return "/editorial/developing-story.svg";
  }
  return "/editorial/source-first-newsroom.svg";
}

function imageAltFor(title: string) {
  return `Editorial news image for “${title}”`;
}

function imageCaptionFor(sourceType: StoredImageAssets["imageSourceType"]) {
  if (sourceType === "ai") return "AI-generated editorial image.";
  if (sourceType === "upload") return "Publisher-uploaded editorial image.";
  if (sourceType === "licensed_url") return "Licensed editorial image.";
  return "Daily Signal Wire fallback editorial image.";
}

export function buildArticleImagePrompt({
  title,
  excerpt,
  category,
  contentSummary,
  imagePrompt
}: ArticleImageRequest) {
  const base =
    imagePrompt?.trim() ||
    `A realistic editorial news image about: ${title}.`;
  const categoryLabel = category || "Editorial";
  const summary = compactText(`${excerpt}\n${contentSummary}`, 1100);

  return `${base}

Use the following article-specific context. The visual concept must be based directly on this story, not a generic newsroom image:
- Article title: ${title}
- Category: ${categoryLabel}
- Article summary: ${summary}
- Main event or issue: infer only from the supplied article summary
- Important people, objects, setting, or location: include only when clearly implied by the title or summary
- Visual mood: professional, modern, source-first news coverage
- Editorial context: a realistic editorial image for a US-facing digital newspaper

Create a realistic editorial news photography-style image with professional AP/Reuters-style composition, natural lighting, high detail, natural skin tones where people are shown, and a landscape 16:9 crop suitable for 1600x900 cover use.

Hard constraints:
- not cartoon
- not illustration
- not painting
- not anime
- not 3D render
- not fantasy art
- no readable text
- no watermark
- no logo
- no border
- no frame
- no fake screenshot
- no brand marks

Editorial safety:
If this story concerns a real event, celebrity, public figure, crime, disaster, court matter, political controversy, accident, war, or developing report, DO NOT make the image look like a real documentary photo, eyewitness photo, evidence image, mugshot, press photo, or actual event capture. Make it a staged, generic, photorealistic editorial news image instead, so readers are not misled about what the image depicts.`;
}

export function buildEditorialImagePrompt(post: ImageContext, promptOverride?: string) {
  return buildArticleImagePrompt({
    title: post.title,
    excerpt: post.excerpt,
    category: articleCategory(post),
    contentSummary: post.content,
    imagePrompt: promptOverride?.trim() || post.imagePrompt
  });
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
        result.error?.message ||
          `Image API failed with HTTP ${response.status}.`
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

async function renderImageVariants(sourceBytes: Buffer) {
  const featuredBuffer = await sharp(sourceBytes)
    .resize(FEATURED_SIZE.width, FEATURED_SIZE.height, {
      fit: "cover",
      position: "attention"
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  const thumbnailBuffer = await sharp(sourceBytes)
    .resize(THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height, {
      fit: "cover",
      position: "attention"
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  return { featuredBuffer, thumbnailBuffer };
}

async function uploadToVercelBlob(postId: string, stamp: string, featuredBuffer: Buffer, thumbnailBuffer: Buffer) {
  if (!isBlobStorageConfigured()) {
    throw new Error(
      "AI image storage is not configured. Connect Vercel Blob or add BLOB_READ_WRITE_TOKEN."
    );
  }

  const folder = `daily-signal-wire/posts/${postId}`;
  const [featured, thumbnail] = await Promise.all([
    put(
      `${folder}/${stamp}-1600x900.jpg`,
      new Blob([new Uint8Array(featuredBuffer)], { type: "image/jpeg" }),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/jpeg",
        cacheControlMaxAge: 60 * 60 * 24 * 365
      }
    ),
    put(
      `${folder}/${stamp}-1200x675.jpg`,
      new Blob([new Uint8Array(thumbnailBuffer)], { type: "image/jpeg" }),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/jpeg",
        cacheControlMaxAge: 60 * 60 * 24 * 365
      }
    )
  ]);

  return {
    imageStorage: "vercel-blob",
    featuredImage: featured.url,
    thumbnailImage: thumbnail.url,
    featuredImageData: null,
    thumbnailImageData: null
  };
}

export async function storePostImageVariants(postId: string, sourceBytes: Buffer) {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const { featuredBuffer, thumbnailBuffer } = await renderImageVariants(sourceBytes);
  const mode = normalizedImageStorageMode();

  if (mode === "blob") {
    return uploadToVercelBlob(postId, stamp, featuredBuffer, thumbnailBuffer);
  }

  if (mode === "local" && !process.env.VERCEL) {
    const directory = imageDirectory();
    await mkdir(directory, { recursive: true });
    const featuredName = `${postId}-${stamp}-1600x900.jpg`;
    const thumbnailName = `${postId}-${stamp}-1200x675.jpg`;
    const featuredPath = path.join(directory, featuredName);
    const thumbnailPath = path.join(directory, thumbnailName);

    await Promise.all([
      writeFile(featuredPath, featuredBuffer),
      writeFile(thumbnailPath, thumbnailBuffer)
    ]);

    return {
      imageStorage: "local",
      featuredImage: `/generated/${featuredName}`,
      thumbnailImage: `/generated/${thumbnailName}`,
      featuredImageData: null,
      thumbnailImageData: null
    };
  }

  throw new Error(
    "Persistent image storage is not configured. Use Vercel Blob for production AI images."
  );
}

export async function generateArticleImage({
  postId,
  title,
  excerpt,
  category,
  contentSummary,
  imagePrompt
}: ArticleImageRequest & { postId: string }) {
  const finalPrompt = buildArticleImagePrompt({
    title,
    excerpt,
    category,
    contentSummary,
    imagePrompt
  });
  const sourceBytes = await generateEditorialImage(finalPrompt);
  const variants = await storePostImageVariants(postId, sourceBytes);
  return { finalPrompt, variants };
}

async function applyPlaceholderImageForPost(
  postId: string,
  post: ImageContext,
  reason: string,
  status: "failed" | "idle" = "failed"
) {
  const category = articleCategory(post);
  const placeholder = placeholderImageForCategory(category);
  return prisma.post.update({
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
      imageAlt: imageAltFor(post.title),
      imageCaption: imageCaptionFor("placeholder"),
      imageDisclosure: null,
      imageSourceType: "placeholder",
      imageStatus: status,
      imageError: reason
    }
  });
}

export async function generateImageForPost(
  postId: string,
  options: { promptOverride?: string; statusWhenDone?: "completed" | "accepted" } = {}
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
  const finalPrompt = buildEditorialImagePrompt(post, options.promptOverride);
  const model = imageModel();
  const category = articleCategory(post);

  if (!process.env.OPENAI_API_KEY) {
    const reason = "AI image generation is not configured.";
    await applyPlaceholderImageForPost(postId, post, reason);
    throw new Error(reason);
  }

  if (!isGeneratedImageStorageConfigured()) {
    const reason =
      "AI image storage is not configured. Connect Vercel Blob before generating production images.";
    await applyPlaceholderImageForPost(postId, post, reason);
    throw new Error(reason);
  }

  await prisma.post.update({
    where: { id: postId },
    data: {
      imagePrompt: finalPrompt,
      imageModel: model,
      imageStatus: "generating",
      imageError: null
    }
  });

  try {
    const sourceBytes = await generateEditorialImage(finalPrompt);
    const variants = await storePostImageVariants(postId, sourceBytes);
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
      imageAlt: imageAltFor(post.title),
      imageCaption: imageCaptionFor("ai"),
      imageDisclosure: AI_DISCLOSURE,
      imageSourceType: "ai",
      imageLicense: "AI-generated editorial image.",
      imageCredit: "Daily Signal Wire / AI image generation",
      imageStorage: variants.imageStorage
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
    logInfo("post_image_generated", {
      postId,
      model,
      category,
      imageStorage: variants.imageStorage
    });
    return assets;
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 1000) : "Image generation failed.";
    const hasExistingImage =
      Boolean(post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage);
    if (hasExistingImage) {
      await prisma.post.update({
        where: { id: postId },
        data: {
          imageStatus: "failed",
          imageError: message,
          imageModel: model
        }
      });
    } else {
      await applyPlaceholderImageForPost(postId, post, message);
    }
    logError("post_image_generation_failed", error, { postId, model });
    throw error;
  }
}

export async function tryGenerateImageForPost(postId: string) {
  try {
    return await generateImageForPost(postId);
  } catch {
    return null;
  }
}
