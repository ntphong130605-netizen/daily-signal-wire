-- Phase 3.3: AI Fact Checker

ALTER TABLE "Post" ADD COLUMN "factCheckStatus" TEXT NOT NULL DEFAULT 'Needs Review';
ALTER TABLE "Post" ADD COLUMN "trustScore" INTEGER;
ALTER TABLE "Post" ADD COLUMN "evidenceScore" INTEGER;
ALTER TABLE "Post" ADD COLUMN "sourceDiversityScore" INTEGER;
ALTER TABLE "Post" ADD COLUMN "freshnessScore" INTEGER;
ALTER TABLE "Post" ADD COLUMN "confidenceLevel" TEXT;
ALTER TABLE "Post" ADD COLUMN "factCheckSummary" TEXT;
ALTER TABLE "Post" ADD COLUMN "factCheckEvidence" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "factCheckWarnings" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "riskyParagraphs" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "verificationMetadata" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Post" ADD COLUMN "verifiedAt" DATETIME;

CREATE TABLE "FactCheckReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Needs Review',
    "trustScore" INTEGER NOT NULL,
    "evidenceScore" INTEGER NOT NULL,
    "sourceDiversityScore" INTEGER NOT NULL,
    "freshnessScore" INTEGER NOT NULL,
    "confidenceLevel" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" TEXT NOT NULL DEFAULT '[]',
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "riskyParagraphs" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "model" TEXT,
    "promptVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactCheckReport_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Post_factCheckStatus_idx" ON "Post"("factCheckStatus");
CREATE INDEX "Post_trustScore_idx" ON "Post"("trustScore");
CREATE INDEX "Post_verifiedAt_idx" ON "Post"("verifiedAt");
CREATE INDEX "FactCheckReport_postId_idx" ON "FactCheckReport"("postId");
CREATE INDEX "FactCheckReport_status_idx" ON "FactCheckReport"("status");
CREATE INDEX "FactCheckReport_trustScore_idx" ON "FactCheckReport"("trustScore");
CREATE INDEX "FactCheckReport_createdAt_idx" ON "FactCheckReport"("createdAt");
