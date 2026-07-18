import sharp from "sharp";
import { normalizeEditorialImageUrl, placeholderImageForCategory } from "@/lib/editorialImages";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const sizes = {
  square: { width: 1200, height: 1200 },
  vertical: { width: 1080, height: 1920 },
  og: { width: 1600, height: 900 },
  facebook: { width: 1200, height: 630 },
  twitter: { width: 1600, height: 900 },
  linkedin: { width: 1200, height: 627 },
  pinterest: { width: 1000, height: 1500 }
} as const;

async function fetchImageBytes(url: string) {
  const resolved = /^https?:\/\//i.test(url) ? url : absoluteUrl(url);
  const response = await fetch(resolved);
  if (!response.ok) throw new Error(`Unable to load source image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; variant: string }> }
) {
  const { id, variant } = await params;
  const size = sizes[variant as keyof typeof sizes];
  if (!size) return Response.json({ error: "Unsupported social image variant." }, { status: 404 });

  const socialPost = await safeDbQuery("social_image_lookup_failed", null, () =>
    prisma.socialPost.findUnique({
      where: { id },
      include: {
        article: {
          select: {
            status: true,
            title: true,
            openGraphImage: true,
            featuredImageUrl: true,
            featuredImage: true,
            imageUrl: true,
            thumbnailImage: true,
            category: { select: { name: true } },
            trend: { select: { category: true } }
          }
        }
      }
    })
  );

  if (!socialPost || socialPost.article.status !== "published") {
    return Response.json({ error: "Image not found." }, { status: 404 });
  }

  const category = socialPost.article.category?.name || socialPost.article.trend?.category || "Latest";
  const image = normalizeEditorialImageUrl(
    socialPost.sourceImage ||
      socialPost.article.openGraphImage ||
      socialPost.article.featuredImageUrl ||
      socialPost.article.featuredImage ||
      socialPost.article.imageUrl ||
      socialPost.article.thumbnailImage ||
      placeholderImageForCategory(category),
    category
  );

  try {
    const source = await fetchImageBytes(image);
    const output = await sharp(source)
      .resize(size.width, size.height, { fit: "cover", position: "attention" })
      .webp({ quality: 86 })
      .toBuffer();
    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return Response.redirect(absoluteUrl(placeholderImageForCategory(category)), 302);
  }
}
