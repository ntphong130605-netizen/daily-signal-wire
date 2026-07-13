import Link from "next/link";
import AdminWriterActions from "@/components/AdminWriterActions";
import { parseStringArray } from "@/lib/json";
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

export default async function AdminWriterPage() {
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const data = await safeDbQuery(
    "admin_writer_query_failed",
    { candidates: [], drafts: [], revisions: [] },
    async () => {
      const [candidates, drafts, revisions] = await Promise.all([
        prisma.researchCandidate.findMany({
          where: {
            riskLevel: { not: "blocked" },
            recommendedAction: { in: ["generate_draft", "monitor"] }
          },
          include: {
            brief: true,
            sources: { take: 3, orderBy: [{ credibilityTier: "asc" }, { publishedAt: "desc" }] }
          },
          orderBy: [{ trendScore: "desc" }, { lastSeenAt: "desc" }],
          take: 24
        }),
        prisma.post.findMany({
          where: { status: { in: ["draft", "rejected", "scheduled"] } },
          include: {
            category: { select: { name: true } },
            revisions: { take: 1, orderBy: { createdAt: "desc" } }
          },
          orderBy: { updatedAt: "desc" },
          take: 16
        }),
        prisma.postRevision.findMany({
          include: { post: { select: { title: true, slug: true, status: true } } },
          orderBy: { createdAt: "desc" },
          take: 12
        })
      ]);
      return { candidates, drafts, revisions };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Phase 3.2 · AI Journalist</p>
          <h1>AI Writer Desk</h1>
          <p>Turn source-first research briefs into editor-reviewed newsroom drafts.</p>
        </div>
        <div className="header-badge">{aiConfigured ? "OpenAI configured" : "AI not configured"}</div>
      </header>
      <main className="admin-content">
        {!aiConfigured && (
          <div className="api-config-banner">
            <strong>AI Journalist is paused</strong>
            <span>Add <code>OPENAI_API_KEY</code> in Vercel or local `.env` to enable draft generation.</span>
          </div>
        )}

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Research → Draft</p>
              <h2>Ready research briefs</h2>
            </div>
            <Link className="admin-review-link" href="/admin/research">Research queue →</Link>
          </div>
          {data.candidates.length === 0 ? (
            <div className="empty-state">
              <h3>No research briefs ready</h3>
              <p>Refresh sources in Research, then bring eligible briefs here.</p>
            </div>
          ) : (
            <div className="writer-candidate-list">
              {data.candidates.map((candidate) => {
                const notes = parseStringArray(candidate.brief?.factCheckNotes);
                const existingDraft = data.drafts.find(
                  (draft) => draft.researchCandidateId === candidate.id
                );
                return (
                  <article className="writer-candidate-card" key={candidate.id}>
                    <div>
                      <div className="research-row-meta">
                        <span className="category-tag">{candidate.category}</span>
                        <span className={`post-status post-status-${candidate.riskLevel}`}>
                          {candidate.riskLevel}
                        </span>
                        <span>{Math.round(candidate.trendScore)} score</span>
                        <span>{candidate.sources.length} sources</span>
                      </div>
                      <Link className="research-title" href={`/admin/research/${candidate.id}`}>
                        {candidate.topic}
                      </Link>
                      <p>{candidate.brief?.whyTrending || "Research brief pending."}</p>
                      {notes[0] && <small>{notes[0]}</small>}
                    </div>
                    <AdminWriterActions
                      researchCandidateId={candidate.id}
                      existingPostId={existingDraft?.id}
                      disabled={!aiConfigured || candidate.riskLevel === "blocked"}
                    />
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Editorial queue</p>
              <h2>Drafts and scheduled stories</h2>
            </div>
            <Link className="admin-review-link" href="/admin/posts">All posts →</Link>
          </div>
          <div className="writer-draft-list">
            {data.drafts.map((post) => {
              const quality = (() => {
                try {
                  const metadata = JSON.parse(post.generationMetadata || "{}") as {
                    quality?: { seoScore?: number; wordCount?: number };
                  };
                  return metadata.quality;
                } catch {
                  return undefined;
                }
              })();
              return (
                <article className="writer-draft-row" key={post.id}>
                  <div>
                    <span className={`post-status post-status-${post.status}`}>{post.status}</span>
                    <strong>{post.title}</strong>
                    <small>
                      v{post.draftVersion} · {post.journalistTone} · {post.category?.name || "Uncategorized"} · {fmt(post.updatedAt)}
                    </small>
                    <small>
                      SEO {quality?.seoScore ?? "—"} · {quality?.wordCount ?? "—"} words · {post.promptVersion || "manual"}
                    </small>
                  </div>
                  <div className="admin-writer-actions">
                    <Link href={`/admin/posts/${post.id}`}>Edit</Link>
                    <Link href={`/news/${post.slug}?preview=1`} target="_blank">Preview</Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Revision history</p>
              <h2>Recent AI writer changes</h2>
            </div>
          </div>
          <div className="writer-revision-list">
            {data.revisions.map((revision) => (
              <article key={revision.id}>
                <div>
                  <strong>{revision.post.title}</strong>
                  <small>
                    v{revision.version} · {revision.changeType}
                    {revision.section ? ` · ${revision.section}` : ""} · {revision.tone || "Neutral"} · {fmt(revision.createdAt)}
                  </small>
                </div>
                <Link href={`/admin/posts/${revision.postId}`}>Open</Link>
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
