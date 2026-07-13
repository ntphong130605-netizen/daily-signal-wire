CREATE TABLE "IndexingJob" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "url" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "submittedAt" DATETIME,
  "finishedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "IndexingJob_url_idx" ON "IndexingJob"("url");
CREATE INDEX "IndexingJob_type_idx" ON "IndexingJob"("type");
CREATE INDEX "IndexingJob_status_idx" ON "IndexingJob"("status");
CREATE INDEX "IndexingJob_createdAt_idx" ON "IndexingJob"("createdAt");
CREATE INDEX "IndexingJob_submittedAt_idx" ON "IndexingJob"("submittedAt");
CREATE INDEX "IndexingJob_finishedAt_idx" ON "IndexingJob"("finishedAt");
