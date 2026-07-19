import Link from "next/link";
import { TestBatchItemActions, TestBatchToolbar } from "@/components/AdminTestBatchActions";
import { parseStringArray } from "@/lib/json";
import { safeDbQuery } from "@/lib/prisma";
import { loadLatestProductionTestBatch, TEST_BATCH_TIMEZONE } from "@/lib/productionTestBatch";

function dateTime(value: Date | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TEST_BATCH_TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(value);
}

function money(value: number | null | undefined) {
  return typeof value === "number" ? `$${value.toFixed(4)}` : "Not configured";
}

export default async function AdminTestBatchPage() {
  const batch = await safeDbQuery("admin_test_batch_query_failed", null, loadLatestProductionTestBatch);
  const items = batch?.items || [];
  const eligible = items.filter((item) => item.approvalStatus === "eligible").length;
  const needsReview = items.filter((item) => item.approvalStatus === "needs_review").length;
  const images = items.filter((item) => ["completed", "accepted"].includes(item.imageStatus)).length;
  const complete = items.filter((item) => item.writingStatus === "completed").length;
  const canProcess = Boolean(batch && ["ready", "processing", "cost_limited"].includes(batch.status));

  return (
    <>
      <header className="admin-header">
        <div>
          <p className="eyebrow">One-time production test</p>
          <h1>Ten-article test batch</h1>
          <p>Real research, strict safety gates, human approval, and no recurring test schedule.</p>
        </div>
        <div className="header-badge">{batch ? batch.status.replace(/_/g, " ") : "not started"}</div>
      </header>
      <main className="admin-content">
        <div className="warning-banner">
          <span>!</span>
          <div>
            <strong>No automatic approval</strong>
            <p>All generated articles stop at Pending Review. Scheduling begins only after an editor approves them here.</p>
          </div>
        </div>

        <TestBatchToolbar
          batchId={batch?.id}
          canProcess={canProcess}
          eligibleCount={eligible}
          needsSelection={Boolean(batch && items.length === 0)}
        />

        {batch ? (
          <>
            <section className="admin-post-stats test-batch-stats">
              <div><span>Batch ID</span><strong>{batch.id}</strong></div>
              <div><span>Target date</span><strong>{batch.targetDate}</strong></div>
              <div><span>Selected</span><strong>{items.length}/10</strong></div>
              <div><span>Drafted</span><strong>{complete}</strong></div>
              <div><span>Eligible</span><strong>{eligible}</strong></div>
              <div><span>Needs review</span><strong>{needsReview}</strong></div>
              <div><span>Images</span><strong>{images}</strong></div>
              <div><span>Estimated cost</span><strong>{money(batch.estimatedAiCostUsd)}</strong></div>
            </section>

            <section className="panel test-batch-summary">
              <div>
                <p className="eyebrow">Safety envelope</p>
                <h2>Usage limits</h2>
              </div>
              <dl>
                <div><dt>Article generations</dt><dd>{batch.articleGenerationsUsed}/{batch.articleGenerationLimit}</dd></div>
                <div><dt>Successful hero images</dt><dd>{batch.imageGenerationsUsed}/{batch.imageGenerationLimit}</dd></div>
                <div><dt>Image retry limit</dt><dd>{batch.imageRetryLimit} per article</dd></div>
                <div><dt>Timezone</dt><dd>{batch.timezone}</dd></div>
              </dl>
              {batch.errorSummary && <p className="inline-error">{batch.errorSummary}</p>}
            </section>

            <section className="panel test-batch-panel">
              <div className="panel-heading compact">
                <div>
                  <p className="eyebrow">Editorial review queue</p>
                  <h2>Selected topics and pipeline status</h2>
                </div>
                <span className="source-pill">Nothing published before approval</span>
              </div>
              {items.length === 0 ? (
                <div className="empty-state">
                  <h3>No safe topics met every rule</h3>
                  <p>The batch did not lower its score, sourcing, risk, or category requirements.</p>
                </div>
              ) : (
                <div className="test-batch-list">
                  {items.map((item) => {
                    const errors = parseStringArray(item.validationErrors);
                    const canRetry = item.writingStatus === "failed" || item.imageStatus === "failed";
                    return (
                      <article className="test-batch-item" key={item.id}>
                        <div className="test-batch-item-main">
                          <div className="research-row-meta">
                            <span className="category-tag">{item.category}</span>
                            <span>{Math.round(item.trendScore)} trend score</span>
                            <span>{item.sourceCount} independent sources</span>
                            <span className={`post-status post-status-${item.approvalStatus}`}>{item.approvalStatus.replace(/_/g, " ")}</span>
                          </div>
                          <h3>{item.postTitle || item.topic}</h3>
                          <div className="test-batch-pipeline">
                            <span>Writer: {item.writingStatus}</span>
                            <span>Fact check: {item.factCheckStatus} {item.trustScore ?? "—"}</span>
                            <span>Image: {item.imageStatus}</span>
                            <span>SEO: {item.validationStatus}</span>
                          </div>
                          <p><strong>Planned slot:</strong> {dateTime(item.plannedPublishAt)}</p>
                          <p><strong>Estimated cost:</strong> {money(item.estimatedAiCostUsd)}</p>
                          {errors.length > 0 && (
                            <details>
                              <summary>{errors.length} validation warning{errors.length === 1 ? "" : "s"}</summary>
                              <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
                            </details>
                          )}
                          {item.publishedUrl && <Link href={item.publishedUrl}>Published article</Link>}
                        </div>
                        <TestBatchItemActions
                          itemId={item.id}
                          postId={item.postId}
                          previewSlug={item.postSlug}
                          canApprove={item.approvalStatus === "eligible"}
                          canRetry={canRetry}
                          disabled={["approved", "rejected", "cancelled"].includes(item.approvalStatus)}
                        />
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="panel empty-state">
            <h2>No one-time batch has been created</h2>
            <p>Run the test once to refresh real research sources and select only qualifying US topics.</p>
          </section>
        )}
      </main>
    </>
  );
}
