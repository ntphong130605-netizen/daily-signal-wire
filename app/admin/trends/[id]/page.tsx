import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { parseStringArray } from "@/lib/json";
import TrendEditor from "@/components/TrendEditor";

export default async function TrendDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trend = await safeDbQuery(
    "admin_trend_detail_query_failed",
    null,
    () =>
      prisma.trend.findUnique({
        where: { id },
        include: { post: true }
      })
  );
  if (!trend) notFound();
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);

  return (
    <>
      <header className="admin-header detail-header">
        <div>
          <Link className="back-link" href="/admin">
            ← Trend desk
          </Link>
          <p className="eyebrow">Editorial review</p>
          <h1>{trend.keyword}</h1>
          <p>
            {trend.traffic || "Emerging"} searches ·{" "}
            {trend.category || "Awaiting classification"}
          </p>
        </div>
        <div className={`status large status-${trend.generationStatus}`}>
          {trend.generationStatus}
        </div>
      </header>
      <main className="admin-content">
        <div className="warning-banner">
          <span>!</span>
          <div>
            <strong>Fact-check before publishing</strong>
            <p>
              AI assists the reporting workflow. An editor remains responsible for
              every fact, source, headline and image.
            </p>
          </div>
        </div>
        <TrendEditor
          key={`${trend.updatedAt.toISOString()}-${trend.post?.updatedAt.toISOString()}`}
          trend={{
            id: trend.id,
            keyword: trend.keyword,
            relatedQueries: parseStringArray(trend.relatedQueries),
            sourceUrls: parseStringArray(trend.sourceUrls),
            generationStatus: trend.generationStatus,
            generationError: trend.generationError
          }}
          aiConfigured={aiConfigured}
          post={
            trend.post
              ? {
                  id: trend.post.id,
                  slug: trend.post.slug,
                  title: trend.post.title,
                  excerpt: trend.post.excerpt,
                  content: trend.post.content,
                  seoTitle: trend.post.seoTitle,
                  seoDescription: trend.post.seoDescription,
                  facebookCaption: trend.post.facebookCaption,
                  imagePrompt: trend.post.imagePrompt || "",
                  imageModel: trend.post.imageModel || "",
                  imageGeneratedAt: trend.post.imageGeneratedAt?.toISOString() || null,
                  imageStatus: trend.post.imageStatus,
                  imageError: trend.post.imageError || "",
                  imageUrl: trend.post.imageUrl || "",
                  featuredImage: trend.post.featuredImage || "",
                  thumbnailImage: trend.post.thumbnailImage || "",
                  openGraphImage: trend.post.openGraphImage || "",
                  twitterImage: trend.post.twitterImage || "",
                  imageLicense: trend.post.imageLicense || "",
                  imageCredit: trend.post.imageCredit || "",
                  factCheckNotes: parseStringArray(trend.post.factCheckNotes),
                  sourceUrls: parseStringArray(trend.post.sourceUrls),
                  status: trend.post.status
                }
              : null
          }
        />
      </main>
    </>
  );
}
