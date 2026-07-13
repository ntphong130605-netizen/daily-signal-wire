PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ResearchBrief" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "whyTrending" TEXT NOT NULL,
    "readerValue" TEXT NOT NULL,
    "verifiedFacts" TEXT NOT NULL DEFAULT '[]',
    "uncertainClaims" TEXT NOT NULL DEFAULT '[]',
    "timeline" TEXT NOT NULL DEFAULT '[]',
    "keyEntities" TEXT NOT NULL DEFAULT '[]',
    "relatedQueries" TEXT NOT NULL DEFAULT '[]',
    "suggestedAngles" TEXT NOT NULL DEFAULT '[]',
    "suggestedKeywords" TEXT NOT NULL DEFAULT '[]',
    "factCheckNotes" TEXT NOT NULL DEFAULT '[]',
    "intent" TEXT,
    "sourceUrls" TEXT NOT NULL DEFAULT '[]',
    "sourceCredibility" TEXT NOT NULL DEFAULT '[]',
    "scoreBreakdown" TEXT NOT NULL DEFAULT '{}',
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "recommendedAction" TEXT NOT NULL DEFAULT 'monitor',
    "factCheckRequired" BOOLEAN NOT NULL DEFAULT false,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ResearchBrief_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ResearchCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_ResearchBrief" (
    "candidateId",
    "createdAt",
    "factCheckNotes",
    "factCheckRequired",
    "generatedAt",
    "id",
    "intent",
    "keyEntities",
    "model",
    "readerValue",
    "recommendedAction",
    "relatedQueries",
    "riskLevel",
    "scoreBreakdown",
    "sourceCredibility",
    "sourceUrls",
    "suggestedAngles",
    "suggestedKeywords",
    "timeline",
    "uncertainClaims",
    "updatedAt",
    "verifiedFacts",
    "whyTrending"
)
SELECT
    "candidateId",
    "createdAt",
    "factCheckNotes",
    "factCheckRequired",
    "generatedAt",
    "id",
    "intent",
    "keyEntities",
    "model",
    "readerValue",
    "recommendedAction",
    "relatedQueries",
    "riskLevel",
    "scoreBreakdown",
    "sourceCredibility",
    "sourceUrls",
    "suggestedAngles",
    "suggestedKeywords",
    "timeline",
    "uncertainClaims",
    "updatedAt",
    "verifiedFacts",
    "whyTrending"
FROM "ResearchBrief";

DROP TABLE "ResearchBrief";
ALTER TABLE "new_ResearchBrief" RENAME TO "ResearchBrief";
CREATE UNIQUE INDEX "ResearchBrief_candidateId_key" ON "ResearchBrief"("candidateId");
CREATE INDEX "ResearchBrief_generatedAt_idx" ON "ResearchBrief"("generatedAt");

CREATE TABLE "new_ResearchCandidate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clusterKey" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "normalizedTopic" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'US',
    "language" TEXT NOT NULL DEFAULT 'en-US',
    "trendScore" REAL NOT NULL DEFAULT 0,
    "freshnessScore" REAL NOT NULL DEFAULT 0,
    "opportunityScore" REAL NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'low',
    "factCheckRequired" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'new',
    "recommendedAction" TEXT NOT NULL DEFAULT 'monitor',
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "new_ResearchCandidate" (
    "category",
    "clusterKey",
    "createdAt",
    "factCheckRequired",
    "firstSeenAt",
    "freshnessScore",
    "id",
    "language",
    "lastSeenAt",
    "normalizedTopic",
    "opportunityScore",
    "recommendedAction",
    "region",
    "riskLevel",
    "status",
    "topic",
    "trendScore",
    "updatedAt"
)
SELECT
    "category",
    "clusterKey",
    "createdAt",
    "factCheckRequired",
    "firstSeenAt",
    "freshnessScore",
    "id",
    "language",
    "lastSeenAt",
    "normalizedTopic",
    "opportunityScore",
    "recommendedAction",
    "region",
    "riskLevel",
    "status",
    "topic",
    "trendScore",
    "updatedAt"
FROM "ResearchCandidate";

DROP TABLE "ResearchCandidate";
ALTER TABLE "new_ResearchCandidate" RENAME TO "ResearchCandidate";
CREATE UNIQUE INDEX "ResearchCandidate_clusterKey_key" ON "ResearchCandidate"("clusterKey");
CREATE INDEX "ResearchCandidate_normalizedTopic_idx" ON "ResearchCandidate"("normalizedTopic");
CREATE INDEX "ResearchCandidate_category_idx" ON "ResearchCandidate"("category");
CREATE INDEX "ResearchCandidate_riskLevel_idx" ON "ResearchCandidate"("riskLevel");
CREATE INDEX "ResearchCandidate_status_idx" ON "ResearchCandidate"("status");
CREATE INDEX "ResearchCandidate_recommendedAction_idx" ON "ResearchCandidate"("recommendedAction");
CREATE INDEX "ResearchCandidate_trendScore_idx" ON "ResearchCandidate"("trendScore");
CREATE INDEX "ResearchCandidate_lastSeenAt_idx" ON "ResearchCandidate"("lastSeenAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
