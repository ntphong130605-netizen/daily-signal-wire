import Link from "next/link";
import { notFound } from "next/navigation";
import AdminResearchActions from "@/components/AdminResearchActions";
import { parseJsonArray } from "@/lib/json";
import { prisma, safeDbQuery } from "@/lib/prisma";

function parseObject<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value || "") as T;
  } catch {
    return fallback;
  }
}

function fmt(date: Date | null | undefined) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export default async function AdminResearchDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await safeDbQuery(
    "admin_research_detail_query_failed",
    null,
    () =>
      prisma.researchCandidate.findUnique({
        where: { id },
        include: {
          brief: true,
          sources: { orderBy: [{ credibilityTier: "asc" }, { publishedAt: "desc" }] }
        }
      })
  );
  if (!candidate) notFound();

  const brief = candidate.brief;
  const verifiedFacts = parseJsonArray<string>(brief?.verifiedFacts);
  const uncertainClaims = parseJsonArray<string>(brief?.uncertainClaims);
  const timeline = parseJsonArray<string>(brief?.timeline);
  const entities = parseJsonArray<string>(brief?.keyEntities);
  const relatedQueries = parseJsonArray<string>(brief?.relatedQueries);
  const angles = parseJsonArray<string>(brief?.suggestedAngles);
  const keywords = parseJsonArray<string>(brief?.suggestedKeywords);
  const factNotes = parseJsonArray<string>(brief?.factCheckNotes);
  const scoreBreakdown = parseObject<Record<string, number>>(brief?.scoreBreakdown, {});

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">Research brief</p>
          <h1>{candidate.topic}</h1>
          <p>
            {candidate.category} · {candidate.region} · Last seen {fmt(candidate.lastSeenAt)}
          </p>
        </div>
        <div className="admin-header-actions">
          <AdminResearchActions
            id={candidate.id}
            canGenerate={candidate.recommendedAction === "generate_draft"}
            blocked={candidate.riskLevel === "blocked"}
          />
          <Link className="admin-review-link" href="/admin/research">
            ← Back
          </Link>
        </div>
      </header>
      <main className="admin-content research-detail-grid">
        <section className="panel research-brief-panel">
          <div className="research-row-meta">
            <span className="category-tag">{candidate.category}</span>
            <span className={`post-status post-status-${candidate.riskLevel}`}>
              {candidate.riskLevel} risk
            </span>
            <span className="source-pill">{candidate.recommendedAction}</span>
            {candidate.factCheckRequired && <span className="source-pill">Fact-check required</span>}
          </div>

          <h2>Brief</h2>
          <p>{brief?.whyTrending || "No brief generated yet."}</p>
          <h3>Reader value</h3>
          <p>{brief?.readerValue || "Pending."}</p>

          <div className="research-two-col">
            <div>
              <h3>Suggested angles</h3>
              <ul>{angles.map((angle) => <li key={angle}>{angle}</li>)}</ul>
            </div>
            <div>
              <h3>Related queries</h3>
              <ul>{relatedQueries.map((query) => <li key={query}>{query}</li>)}</ul>
            </div>
          </div>

          <h3>Verified facts</h3>
          <ul>{verifiedFacts.map((fact) => <li key={fact}>{fact}</li>)}</ul>

          {uncertainClaims.length > 0 && (
            <>
              <h3>Uncertain claims</h3>
              <ul>{uncertainClaims.map((claim) => <li key={claim}>{claim}</li>)}</ul>
            </>
          )}

          <h3>Fact-check notes</h3>
          <ul>{factNotes.map((note) => <li key={note}>{note}</li>)}</ul>
        </section>

        <aside className="panel research-side-panel">
          <h2>Score breakdown</h2>
          <div className="research-score-list">
            {Object.entries(scoreBreakdown).map(([key, value]) => (
              <div key={key}>
                <span>{key.replace(/([A-Z])/g, " $1")}</span>
                <strong>{Math.round(value)}</strong>
              </div>
            ))}
          </div>
          <h2>Entities</h2>
          <div className="research-chip-list">
            {entities.map((entity) => <span key={entity}>{entity}</span>)}
          </div>
          <h2>Keywords</h2>
          <div className="research-chip-list">
            {keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
          </div>
        </aside>

        <section className="panel research-span">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">Source URLs</p>
              <h2>{candidate.sources.length} source signals</h2>
            </div>
          </div>
          <div className="research-source-list">
            {candidate.sources.map((source) => (
              <article key={source.id}>
                <div>
                  <span className="category-tag">Tier {source.credibilityTier}</span>
                  <strong>{source.headline}</strong>
                  <p>{source.summary || "No feed summary provided."}</p>
                  <small>
                    {source.publisher || source.source} · {fmt(source.publishedAt)}
                  </small>
                </div>
                <a href={source.canonicalUrl || source.sourceUrl} target="_blank" rel="noreferrer">
                  Open source ↗
                </a>
              </article>
            ))}
          </div>
        </section>

        {timeline.length > 0 && (
          <section className="panel research-span">
            <h2>Timeline</h2>
            <ol className="research-timeline">
              {timeline.map((item) => <li key={item}>{item}</li>)}
            </ol>
          </section>
        )}
      </main>
    </>
  );
}
