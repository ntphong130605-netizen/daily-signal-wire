ALTER TABLE "IndexingJob" ADD COLUMN "responseCode" INTEGER;
ALTER TABLE "IndexingJob" ADD COLUMN "responseBody" TEXT;
ALTER TABLE "IndexingJob" ADD COLUMN "responseTimeMs" INTEGER;
ALTER TABLE "IndexingJob" ADD COLUMN "nextAttemptAt" DATETIME;
ALTER TABLE "IndexingJob" ADD COLUMN "verifiedAt" DATETIME;

CREATE INDEX "IndexingJob_nextAttemptAt_idx" ON "IndexingJob"("nextAttemptAt");
