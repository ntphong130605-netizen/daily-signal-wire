import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPostEditor from "@/components/AdminPostEditor";
import { parseJsonArray, parseStringArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";

export default async function AdminPostEditPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await safeDbQuery(
    "admin_post_edit_query_failed",
    null,
    () =>
      prisma.post.findUnique({
        where: { id },
        include: {
          generatedImages: {
            orderBy: { createdAt: "desc" },
            take: 16
          }
        }
      })
  );

  if (!post) notFound();

  return (
    <>
      <header className="admin-header detail-header">
        <div>
          <Link className="back-link" href="/admin/posts">
            ← Posts
          </Link>
          <p className="eyebrow">Editorial control</p>
          <h1>Edit draft</h1>
          <p>Update copy, image, source notes and final publish approval.</p>
        </div>
        <div className="header-badge">Human review required</div>
      </header>
      <AdminPostEditor
        aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
        initialPost={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          subtitle: post.subtitle || "",
          excerpt: post.excerpt,
          summary: post.summary || "",
          content: post.content,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          openGraphDescription: post.openGraphDescription || "",
          facebookCaption: post.facebookCaption,
          tags: parseStringArray(post.tags),
          faq: parseJsonArray<{ question: string; answer: string }>(post.faq),
          imagePrompt: post.imagePrompt || "",
          imageStatus: post.imageStatus,
          imageError: post.imageError || "",
          imageUrl: post.imageUrl || "",
          featuredImageUrl: post.featuredImageUrl || "",
          featuredImage: post.featuredImage || "",
          thumbnailImage: post.thumbnailImage || "",
          openGraphImage: post.openGraphImage || "",
          twitterImage: post.twitterImage || "",
          imageAlt: post.imageAlt || "",
          imageCaption: post.imageCaption || "",
          imageDisclosure: post.imageDisclosure || "",
          imageSourceType: post.imageSourceType || "placeholder",
          imageLicense: post.imageLicense || "",
          imageCredit: post.imageCredit || "",
          generatedImages: post.generatedImages.map((image) => ({
            id: image.id,
            prompt: image.prompt,
            finalPrompt: image.finalPrompt || "",
            generator: image.generator || "",
            model: image.model || "",
            status: image.status,
            url: image.url || "",
            featuredUrl: image.featuredUrl || "",
            thumbnailUrl: image.thumbnailUrl || "",
            openGraphUrl: image.openGraphUrl || "",
            twitterUrl: image.twitterUrl || "",
            webpUrl: image.webpUrl || "",
            avifUrl: image.avifUrl || "",
            width: image.width,
            height: image.height,
            format: image.format || "",
            alt: image.alt || "",
            title: image.title || "",
            description: image.description || "",
            caption: image.caption || "",
            disclosure: image.disclosure || "",
            sourceType: image.sourceType,
            illustrative: image.illustrative,
            storage: image.storage || "",
            category: image.category || "",
            metadata: image.metadata,
            validationNotes: parseStringArray(image.validationNotes),
            license: image.license || "",
            credit: image.credit || "",
            error: image.error || "",
            createdAt: image.createdAt.toISOString(),
            updatedAt: image.updatedAt.toISOString()
          })),
          factCheckNotes: parseStringArray(post.factCheckNotes),
          sourceUrls: parseStringArray(post.sourceUrls),
          status: post.status,
          scheduledAt: post.scheduledAt
            ? new Date(post.scheduledAt.getTime() - post.scheduledAt.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)
            : "",
          rejectionReason: post.rejectionReason || ""
        }}
      />
    </>
  );
}
