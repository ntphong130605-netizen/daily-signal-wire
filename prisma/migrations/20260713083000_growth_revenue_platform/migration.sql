-- Phase 4.0: Growth & Revenue Platform

CREATE TABLE "ContentPlanItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT,
    "topic" TEXT NOT NULL,
    "slug" TEXT,
    "category" TEXT NOT NULL DEFAULT 'US News',
    "sourceType" TEXT NOT NULL DEFAULT 'manual',
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "priority" INTEGER NOT NULL DEFAULT 3,
    "plannedFor" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "frequency" TEXT NOT NULL DEFAULT 'one_time',
    "angle" TEXT,
    "targetKeywords" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "owner" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentPlanItem_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "DistributionChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'not_configured',
    "configStatus" TEXT NOT NULL DEFAULT 'missing_credentials',
    "lastCheckedAt" DATETIME,
    "notes" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "DistributionPublish" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT,
    "channelId" TEXT,
    "platform" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "destinationUrl" TEXT,
    "message" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "history" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DistributionPublish_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DistributionPublish_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "DistributionChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "SeoAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "keyword" TEXT,
    "checks" TEXT NOT NULL DEFAULT '[]',
    "suggestions" TEXT NOT NULL DEFAULT '[]',
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "duplicateRisk" TEXT NOT NULL DEFAULT 'low',
    "thinContent" BOOLEAN NOT NULL DEFAULT false,
    "brokenLinks" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeoAudit_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DiscoverAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "freshnessScore" INTEGER NOT NULL,
    "entityScore" INTEGER NOT NULL,
    "imageScore" INTEGER NOT NULL,
    "largePreviewReady" BOOLEAN NOT NULL DEFAULT false,
    "headlineVariations" TEXT NOT NULL DEFAULT '[]',
    "suggestions" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscoverAudit_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RevenueMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'internal',
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "estimatedRevenue" REAL,
    "ctr" REAL,
    "rpm" REAL,
    "topArticles" TEXT NOT NULL DEFAULT '[]',
    "topCategories" TEXT NOT NULL DEFAULT '[]',
    "topCountries" TEXT NOT NULL DEFAULT '[]',
    "trafficSources" TEXT NOT NULL DEFAULT '[]',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventName" TEXT NOT NULL,
    "path" TEXT,
    "articleSlug" TEXT,
    "category" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "country" TEXT,
    "device" TEXT,
    "source" TEXT,
    "referrer" TEXT,
    "durationSeconds" INTEGER,
    "scrollDepth" INTEGER,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SystemStatusCheck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "message" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "checkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ContentPlanItem_postId_idx" ON "ContentPlanItem"("postId");
CREATE INDEX "ContentPlanItem_status_idx" ON "ContentPlanItem"("status");
CREATE INDEX "ContentPlanItem_priority_idx" ON "ContentPlanItem"("priority");
CREATE INDEX "ContentPlanItem_plannedFor_idx" ON "ContentPlanItem"("plannedFor");
CREATE INDEX "ContentPlanItem_category_idx" ON "ContentPlanItem"("category");
CREATE INDEX "ContentPlanItem_sourceType_idx" ON "ContentPlanItem"("sourceType");

CREATE UNIQUE INDEX "DistributionChannel_platform_key" ON "DistributionChannel"("platform");
CREATE INDEX "DistributionChannel_enabled_idx" ON "DistributionChannel"("enabled");
CREATE INDEX "DistributionChannel_status_idx" ON "DistributionChannel"("status");
CREATE INDEX "DistributionChannel_mode_idx" ON "DistributionChannel"("mode");

CREATE INDEX "DistributionPublish_postId_idx" ON "DistributionPublish"("postId");
CREATE INDEX "DistributionPublish_channelId_idx" ON "DistributionPublish"("channelId");
CREATE INDEX "DistributionPublish_platform_idx" ON "DistributionPublish"("platform");
CREATE INDEX "DistributionPublish_status_idx" ON "DistributionPublish"("status");
CREATE INDEX "DistributionPublish_scheduledAt_idx" ON "DistributionPublish"("scheduledAt");
CREATE INDEX "DistributionPublish_publishedAt_idx" ON "DistributionPublish"("publishedAt");

CREATE INDEX "SeoAudit_postId_idx" ON "SeoAudit"("postId");
CREATE INDEX "SeoAudit_score_idx" ON "SeoAudit"("score");
CREATE INDEX "SeoAudit_duplicateRisk_idx" ON "SeoAudit"("duplicateRisk");
CREATE INDEX "SeoAudit_analyzedAt_idx" ON "SeoAudit"("analyzedAt");

CREATE INDEX "DiscoverAudit_postId_idx" ON "DiscoverAudit"("postId");
CREATE INDEX "DiscoverAudit_score_idx" ON "DiscoverAudit"("score");
CREATE INDEX "DiscoverAudit_freshnessScore_idx" ON "DiscoverAudit"("freshnessScore");
CREATE INDEX "DiscoverAudit_analyzedAt_idx" ON "DiscoverAudit"("analyzedAt");

CREATE UNIQUE INDEX "RevenueMetric_date_source_key" ON "RevenueMetric"("date", "source");
CREATE INDEX "RevenueMetric_date_idx" ON "RevenueMetric"("date");
CREATE INDEX "RevenueMetric_source_idx" ON "RevenueMetric"("source");

CREATE INDEX "AnalyticsEvent_eventName_idx" ON "AnalyticsEvent"("eventName");
CREATE INDEX "AnalyticsEvent_path_idx" ON "AnalyticsEvent"("path");
CREATE INDEX "AnalyticsEvent_articleSlug_idx" ON "AnalyticsEvent"("articleSlug");
CREATE INDEX "AnalyticsEvent_category_idx" ON "AnalyticsEvent"("category");
CREATE INDEX "AnalyticsEvent_visitorId_idx" ON "AnalyticsEvent"("visitorId");
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
CREATE INDEX "AnalyticsEvent_country_idx" ON "AnalyticsEvent"("country");
CREATE INDEX "AnalyticsEvent_device_idx" ON "AnalyticsEvent"("device");
CREATE INDEX "AnalyticsEvent_source_idx" ON "AnalyticsEvent"("source");
CREATE INDEX "AnalyticsEvent_scrollDepth_idx" ON "AnalyticsEvent"("scrollDepth");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

CREATE INDEX "SystemStatusCheck_key_idx" ON "SystemStatusCheck"("key");
CREATE INDEX "SystemStatusCheck_status_idx" ON "SystemStatusCheck"("status");
CREATE INDEX "SystemStatusCheck_checkedAt_idx" ON "SystemStatusCheck"("checkedAt");
