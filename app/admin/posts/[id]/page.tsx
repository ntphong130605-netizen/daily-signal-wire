import Link from "next/link";
import { notFound } from "next/navigation";
import AdminPostEditor from "@/components/AdminPostEditor";
import { parseStringArray } from "@/lib/json";
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
    () => prisma.post.findUnique({ where: { id } })
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
          excerpt: post.excerpt,
          content: post.content,
          seoTitle: post.seoTitle,
          seoDescription: post.seoDescription,
          facebookCaption: post.facebookCaption,
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
          factCheckNotes: parseStringArray(post.factCheckNotes),
          sourceUrls: parseStringArray(post.sourceUrls),
          status: post.status
        }}
      />
    </>
  );
}
