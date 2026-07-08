import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { generateImageForPost } from "@/lib/aiImage";
import { prisma } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { logError } from "@/lib/logger";

const allowedImageHosts = [
  "images.unsplash.com",
  "unsplash.com",
  "images.pexels.com",
  "pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org"
];

const ImageActionSchema = z.object({
  mode: z
    .enum(["generate", "regenerate", "retry", "url", "prompt", "accept", "reject"])
    .default("generate"),
  imagePrompt: z.string().max(4000).optional(),
  imageUrl: z.string().optional(),
  imageLicense: z.string().optional(),
  imageCredit: z.string().optional()
});

async function imageDirectory(kind: "generated" | "uploads") {
  const directory = path.join(process.cwd(), "public", kind);
  await mkdir(directory, { recursive: true });
  return directory;
}

function imagePayload(post: {
  imageUrl: string | null;
  featuredImage: string | null;
  thumbnailImage: string | null;
  openGraphImage: string | null;
  twitterImage: string | null;
  imagePrompt: string | null;
  imageModel: string | null;
  imageGeneratedAt: Date | null;
  imageStatus: string;
  imageError: string | null;
  imageLicense: string | null;
  imageCredit: string | null;
}) {
  return {
    imageUrl: post.imageUrl,
    featuredImage: post.featuredImage,
    thumbnailImage: post.thumbnailImage,
    openGraphImage: post.openGraphImage,
    twitterImage: post.twitterImage,
    imagePrompt: post.imagePrompt,
    imageModel: post.imageModel,
    imageGeneratedAt: post.imageGeneratedAt,
    imageStatus: post.imageStatus,
    imageError: post.imageError,
    imageLicense: post.imageLicense,
    imageCredit: post.imageCredit
  };
}

export const maxDuration = 180;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";
    const post = await prisma.post.findUniqueOrThrow({ where: { id } });

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        return Response.json({ error: "Image file is required." }, { status: 400 });
      }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        return Response.json({ error: "Use JPEG, PNG or WebP." }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return Response.json({ error: "Image must be 5 MB or smaller." }, { status: 400 });
      }
      const extension =
        file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filename = `${randomUUID()}.${extension}`;
      await writeFile(
        path.join(await imageDirectory("uploads"), filename),
        Buffer.from(await file.arrayBuffer())
      );
      const imageUrl = `/uploads/${filename}`;
      const updated = await prisma.post.update({
        where: { id },
        data: {
          imageUrl,
          featuredImage: imageUrl,
          thumbnailImage: imageUrl,
          openGraphImage: imageUrl,
          twitterImage: imageUrl,
          imageStatus: "accepted",
          imageError: null,
          imageLicense: String(form.get("license") || "Owned/uploaded by publisher"),
          imageCredit: String(form.get("credit") || "Daily Signal Wire")
        }
      });
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    const body = ImageActionSchema.parse(await request.json().catch(() => ({})));

    if (body.mode === "prompt") {
      const updated = await prisma.post.update({
        where: { id },
        data: {
          imagePrompt: body.imagePrompt?.trim() || null,
          imageError: null
        }
      });
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    if (body.mode === "url") {
      let imageUrl: URL;
      try {
        imageUrl = new URL(body.imageUrl || "");
      } catch {
        return Response.json({ error: "Enter a valid image URL." }, { status: 400 });
      }
      if (
        imageUrl.protocol !== "https:" ||
        !allowedImageHosts.some(
          (host) => imageUrl.hostname === host || imageUrl.hostname.endsWith(`.${host}`)
        )
      ) {
        return Response.json(
          {
            error:
              "Only HTTPS images from Unsplash, Pexels or Wikimedia are allowed."
          },
          { status: 400 }
        );
      }
      if (!body.imageLicense?.trim() || !body.imageCredit?.trim()) {
        return Response.json(
          { error: "Image license and credit are required." },
          { status: 400 }
        );
      }
      const url = imageUrl.toString();
      const updated = await prisma.post.update({
        where: { id },
        data: {
          imageUrl: url,
          featuredImage: url,
          thumbnailImage: url,
          openGraphImage: url,
          twitterImage: url,
          imageStatus: "accepted",
          imageError: null,
          imageLicense: body.imageLicense.trim(),
          imageCredit: body.imageCredit.trim()
        }
      });
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    if (body.mode === "accept") {
      if (!post.imageUrl && !post.featuredImage) {
        return Response.json({ error: "Generate or upload an image first." }, { status: 400 });
      }
      const updated = await prisma.post.update({
        where: { id },
        data: {
          imageStatus: "accepted",
          imageError: null,
          imageLicense: post.imageLicense || "Illustration generated with AI.",
          imageCredit: post.imageCredit || "AI illustration / Daily Signal Wire"
        }
      });
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    if (body.mode === "reject") {
      const updated = await prisma.post.update({
        where: { id },
        data: {
          imageStatus: "rejected",
          imageError: null,
          imageUrl: null,
          featuredImage: null,
          thumbnailImage: null,
          openGraphImage: null,
          twitterImage: null,
          imageLicense: null,
          imageCredit: null
        }
      });
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 503 }
      );
    }

    const limited = rateLimit(requestKey(request, "generate-image"), {
      limit: 3,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json(
        { error: "Image generation rate limit reached." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const promptOverride = body.imagePrompt?.trim() || undefined;
    const result = await generateImageForPost(id, { promptOverride });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    logError("post_image_operation_failed", error);
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid image request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
