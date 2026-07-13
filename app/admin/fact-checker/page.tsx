import Link from "next/link";
import AdminFactCheckActions from "@/components/AdminFactCheckActions";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";

type Warning = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  paragraphIndex?: number;
};

function fmt(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function scoreTone(score: number | null) {
  if (score === null) return "missing";
  if (score >= 82) return "strong";
  if (score >= 62) return "medium";
  return "weak";
}

export default async function AdminFactCheckerPage() {
  const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
  const data = await safeDbQuery(
    "admin_fact_checker_query_failed",
    { posts: [], counts: { verified: 0, review: 0, low: 0, rejected: 0 } },
    async () => {
      const [posts, verified, review, low, rejected] = await Promise.all([
        prisma.post.findMany({
          where: {
            aiGenerated: true,
            status: { in: ["draft", "scheduled", "rejected"] }
          },
          include: {
            category: { select: { name: true } },
            factCheckReports: { orderBy: { createdAt: "desc" }, take: 1 }
          },
          orderBy: [{ trustScore: "asc" }, { updatedAt: "desc" }],
          take: 80
        }),
        prisma.post.count({ where: { aiGenerated: true, factCheckStatus: "Verified" } }),
        prisma.post.count({ where: { aiGenerated: true, factCheckStatus: "Needs Review" } }),
        prisma.post.count({ where: { aiGenerated: true, factCheckStatus: "Low Confidence" } }),
        prisma.post.count({ where: { aiGenerated: true, factCheckStatus: "Rejected" } })
      ]);
      return {
        posts,
        counts: { verified, review, low, rejected }
      };
    }
  );

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Phase 3.3 · AI Fact Checker</p>
          <h1>Fact Checker</h1>
          <p>Validate AI newsroom drafts against saved source packets before publication.</p>
        </div>
        <div className="header-badge">{aiConfigured ? "AI rewrite available" : "Source-only mode"}</div>
      </header>

      <main className="admin-content">
        <section className="admin-post-stats fact-check-stats">
          <Link href="/admin/fact-checker">
            <span>Verified</span>
            <strong>{data.counts.verified}</strong>
          </Link>
          <Link href="/admin/fact-checker">
            <span>Needs review</span>
            <strong>{data.counts.review}</strong>
          </Link>
          <Link href="/admin/fact-checker">
            <span>Low confidence</span>
            <strong>{data.counts.low}</strong>
          </Link>
          <Link href="/admin/fact-checker">
            <span>Rejected</span>
            <strong>{data.counts.rejected}</strong>
          </Link>
        </section>

        <section className="panel fact-check-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Pre-publication queue</p>
              <h2>AI drafts requiring verification</h2>
            </div>
            <Link className="admin-review-link" href="/admin/posts">All posts →</Link>
          </div>

          {data.posts.length === 0 ? (
            <div className="empty-state">
              <h3>No AI drafts waiting for fact-check</h3>
              <p>Generate a draft from Research, Trends or RSS stories to populate this queue.</p>
            </div>
          ) : (
            <div className="fact-check-list">
              {data.posts.map((post) => {
                const warnings = parseJsonArray<Warning>(post.factCheckWarnings);
                const riskyParagraphs = parseJsonArray<{ index: number; reason: string }>(
                  post.riskyParagraphs
                );
                const latestReport = post.factCheckReports[0];
                const score = post.trustScore;
                return (
                  <article className="fact-check-card" key={post.id}>
                    <div className="fact-check-card-main">
                      <div className="research-row-meta">
                        <span className="category-tag">{post.category?.name || "Uncategorized"}</span>
                        <span className={`fact-status fact-status-${post.factCheckStatus.toLowerCase().replace(/\s+/g, "-")}`}>
                          {post.factCheckStatus}
                        </span>
                        <span>{post.status}</span>
                        <span>{fmt(post.verifiedAt)}</span>
                      </div>
                      <Link className="research-title" href={`/admin/posts/${post.id}`}>
                        {post.title}
                      </Link>
                      <p>{post.factCheckSummary || "No automated fact-check report has been run yet."}</p>
                      <small>
                        Evidence {post.evidenceScore ?? "—"} · Source diversity{" "}
                        {post.sourceDiversityScore ?? "—"} · Freshness {post.freshnessScore ?? "—"} ·{" "}
                        {post.confidenceLevel || "No confidence level"}
                      </small>
                      {latestReport && (
                        <small>
                          Latest report: {fmt(latestReport.createdAt)} · {latestReport.model || "heuristic"}
                        </small>
                      )}
                      {warnings.length > 0 && (
                        <ul className="fact-warning-list">
                          {warnings.slice(0, 4).map((warning, index) => (
                            <li className={`severity-${warning.severity}`} key={`${warning.type}-${index}`}>
                              <span>{warning.severity}</span>
                              {warning.message}
                            </li>
                          ))}
                        </ul>
                      )}
                      {riskyParagraphs.length > 0 && (
                        <details className="fact-risk-details">
                          <summary>{riskyParagraphs.length} risky paragraphs highlighted</summary>
                          <ol>
                            {riskyParagraphs.slice(0, 4).map((paragraph) => (
                              <li key={paragraph.index}>
                                Paragraph {paragraph.index + 1}: {paragraph.reason}
                              </li>
                            ))}
                          </ol>
                        </details>
                      )}
                    </div>
                    <aside className={`fact-score fact-score-${scoreTone(score)}`}>
                      <span>Trust score</span>
                      <strong>{score ?? "—"}</strong>
                      <small>{post.confidenceLevel || "Pending"}</small>
                    </aside>
                    <AdminFactCheckActions postId={post.id} aiConfigured={aiConfigured} compact />
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
