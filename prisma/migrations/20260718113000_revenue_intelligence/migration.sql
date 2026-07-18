ALTER TABLE "AdSlot" ADD COLUMN "routeScope" TEXT NOT NULL DEFAULT 'all';
ALTER TABLE "AdSlot" ADD COLUMN "lazy" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "AdSlot" ADD COLUMN "sticky" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AdSlot" ADD COLUMN "minHeightDesktop" INTEGER NOT NULL DEFAULT 280;
ALTER TABLE "AdSlot" ADD COLUMN "minHeightMobile" INTEGER NOT NULL DEFAULT 250;

CREATE TABLE "AdPerformanceMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'adsense_import',
    "slotKey" TEXT,
    "position" TEXT,
    "articleSlug" TEXT,
    "category" TEXT,
    "country" TEXT,
    "device" TEXT,
    "trafficSource" TEXT,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "viewableImpressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "pageViews" INTEGER NOT NULL DEFAULT 0,
    "estimatedRevenue" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AffiliateProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "websiteUrl" TEXT,
    "disclosure" TEXT NOT NULL DEFAULT 'Daily Signal Wire may earn a commission from qualifying purchases.',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "AffiliateLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "programId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "trackingUrl" TEXT NOT NULL,
    "category" TEXT,
    "keywords" TEXT NOT NULL DEFAULT '[]',
    "imageUrl" TEXT,
    "priceText" TEXT,
    "callToAction" TEXT NOT NULL DEFAULT 'Learn more',
    "disclosure" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AffiliateLink_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AffiliateProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "articleSlug" TEXT,
    "category" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "country" TEXT,
    "device" TEXT,
    "source" TEXT,
    "referrer" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AffiliateConversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "linkId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "orderReference" TEXT,
    "amount" REAL,
    "commission" REAL NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "occurredAt" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'api_import',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AffiliateConversion_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "AffiliateLink" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "RevenueExperiment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "targetArticleSlug" TEXT,
    "targetCategory" TEXT,
    "startsAt" DATETIME,
    "endsAt" DATETIME,
    "winnerVariantId" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "RevenueExperimentVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "experimentId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 50,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RevenueExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "RevenueExperiment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "HeatmapEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "articleSlug" TEXT,
    "elementKey" TEXT,
    "xPercent" REAL,
    "yPercent" REAL,
    "scrollDepth" INTEGER,
    "durationSeconds" INTEGER,
    "exitPosition" INTEGER,
    "adPosition" TEXT,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "country" TEXT,
    "device" TEXT,
    "source" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "NewsletterMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "campaignId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'resend_import',
    "sends" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opens" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "affiliateClicks" INTEGER NOT NULL DEFAULT 0,
    "revenue" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "AdPerformanceMetric_date_idx" ON "AdPerformanceMetric"("date");
CREATE INDEX "AdPerformanceMetric_source_idx" ON "AdPerformanceMetric"("source");
CREATE INDEX "AdPerformanceMetric_slotKey_idx" ON "AdPerformanceMetric"("slotKey");
CREATE INDEX "AdPerformanceMetric_position_idx" ON "AdPerformanceMetric"("position");
CREATE INDEX "AdPerformanceMetric_articleSlug_idx" ON "AdPerformanceMetric"("articleSlug");
CREATE INDEX "AdPerformanceMetric_category_idx" ON "AdPerformanceMetric"("category");
CREATE INDEX "AdPerformanceMetric_country_idx" ON "AdPerformanceMetric"("country");
CREATE INDEX "AdPerformanceMetric_device_idx" ON "AdPerformanceMetric"("device");
CREATE INDEX "AffiliateProgram_network_idx" ON "AffiliateProgram"("network");
CREATE INDEX "AffiliateProgram_status_idx" ON "AffiliateProgram"("status");
CREATE INDEX "AffiliateLink_programId_idx" ON "AffiliateLink"("programId");
CREATE INDEX "AffiliateLink_category_idx" ON "AffiliateLink"("category");
CREATE INDEX "AffiliateLink_status_idx" ON "AffiliateLink"("status");
CREATE INDEX "AffiliateLink_clicks_idx" ON "AffiliateLink"("clicks");
CREATE INDEX "AffiliateLink_revenue_idx" ON "AffiliateLink"("revenue");
CREATE INDEX "AffiliateClick_linkId_idx" ON "AffiliateClick"("linkId");
CREATE INDEX "AffiliateClick_articleSlug_idx" ON "AffiliateClick"("articleSlug");
CREATE INDEX "AffiliateClick_category_idx" ON "AffiliateClick"("category");
CREATE INDEX "AffiliateClick_country_idx" ON "AffiliateClick"("country");
CREATE INDEX "AffiliateClick_createdAt_idx" ON "AffiliateClick"("createdAt");
CREATE INDEX "AffiliateConversion_linkId_idx" ON "AffiliateConversion"("linkId");
CREATE INDEX "AffiliateConversion_network_idx" ON "AffiliateConversion"("network");
CREATE INDEX "AffiliateConversion_occurredAt_idx" ON "AffiliateConversion"("occurredAt");
CREATE UNIQUE INDEX "RevenueExperiment_key_key" ON "RevenueExperiment"("key");
CREATE INDEX "RevenueExperiment_type_idx" ON "RevenueExperiment"("type");
CREATE INDEX "RevenueExperiment_status_idx" ON "RevenueExperiment"("status");
CREATE INDEX "RevenueExperiment_targetArticleSlug_idx" ON "RevenueExperiment"("targetArticleSlug");
CREATE INDEX "RevenueExperiment_targetCategory_idx" ON "RevenueExperiment"("targetCategory");
CREATE UNIQUE INDEX "RevenueExperimentVariant_experimentId_key_key" ON "RevenueExperimentVariant"("experimentId", "key");
CREATE INDEX "RevenueExperimentVariant_experimentId_idx" ON "RevenueExperimentVariant"("experimentId");
CREATE INDEX "RevenueExperimentVariant_isWinner_idx" ON "RevenueExperimentVariant"("isWinner");
CREATE INDEX "HeatmapEvent_eventType_idx" ON "HeatmapEvent"("eventType");
CREATE INDEX "HeatmapEvent_path_idx" ON "HeatmapEvent"("path");
CREATE INDEX "HeatmapEvent_articleSlug_idx" ON "HeatmapEvent"("articleSlug");
CREATE INDEX "HeatmapEvent_elementKey_idx" ON "HeatmapEvent"("elementKey");
CREATE INDEX "HeatmapEvent_adPosition_idx" ON "HeatmapEvent"("adPosition");
CREATE INDEX "HeatmapEvent_createdAt_idx" ON "HeatmapEvent"("createdAt");
CREATE UNIQUE INDEX "NewsletterMetric_date_campaignId_source_key" ON "NewsletterMetric"("date", "campaignId", "source");
CREATE INDEX "NewsletterMetric_date_idx" ON "NewsletterMetric"("date");
CREATE INDEX "NewsletterMetric_campaignId_idx" ON "NewsletterMetric"("campaignId");
CREATE INDEX "NewsletterMetric_source_idx" ON "NewsletterMetric"("source");
