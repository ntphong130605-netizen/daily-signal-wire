CREATE TABLE "ResearchCandidate" (
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ResearchSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "candidateId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "publisher" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "externalId" TEXT,
    "headline" TEXT NOT NULL,
    "summary" TEXT,
    "credibilityTier" TEXT NOT NULL DEFAULT 'C',
    "publishedAt" DATETIME,
    "rawMetadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchSource_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ResearchCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ResearchBrief" (
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
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchBrief_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "ResearchCandidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ResearchRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "sourceStatuses" TEXT NOT NULL DEFAULT '{}',
    "candidatesFound" INTEGER NOT NULL DEFAULT 0,
    "candidatesCreated" INTEGER NOT NULL DEFAULT 0,
    "candidatesMerged" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT
);

CREATE UNIQUE INDEX "ResearchCandidate_clusterKey_key" ON "ResearchCandidate"("clusterKey");
CREATE INDEX "ResearchCandidate_normalizedTopic_idx" ON "ResearchCandidate"("normalizedTopic");
CREATE INDEX "ResearchCandidate_category_idx" ON "ResearchCandidate"("category");
CREATE INDEX "ResearchCandidate_riskLevel_idx" ON "ResearchCandidate"("riskLevel");
CREATE INDEX "ResearchCandidate_status_idx" ON "ResearchCandidate"("status");
CREATE INDEX "ResearchCandidate_recommendedAction_idx" ON "ResearchCandidate"("recommendedAction");
CREATE INDEX "ResearchCandidate_trendScore_idx" ON "ResearchCandidate"("trendScore");
CREATE INDEX "ResearchCandidate_lastSeenAt_idx" ON "ResearchCandidate"("lastSeenAt");

CREATE UNIQUE INDEX "ResearchSource_candidateId_canonicalUrl_key" ON "ResearchSource"("candidateId", "canonicalUrl");
CREATE UNIQUE INDEX "ResearchSource_source_externalId_key" ON "ResearchSource"("source", "externalId");
CREATE INDEX "ResearchSource_candidateId_idx" ON "ResearchSource"("candidateId");
CREATE INDEX "ResearchSource_source_idx" ON "ResearchSource"("source");
CREATE INDEX "ResearchSource_publisher_idx" ON "ResearchSource"("publisher");
CREATE INDEX "ResearchSource_credibilityTier_idx" ON "ResearchSource"("credibilityTier");
CREATE INDEX "ResearchSource_publishedAt_idx" ON "ResearchSource"("publishedAt");

CREATE UNIQUE INDEX "ResearchBrief_candidateId_key" ON "ResearchBrief"("candidateId");
CREATE INDEX "ResearchBrief_generatedAt_idx" ON "ResearchBrief"("generatedAt");

CREATE INDEX "ResearchRun_status_idx" ON "ResearchRun"("status");
CREATE INDEX "ResearchRun_startedAt_idx" ON "ResearchRun"("startedAt");
