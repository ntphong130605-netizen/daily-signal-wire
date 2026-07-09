import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { logError, logInfo } from "@/lib/logger";

const FEATURED_SIZE = { width: 1920, height: 1080 };
const THUMBNAIL_SIZE = { width: 1200, height: 675 };

type ImageContext = {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  imagePrompt: string | null;
  trend?: { category: string | null } | null;
  category?: { name: string | null } | null;
  sourceStory?: { feed?: { category?: { name: string | null } | null } | null } | null;
};

export type StoredImageAssets = {
  imageUrl: string;
  featuredImage: string;
  thumbnailImage: string;
  openGraphImage: string;
  twitterImage: string;
  imageModel: string;
  imageGeneratedAt: Date;
  imageStatus: string;
  imageLicense: string;
  imageCredit: string;
  imageStorage: string;
};

function imageModel() {
  return process.env.IMAGE_MODEL || "gpt-image-2";
}

function imageDirectory() {
  return path.join(process.cwd(), "public", "generated");
}

function imageStorageMode() {
  const configured = process.env.IMAGE_STORAGE?.trim().toLowerCase();
  if (configured === "local" || configured === "database") return configured;
  return process.env.VERCEL || process.env.NODE_ENV === "production"
    ? "database"
    : "local";
}

function articleCategory(post: ImageContext) {
  return (
    post.category?.name ||
    post.trend?.category ||
    post.sourceStory?.feed?.category?.name ||
    "Editorial"
  );
}

function compactText(value: string, max = 850) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function buildEditorialImagePrompt(post: ImageContext, promptOverride?: string) {
  const category = articleCategory(post);
  const prompt = promptOverride?.trim() || post.imagePrompt?.trim();
  if (!prompt) {
    throw new Error("Add an image prompt before generating an image.");
  }

  return `${prompt}

Article title: ${post.title}
Article category: ${category}
Article excerpt: ${post.excerpt}
Article context: ${compactText(post.content)}

Create a high-quality editorial image for a modern American news publication.

Required visual style:
- photorealistic editorial illustration
- ultra realistic
- 8K look
- editorial magazine quality
- cinematic lighting
- high detail
- newspaper style
- professional composition
- landscape 16:9 composition

Hard constraints:
- no watermark
- no readable text
- no logo
- no border
- no frame
- no captions
- no fake screenshot
- no brand marks

Editorial safety:
If the article discusses a real event, public controversy, crime, accident, disaster, court matter, political action, breaking news, or developing report, DO NOT make the image look like a documentary photograph, eyewitness photo, scene photo, evidence photo, mugshot, press photo, or real event capture. Instead, create a staged, symbolic, photorealistic editorial illustration that communicates the topic without pretending to document the event.

For Technology, Business, Lifestyle, Sports, Food, and Travel articles, a very realistic illustrative image is allowed, but it must still be a non-deceptive editorial illustration and must not imply that it is a real photo from the reported event.

The final image must feel like a premium newspaper or magazine visual package, not social-media clip art.`;
}

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export async function generateEditorialImage(prompt: string) {
  const result = await client().images.generate({
    model: imageModel(),
    prompt,
    size: "1536x1024",
    quality: "high"
  });

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

export async function storePostImageVariants(postId: string, sourceBytes: Buffer) {
  const stamp = `${postId}-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const { featuredBuffer, thumbnailBuffer } = await renderImageVariants(sourceBytes);

  if (imageStorageMode() === "local") {
    try {
      const directory = imageDirectory();
      await mkdir(directory, { recursive: true });
      const featuredName = `${stamp}-1920x1080.jpg`;
      const thumbnailName = `${stamp}-1200x675.jpg`;
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
    } catch (error) {
      logError("local_image_storage_failed_using_database", error, { postId });
    }
  }

  return {
    imageStorage: "database",
    featuredImage: `/api/images/posts/${postId}/featured?v=${stamp}`,
    thumbnailImage: `/api/images/posts/${postId}/thumbnail?v=${stamp}`,
    featuredImageData: featuredBuffer.toString("base64"),
    thumbnailImageData: thumbnailBuffer.toString("base64")
  };
}

async function writeImageVariants(postId: string, sourceBytes: Buffer) {
  return storePostImageVariants(postId, sourceBytes);
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

  await prisma.post.update({
    where: { id: postId },
    data: {
      imagePrompt: options.promptOverride?.trim() || post.imagePrompt,
      imageModel: model,
      imageStatus: "generating",
      imageError: null
    }
  });

  try {
    const sourceBytes = await generateEditorialImage(finalPrompt);
    const variants = await writeImageVariants(postId, sourceBytes);
    const now = new Date();
    const imageUrl = variants.thumbnailImage;
    const assets: StoredImageAssets = {
      imageUrl,
      featuredImage: variants.featuredImage,
      thumbnailImage: variants.thumbnailImage,
      openGraphImage: variants.featuredImage,
      twitterImage: variants.thumbnailImage,
      imageModel: model,
      imageGeneratedAt: now,
      imageStatus: options.statusWhenDone || "completed",
      imageLicense: "Illustration generated with AI.",
      imageCredit: "AI illustration / Daily Signal Wire",
      imageStorage: variants.imageStorage
    };

    await prisma.post.update({
      where: { id: postId },
      data: {
        ...assets,
        imageError: null,
        featuredImageData: variants.featuredImageData,
        thumbnailImageData: variants.thumbnailImageData
      }
    });
    logInfo("post_image_generated", {
      postId,
      model,
      imageStorage: variants.imageStorage
    });
    return assets;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Image generation failed.";
    await prisma.post.update({
      where: { id: postId },
      data: {
        imageStatus: "failed",
        imageError: message,
        imageModel: model
      }
    });
    logError("post_image_generation_failed", error, { postId, model });
    throw error;
  }
}

export async function tryGenerateImageForPost(postId: string) {
  if (!process.env.OPENAI_API_KEY) {
    await prisma.post
      .update({
        where: { id: postId },
        data: {
          imageStatus: "idle",
          imageError: "OPENAI_API_KEY is not configured."
        }
      })
      .catch((error) => logError("post_image_skip_status_failed", error, { postId }));
    return null;
  }

  try {
    return await generateImageForPost(postId);
  } catch {
    return null;
  }
}
