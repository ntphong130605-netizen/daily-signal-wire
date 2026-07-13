import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { generateImageForPost, storePostImageVariants } from "@/lib/aiImage";
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
    .enum([
      "generate",
      "regenerate",
      "retry",
      "url",
      "prompt",
      "accept",
      "reject",
      "remove",
      "use-version",
      "delete-version"
    ])
    .default("generate"),
  imageId: z.string().optional(),
  imagePrompt: z.string().max(4000).optional(),
  imageUrl: z.string().optional(),
  imageAlt: z.string().max(300).optional(),
  imageCaption: z.string().max(500).optional(),
  imageDisclosure: z.string().max(300).optional(),
  imageLicense: z.string().optional(),
  imageCredit: z.string().optional()
});

function imagePayload(post: {
  imageUrl: string | null;
  featuredImageUrl: string | null;
  featuredImage: string | null;
  thumbnailImage: string | null;
  openGraphImage: string | null;
  twitterImage: string | null;
  imagePrompt: string | null;
  imageModel: string | null;
  imageGeneratedAt: Date | null;
  imageStatus: string;
  imageError: string | null;
  imageStorage: string;
  imageAlt: string | null;
  imageCaption: string | null;
  imageDisclosure: string | null;
  imageSourceType: string;
  imageLicense: string | null;
  imageCredit: string | null;
}) {
  return {
    imageUrl: post.imageUrl,
    featuredImageUrl: post.featuredImageUrl,
    featuredImage: post.featuredImage,
    thumbnailImage: post.thumbnailImage,
    openGraphImage: post.openGraphImage,
    twitterImage: post.twitterImage,
    imagePrompt: post.imagePrompt,
    imageModel: post.imageModel,
    imageGeneratedAt: post.imageGeneratedAt,
    imageStatus: post.imageStatus,
    imageError: post.imageError,
    imageStorage: post.imageStorage,
    imageAlt: post.imageAlt,
    imageCaption: post.imageCaption,
    imageDisclosure: post.imageDisclosure,
    imageSourceType: post.imageSourceType,
    imageLicense: post.imageLicense,
    imageCredit: post.imageCredit
  };
}

async function recordImageVersion({
  postId,
  prompt,
  status,
  url,
  featuredUrl,
  thumbnailUrl,
  openGraphUrl,
  twitterUrl,
  alt,
  caption,
  disclosure,
  sourceType,
  license,
  credit,
  storage,
  model,
  width,
  height,
  format,
  title,
  description,
  illustrative = sourceType === "ai",
  metadata = {},
  validationNotes = []
}: {
  postId: string;
  prompt: string;
  status: string;
  url?: string | null;
  featuredUrl?: string | null;
  thumbnailUrl?: string | null;
  openGraphUrl?: string | null;
  twitterUrl?: string | null;
  alt?: string | null;
  caption?: string | null;
  disclosure?: string | null;
  sourceType: string;
  license?: string | null;
  credit?: string | null;
  storage?: string | null;
  model?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  title?: string | null;
  description?: string | null;
  illustrative?: boolean;
  metadata?: Record<string, unknown>;
  validationNotes?: string[];
}) {
  return prisma.generatedImage.create({
    data: {
      postId,
      prompt,
      finalPrompt: prompt,
      generator: sourceType === "ai" ? "openai-images" : "publisher",
      model,
      status,
      url,
      featuredUrl,
      thumbnailUrl,
      openGraphUrl,
      twitterUrl,
      alt,
      title,
      description,
      caption,
      disclosure,
      sourceType,
      illustrative,
      storage,
      width,
      height,
      format,
      metadata: JSON.stringify(metadata),
      validationNotes: JSON.stringify(validationNotes),
      license,
      credit
    }
  });
}

