import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { put } from "@vercel/blob";
import sharp from "sharp";

const prisma = new PrismaClient();
const FEATURED_SIZE = { width: 1600, height: 900 };
const THUMBNAIL_SIZE = { width: 1200, height: 675 };
const IMAGE_API_TIMEOUT_MS = 120_000;

function configured() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.OPENAI_API_KEY &&
      (process.env.BLOB_READ_WRITE_TOKEN ||
        (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN))
  );
}

function imageModel() {
  const configuredModel = process.env.IMAGE_MODEL?.trim();
  if (!configuredModel || configuredModel === "gpt-image-2") return "gpt-image-1";
  return configuredModel;
}

function hasPlaceholderImage(post: {
  imageUrl: string | null;
  featuredImageUrl: string | null;
  featuredImage: string | null;
  thumbnailImage: string | null;
  imageSourceType: string;
}) {
  const values = [
    post.imageUrl,
    post.featuredImageUrl,
    post.featuredImage,
    post.thumbnailImage
  ].filter(Boolean) as string[];
  return (
    values.length === 0 ||
    post.imageSourceType === "placeholder" ||
    values.some((value) => value.startsWith("/editorial/") || value.endsWith(".svg"))
  );
}

function compactText(value: string, max = 1100) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function buildPrompt(post: {
  title: string;
  subtitle: string | null;
  excerpt: string;
  summary: string | null;
  content: string;
  imagePrompt: string | null;
  category?: { name: string | null } | null;
  trend?: { category: string | null } | null;
}) {
  const category = post.category?.name || post.trend?.category || "News";
  const summary = compactText(
    `${post.subtitle || ""}\n${post.summary || ""}\n${post.excerpt}\n${post.content}`
  );
  return `${post.imagePrompt || `A realistic editorial news photograph for: ${post.title}.`}

Article context:
- Title: ${post.title}
- Category: ${category}
- Summary: ${summary}

Create a realistic editorial news photograph in a professional Reuters/AP-style composition. Use natural lighting, realistic people or objects only when clearly supported by the story context, high detail, natural skin tones when people appear, and a clean 16:9 landscape crop.

Hard constraints:
- not cartoon
- not illustration
- not painting
- not anime
- not 3D render
- no readable text
- no watermark
- no logo
- no border
- no frame

If the story concerns a real event, public figure, crime, disaster, court matter, accident, war, political controversy, or developing report, make the image staged and generic rather than a documentary photo, eyewitness photo, evidence image, mugshot, press photo, or actual event capture.`;
}

async function generateImage(prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_API_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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
    const result = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(
        result.error?.message || `Image API failed with HTTP ${response.status}.`
      );
    }
    const item = result.data?.[0];
    if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
    if (item?.url) {
      const download = await fetch(item.url);
      if (!download.ok) throw new Error(`Image download failed with ${download.status}`);
      return Buffer.from(await download.arrayBuffer());
    }
    throw new Error("Image API returned no image data.");
  } finally {
    clearTimeout(timeout);
  }
}

async function renderVariants(source: Buffer) {
  const featured = await sharp(source)
    .resize(FEATURED_SIZE.width, FEATURED_SIZE.height, {
      fit: "cover",
      position: "attention"
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const thumbnail = await sharp(source)
    .resize(THUMBNAIL_SIZE.width, THUMBNAIL_SIZE.height, {
      fit: "cover",
      position: "attention"
    })
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  return { featured, thumbnail };
}

async function upload(postId: string, featured: Buffer, thumbnail: Buffer) {
  const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const folder = `daily-signal-wire/posts/${postId}`;
  const [featuredBlob, thumbnailBlob] = await Promise.all([
    put(
      `${folder}/${stamp}-1600x900.jpg`,
      new Blob([new Uint8Array(featured)], { type: "image/jpeg" }),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/jpeg",
        cacheControlMaxAge: 60 * 60 * 24 * 365
      }
    ),
    put(
      `${folder}/${stamp}-1200x675.jpg`,
      new Blob([new Uint8Array(thumbnail)], { type: "image/jpeg" }),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/jpeg",
        cacheControlMaxAge: 60 * 60 * 24 * 365
      }
    )
  ]);
  return { featuredUrl: featuredBlob.url, thumbnailUrl: thumbnailBlob.url };
}

async function main() {
  if (!configured()) {
    console.log("Image backfill skipped: database, OpenAI, or Blob storage is not configured.");
    return;
  }

  const limit = Math.max(1, Math.min(20, Number(process.env.IMAGE_BACKFILL_LIMIT || 20)));
  const candidates = await prisma.post.findMany({
    where: { status: "published" },
    include: {
      category: { select: { name: true } },
      trend: { select: { category: true } }
    },
    orderBy: { publishedAt: "desc" },
    take: 100
  });
  const posts = candidates.filter(hasPlaceholderImage).slice(0, limit);

  if (!posts.length) {
    console.log("Image backfill complete: no placeholder images found.");
    return;
  }

  console.log(`Image backfill: generating ${posts.length} published article images.`);
  for (const post of posts) {
    try {
      const prompt = buildPrompt(post);
      const source = await generateImage(prompt);
      const { featured, thumbnail } = await renderVariants(source);
      const { featuredUrl, thumbnailUrl } = await upload(post.id, featured, thumbnail);
      await prisma.post.update({
        where: { id: post.id },
        data: {
          imagePrompt: prompt,
          imageModel: imageModel(),
          imageGeneratedAt: new Date(),
          imageStatus: "accepted",
          imageError: null,
          imageUrl: thumbnailUrl,
          featuredImageUrl: featuredUrl,
          featuredImage: featuredUrl,
          thumbnailImage: thumbnailUrl,
          openGraphImage: featuredUrl,
          twitterImage: thumbnailUrl,
          imageStorage: "vercel-blob",
          featuredImageData: null,
          thumbnailImageData: null,
          imageAlt: post.imageAlt || `Editorial news image for “${post.title}”`,
          imageCaption: "AI-generated editorial image.",
          imageDisclosure: "AI-generated editorial image.",
          imageSourceType: "ai",
          imageLicense: "AI-generated editorial image.",
          imageCredit: "Daily Signal Wire / AI image generation"
        }
      });
      console.log(`Image backfill: ${post.slug} updated.`);
    } catch (error) {
      console.warn(
        `Image backfill failed for ${post.slug}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

main()
  .catch((error) => {
    console.warn(
      `Image backfill skipped after error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
