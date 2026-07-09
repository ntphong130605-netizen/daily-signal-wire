import { isAdmin } from "@/lib/auth";
import { prisma, safeDbQuery } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function imageResponse(base64: string) {
  return new Response(Buffer.from(base64, "base64"), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; variant: string }> }
) {
  const { id, variant } = await params;
  if (variant !== "featured" && variant !== "thumbnail") {
    return Response.json({ error: "Unsupported image variant." }, { status: 404 });
  }

  const post = await safeDbQuery(
    "post_database_image_query_failed",
    null,
    () =>
      prisma.post.findUnique({
        where: { id },
        select: {
          status: true,
          featuredImageData: true,
          thumbnailImageData: true
        }
      })
  );

  if (!post) return Response.json({ error: "Image not found." }, { status: 404 });
  if (post.status !== "published" && !(await isAdmin())) {
    return Response.json({ error: "Image not found." }, { status: 404 });
  }

  const data =
    variant === "featured" ? post.featuredImageData : post.thumbnailImageData;
  if (!data) return Response.json({ error: "Image not found." }, { status: 404 });

  return imageResponse(data);
}
