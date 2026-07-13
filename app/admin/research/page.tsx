import Link from "next/link";
import AdminResearchActions from "@/components/AdminResearchActions";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { getResearchEngineReadiness } from "@/lib/research/engine";

function fmt(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export default async function AdminResearchPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; risk?: string; q?: string }>;
}) {
  const { status = "all", risk = "all", q = "" } = await searchParams;
  const readiness = getResearchEngineReadiness();
  const data = await safeDbQuery(
    "admin_research_query_failed",
    {
      candidates: [],
      total: 0,
      ready: 0,
      highRisk: 0,
      blocked: 0,
      lastRun: null
    },
    async () => {
      const where = {
        ...(status !== "all" ? { status } : {}),
        ...(risk !== "all" ? { riskLevel: risk } : {}),
        ...(q
          ? {
              OR: [
                { topic: { contains: q } },
                { normalizedTopic: { contains: q } },
                { category: { contains: q } }
              ]
            }
          : {})
      };
      const [candidates, total, ready, highRisk, blocked, lastRun] = await Promise.all([
        prisma.researchCandidate.findMany({
          where,
          include: {
            brief: true,
            sources: { take: 4, orderBy: [{ credibilityTier: "asc" }, { publishedAt: "desc" }] }
          },
          orderBy: [{ trendScore: "desc" }, { lastSeenAt: "desc" }],
          take: 100
        }),
        prisma.researchCandidate.count(),
        prisma.researchCandidate.count({ where: { recommendedAction: "generate_draft" } }),
        prisma.researchCandidate.count({ where: { riskLevel: "high" } }),
        prisma.researchCandidate.count({ where: { riskLevel: "blocked" } }),
        prisma.researchRun.findFirst({ orderBy: { startedAt: "desc" } })
      ]);
      return { candidates, total, ready, highRisk, blocked, lastRun };
    }
  );
  const sourceStatuses = data.lastRun
    ? (JSON.parse(data.lastRun.sourceStatuses || "{}") as Record<string, { status?: string; count?: number }>)
    : {};

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">AI Research Engine · Step 3.1</p>
          <h1>Research candidates</h1>
          <p>Collect multi-source signals, dedupe them, and create source-first briefs.</p>
        </div>
        <div className="admin-header-actions">
          <AdminResearchActions showRefresh />
          <div className="header-badge">{data.total} candidates</div>
        </div>
      </header>
      <main className="admin-content">
        <div className="warning-banner">
          <span>!</span>
          <div>
            <strong>Research is not publishing</strong>
            <p>
              Candidates can only be sent to the existing draft workflow. Blocked topics are never
              eligible.
            </p>
          </div>
        </div>

        <section className="admin-post-stats">
          <Link href="/admin/research">
            <span>Total</span>
            <strong>{data.total}</strong>
          </Link>
          <Link href="/admin/research?status=all">
            <span>Shown</span>
            <strong>{data.candidates.length}</strong>
          </Link>
          <Link href="/admin/research?status=all&q=&risk=all">
            <span>Draft-ready</span>
            <strong>{data.ready}</strong>
          </Link>
          <Link href="/admin/research?risk=high">
            <span>High risk</span>
            <strong>{data.highRisk}</strong>
          </Link>
          <Link href="/admin/research?risk=blocked">
            <span>Blocked</span>
            <strong>{data.blocked}</strong>
          </Link>
          <form action="/admin/research">
            <input type="search" name="q" defaultValue={q} placeholder="Search research…" />
            <select name="status" defaultValue={status}>
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="monitoring">Monitoring</option>
              <option value="ignored">Ignored</option>
              <option value="blocked">Blocked</option>
              <option value="sent_to_pipeline">Sent to pipeline</option>
            </select>
            <select name="risk" defaultValue={risk}>
              <option value="all">All risk</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="blocked">Blocked</option>
            </select>
            <button>Filter</button>
          </form>
        </section>

        <section className="panel research-source-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Source adapters</p>
              <h2>Current readiness</h2>
            </div>
            <span className="source-pill">Last run: {fmt(data.lastRun?.startedAt)}</span>
          </div>
          <div className="research-source-grid">
            {readiness.sources.map((source) => {
              const status = sourceStatuses[source.source];
              return (
                <div className="research-source-card" key={source.source}>
                  <strong>{source.source.replace(/_/g, " ")}</strong>
                  <span className={source.enabled ? "post-status post-status-published" : "post-status"}>
                    {source.enabled ? status?.status || "enabled" : "disabled"}
                  </span>
                  <small>{status ? `${status.count || 0} signals` : "Waiting for run"}</small>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel">
          {data.candidates.length === 0 ? (
            <div className="empty-state">
              <h3>No research candidates yet</h3>
              <p>Run Refresh Sources or wait for the protected cron job.</p>
            </div>
          ) : (
            <div className="research-list">
              {data.candidates.map((candidate) => {
                const factNotes = parseJsonArray<string>(candidate.brief?.factCheckNotes);
                return (
                  <article className="research-row" key={candidate.id}>
                    <div>
                      <div className="research-row-meta">
                        <span className="category-tag">{candidate.category}</span>
                        <span className={`post-status post-status-${candidate.riskLevel}`}>
                          {candidate.riskLevel} risk
                        </span>
                        <span>{Math.round(candidate.trendScore)} score</span>
                        <time dateTime={candidate.lastSeenAt.toISOString()}>
                          {fmt(candidate.lastSeenAt)}
                        </time>
                      </div>
                      <Link className="research-title" href={`/admin/research/${candidate.id}`}>
                        {candidate.topic}
                      </Link>
                      <p>{candidate.brief?.whyTrending || "Research brief is pending."}</p>
                      <div className="research-source-strip">
                        {candidate.sources.map((source) => (
                          <span key={source.id}>
                            {source.credibilityTier} · {source.publisher || source.source}
                          </span>
                        ))}
                      </div>
                      {factNotes.length > 0 && <small>{factNotes[0]}</small>}
                    </div>
                    <AdminResearchActions
                      id={candidate.id}
                      detailHref={`/admin/research/${candidate.id}`}
                      canGenerate={candidate.recommendedAction === "generate_draft"}
                      blocked={candidate.riskLevel === "blocked"}
                    />
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