async function markCurrentImageVersion(postId: string, status: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      imageUrl: true,
      featuredImageUrl: true,
      featuredImage: true,
      thumbnailImage: true
    }
  });
  const urls = [
    post?.imageUrl,
    post?.featuredImageUrl,
    post?.featuredImage,
    post?.thumbnailImage
  ].filter(Boolean) as string[];
  if (!urls.length) return;
  await prisma.generatedImage.updateMany({
    where: {
      postId,
      OR: [
        { url: { in: urls } },
        { featuredUrl: { in: urls } },
        { thumbnailUrl: { in: urls } }
      ]
    },
    data: { status }
  });
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
      const sourceBytes = Buffer.from(await file.arrayBuffer());
      const stored = await storePostImageVariants(id, sourceBytes);
      const imageUrl = stored.thumbnailImage;
      const featuredImage = stored.featuredImage;
      const thumbnailImage = stored.thumbnailImage;

      const updated = await prisma.post.update({
        where: { id },
        data: {
          imageUrl,
          featuredImageUrl: featuredImage,
          featuredImage,
          thumbnailImage,
          openGraphImage: featuredImage,
          twitterImage: thumbnailImage,
          imageStorage: stored.imageStorage,
          featuredImageData: null,
          thumbnailImageData: null,
          imageStatus: "accepted",
          imageError: null,
          imageAlt:
            String(form.get("alt") || "").trim() ||
            `Editorial image for “${post.title}”`,
          imageCaption:
            String(form.get("caption") || "").trim() ||
            "Publisher-uploaded editorial image.",
          imageDisclosure: null,
          imageSourceType: "upload",
          imageLicense: String(form.get("license") || "Owned/uploaded by publisher"),
          imageCredit: String(form.get("credit") || "Daily Signal Wire")
        }
      });
      await recordImageVersion({
        postId: id,
        prompt: "Manual upload replacement",
        status: "accepted",
        url: imageUrl,
        featuredUrl: featuredImage,
        thumbnailUrl: thumbnailImage,
        openGraphUrl: featuredImage,
        twitterUrl: thumbnailImage,
        alt: updated.imageAlt,
        caption: updated.imageCaption,
        disclosure: updated.imageDisclosure,
        sourceType: "upload",
        license: updated.imageLicense,
        credit: updated.imageCredit,
        storage: stored.imageStorage,
        width: stored.width,
        height: stored.height,
        format: stored.format,
        title: `Uploaded editorial image for ${post.title}`,
        description: updated.imageCaption,
        illustrative: false,
        metadata: { responsiveImages: stored.responsiveImages },
        validationNotes: ["Manual upload accepted by editor.", "Responsive variants generated."]
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
          featuredImageUrl: url,
          featuredImage: url,
          thumbnailImage: url,
          openGraphImage: url,
          twitterImage: url,
          imageStorage: "url",
          featuredImageData: null,
          thumbnailImageData: null,
          imageStatus: "accepted",
          imageError: null,
          imageAlt: body.imageAlt?.trim() || `Editorial image for “${post.title}”`,
          imageCaption: body.imageCaption?.trim() || "Licensed editorial image.",
          imageDisclosure: body.imageDisclosure?.trim() || null,
          imageSourceType: "licensed_url",
          imageLicense: body.imageLicense.trim(),
          imageCredit: body.imageCredit.trim()
        }
      });
      await recordImageVersion({
        postId: id,
        prompt: "Licensed image URL",
        status: "accepted",
        url,
        featuredUrl: url,
        thumbnailUrl: url,
        openGraphUrl: url,
        twitterUrl: url,
        alt: updated.imageAlt,
        caption: updated.imageCaption,
        disclosure: updated.imageDisclosure,
        sourceType: "licensed_url",
        license: updated.imageLicense,
        credit: updated.imageCredit,
        storage: "url",
        title: `Licensed editorial image for ${post.title}`,
        description: updated.imageCaption,
        illustrative: false,
        validationNotes: ["Licensed URL saved by editor.", "Host allowlist verified."]
      });
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    if (body.mode === "use-version") {
      if (!body.imageId) {
        return Response.json({ error: "Image version is required." }, { status: 400 });
      }
      const version = await prisma.generatedImage.findFirst({
        where: { id: body.imageId, postId: id }
      });
      if (!version || !(version.featuredUrl || version.url)) {
        return Response.json({ error: "Image version was not found." }, { status: 404 });
      }
      const featuredImage = version.featuredUrl || version.url || "";
      const thumbnailImage = version.thumbnailUrl || version.url || featuredImage;
      const updated = await prisma.post.update({
        where: { id },
        data: {
          imageUrl: version.url || thumbnailImage,
          featuredImageUrl: featuredImage,
          featuredImage,
          thumbnailImage,
          openGraphImage: version.openGraphUrl || featuredImage,
          twitterImage: version.twitterUrl || thumbnailImage,
          imageStorage: version.storage || "url",
          featuredImageData: null,
          thumbnailImageData: null,
          imageStatus: "accepted",
          imageError: null,
          imageAlt: version.alt || `Editorial image for “${post.title}”`,
          imageCaption: version.caption || "Editorial image.",
          imageDisclosure: version.disclosure,
          imageSourceType: version.sourceType || "ai",
          imageLicense: version.license,
          imageCredit: version.credit,
          imageModel: version.model || post.imageModel,
          imagePrompt: version.finalPrompt || version.prompt || post.imagePrompt
        }
      });
      await prisma.generatedImage.update({
        where: { id: version.id },
        data: { status: "accepted" }
      });
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    if (body.mode === "delete-version") {
      if (!body.imageId) {
        return Response.json({ error: "Image version is required." }, { status: 400 });
      }
      const version = await prisma.generatedImage.findFirst({
        where: { id: body.imageId, postId: id }
      });
      if (!version) {
        return Response.json({ error: "Image version was not found." }, { status: 404 });
      }
      await prisma.generatedImage.delete({ where: { id: version.id } });
      return Response.json({ ok: true, deletedImageId: version.id, ...imagePayload(post) });
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
          imageAlt: post.imageAlt || `Editorial image for “${post.title}”`,
          imageCaption:
            post.imageCaption ||
            (post.imageModel
              ? "AI-generated editorial image."
              : "Editorial image."),
          imageDisclosure:
            post.imageDisclosure ||
            (post.imageModel ? "AI-generated editorial image." : null),
          imageSourceType:
            post.imageSourceType === "placeholder"
              ? "placeholder"
              : post.imageSourceType || (post.imageModel ? "ai" : "upload"),
          imageLicense: post.imageLicense || "Image generated with AI.",
          imageCredit: post.imageCredit || "AI image generation / Daily Signal Wire"
        }
      });
      await markCurrentImageVersion(id, "accepted");
      return Response.json({ ok: true, ...imagePayload(updated) });
    }

    if (body.mode === "reject" || body.mode === "remove") {
      await markCurrentImageVersion(id, body.mode === "reject" ? "rejected" : "deleted");
      const updated = await prisma.post.update({
        where: { id },
        data: {
          imageStatus: "rejected",
          imageError: null,
          imageUrl: null,
          featuredImageUrl: null,
          featuredImage: null,
          thumbnailImage: null,
          openGraphImage: null,
          twitterImage: null,
          imageStorage: "url",
          featuredImageData: null,
          thumbnailImageData: null,
          imageAlt: null,
          imageCaption: null,
          imageDisclosure: null,
          imageSourceType: "placeholder",
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

    const hasExistingReusableImage = Boolean(
      (post.featuredImageUrl || post.featuredImage || post.imageUrl || post.thumbnailImage) &&
        ["accepted", "completed"].includes(post.imageStatus)
    );
    const force = body.mode === "regenerate" || body.mode === "retry";
    const promptOverride =
      force || !hasExistingReusableImage ? body.imagePrompt?.trim() || undefined : undefined;
    const result = await generateImageForPost(id, {
      promptOverride,
      force
    });
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
