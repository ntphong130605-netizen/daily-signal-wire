import Link from "next/link";
import AdminImageStudioActions from "@/components/AdminImageStudioActions";
import { parseStringArray } from "@/lib/json";
import { configuredImageStorageLabel } from "@/lib/aiImage";
import { prisma, safeDbQuery } from "@/lib/prisma";

function fmt(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function money(value: number | null | undefined) {
  return value === null || value === undefined ? "Not configured" : `$${value.toFixed(4)} est.`;
}

export default async function AdminImageStudioPage() {
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const data = await safeDbQuery(
    "admin_image_studio_query_failed",
    { posts: [], counts: { completed: 0, failed: 0, idle: 0 } },
    async () => {
      const [posts, completed, failed, idle] = await Promise.all([
        prisma.post.findMany({
          where: {
            status: { in: ["draft", "scheduled", "rejected", "published"] }
          },
          include: {
            category: { select: { name: true } },
            generatedImages: { orderBy: { createdAt: "desc" }, take: 1 }
          },
          orderBy: [{ imageStatus: "asc" }, { updatedAt: "desc" }],
          take: 80
        }),
        prisma.post.count({ where: { imageStatus: { in: ["completed", "accepted"] } } }),
        prisma.post.count({ where: { imageStatus: "failed" } }),
        prisma.post.count({ where: { imageStatus: { in: ["idle", "rejected"] } } })
      ]);
      return { posts, counts: { completed, failed, idle } };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Phase 3.4 · AI Image Studio</p>
          <h1>Image Studio</h1>
          <p>Generate, retry and review publication-quality editorial hero images.</p>
        </div>
        <div className="header-badge">{configuredImageStorageLabel()}</div>
      </header>

      <main className="admin-content">
        <section className="admin-post-stats image-studio-stats">
          <Link href="/admin/image-studio">
            <span>Completed</span>
            <strong>{data.counts.completed}</strong>
          </Link>
          <Link href="/admin/image-studio">
            <span>Failed</span>
            <strong>{data.counts.failed}</strong>
          </Link>
          <Link href="/admin/image-studio">
            <span>Needs image</span>
            <strong>{data.counts.idle}</strong>
          </Link>
        </section>

        {!aiConfigured && (
          <div className="api-config-banner">
            <strong>AI image generation is paused</strong>
            <span>Add <code>OPENAI_API_KEY</code> to generate or regenerate images.</span>
          </div>
        )}

        <section className="panel image-studio-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Editorial images</p>
              <h2>Hero image queue</h2>
            </div>
            <Link className="admin-review-link" href="/admin/posts">All posts →</Link>
          </div>

          {data.posts.length === 0 ? (
            <div className="empty-state">
              <h3>No posts available</h3>
              <p>Create an AI draft first, then the image studio will show the image queue.</p>
            </div>
          ) : (
            <div className="image-studio-list">
              {data.posts.map((post) => {
                const latest = post.generatedImages[0];
                const image =
                  post.featuredImageUrl ||
                  post.featuredImage ||
                  post.imageUrl ||
                  post.thumbnailImage ||
                  "";
                const validationNotes = parseStringArray(latest?.validationNotes);
                return (
                  <article className="image-studio-card" key={post.id}>
                    <div className="image-studio-preview">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt={post.imageAlt || post.title} loading="lazy" />
                      ) : (
                        <span>No image</span>
                      )}
                    </div>
                    <div className="image-studio-body">
                      <div className="research-row-meta">
                        <span className="category-tag">{post.category?.name || "Editorial"}</span>
                        <span className={`status status-${post.imageStatus}`}>{post.imageStatus}</span>
                        <span>{fmt(post.imageGeneratedAt || latest?.createdAt)}</span>
                      </div>
                      <Link className="research-title" href={`/admin/posts/${post.id}`}>
                        {post.title}
                      </Link>
                      <p>{post.imageCaption || "No caption recorded yet."}</p>
                      <div className="image-studio-meta-grid">
                        <span>Model <strong>{post.imageModel || latest?.model || "—"}</strong></span>
                        <span>Time <strong>{latest?.generationTimeMs ? `${(latest.generationTimeMs / 1000).toFixed(1)}s` : "—"}</strong></span>
                        <span>Cost <strong>{money(latest?.generationCostUsd)}</strong></span>
                        <span>Prompt <strong>{latest?.promptVersion || "—"}</strong></span>
                        <span>Template <strong>{latest?.promptTemplate || "—"}</strong></span>
                        <span>Storage <strong>{post.imageStorage}</strong></span>
                      </div>
                      {post.imageError && <div className="error-banner">{post.imageError}</div>}
                      {validationNotes.length > 0 && (
                        <ul className="image-studio-notes">
                          {validationNotes.slice(0, 3).map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      )}
                      <details>
                        <summary>Prompt log</summary>
                        <p>{latest?.finalPrompt || latest?.prompt || post.imagePrompt || "No prompt logged yet."}</p>
                      </details>
                      <AdminImageStudioActions
                        postId={post.id}
                        initialPrompt={post.imagePrompt || latest?.finalPrompt || latest?.prompt || ""}
                        aiConfigured={aiConfigured}
                        imageStatus={post.imageStatus}
                        hasImage={Boolean(image)}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
