CREATE TABLE "ProductionTestBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "targetDate" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "status" TEXT NOT NULL DEFAULT 'selecting',
    "maxArticles" INTEGER NOT NULL DEFAULT 10,
    "articleGenerationLimit" INTEGER NOT NULL DEFAULT 10,
    "imageGenerationLimit" INTEGER NOT NULL DEFAULT 10,
    "imageRetryLimit" INTEGER NOT NULL DEFAULT 2,
    "articleGenerationsUsed" INTEGER NOT NULL DEFAULT 0,
    "imageGenerationsUsed" INTEGER NOT NULL DEFAULT 0,
    "estimatedAiCostUsd" REAL,
    "researchRunId" TEXT,
    "sourceSummary" TEXT NOT NULL DEFAULT '{}',
    "errorSummary" TEXT,
    "approvedAt" DATETIME,
    "cancelledAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ProductionTestItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "researchCandidateId" TEXT NOT NULL,
    "postId" TEXT,
    "position" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "trendScore" REAL NOT NULL,
    "sourceCount" INTEGER NOT NULL,
    "sourceDomains" TEXT NOT NULL DEFAULT '[]',
    "writingStatus" TEXT NOT NULL DEFAULT 'queued',
    "factCheckStatus" TEXT NOT NULL DEFAULT 'pending',
    "trustScore" INTEGER,
    "imageStatus" TEXT NOT NULL DEFAULT 'pending',
    "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
    "validationStatus" TEXT NOT NULL DEFAULT 'pending',
    "validationErrors" TEXT NOT NULL DEFAULT '[]',
    "plannedPublishAt" DATETIME NOT NULL,
    "scheduledAt" DATETIME,
    "publishedUrl" TEXT,
    "articleGenerationCount" INTEGER NOT NULL DEFAULT 0,
    "imageAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedAiCostUsd" REAL,
    "lastError" TEXT,
    "processedAt" DATETIME,
    "approvedAt" DATETIME,
    "rejectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionTestItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProductionTestBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ProductionTestBatch_targetDate_idx" ON "ProductionTestBatch"("targetDate");
CREATE INDEX "ProductionTestBatch_status_idx" ON "ProductionTestBatch"("status");
CREATE INDEX "ProductionTestBatch_createdAt_idx" ON "ProductionTestBatch"("createdAt");
CREATE UNIQUE INDEX "ProductionTestItem_batchId_researchCandidateId_key" ON "ProductionTestItem"("batchId", "researchCandidateId");
CREATE UNIQUE INDEX "ProductionTestItem_batchId_position_key" ON "ProductionTestItem"("batchId", "position");
CREATE INDEX "ProductionTestItem_batchId_approvalStatus_idx" ON "ProductionTestItem"("batchId", "approvalStatus");
CREATE INDEX "ProductionTestItem_batchId_writingStatus_idx" ON "ProductionTestItem"("batchId", "writingStatus");
CREATE INDEX "ProductionTestItem_postId_idx" ON "ProductionTestItem"("postId");
CREATE INDEX "ProductionTestItem_plannedPublishAt_idx" ON "ProductionTestItem"("plannedPublishAt");
