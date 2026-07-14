CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "scheduledAt" DATETIME,
    "publishedAt" DATETIME,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "copy" TEXT,
    "hashtags" TEXT NOT NULL DEFAULT '[]',
    "shortSummary" TEXT,
    "callToAction" TEXT,
    "utmUrl" TEXT,
    "trackingUrl" TEXT,
    "openGraphImage" TEXT,
    "squareImage" TEXT,
    "verticalImage" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "logs" TEXT NOT NULL DEFAULT '[]',
    "externalPostId" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialPost_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SocialPost_articleId_platform_key" ON "SocialPost"("articleId", "platform");
CREATE INDEX "SocialPost_articleId_idx" ON "SocialPost"("articleId");
CREATE INDEX "SocialPost_platform_idx" ON "SocialPost"("platform");
CREATE INDEX "SocialPost_status_idx" ON "SocialPost"("status");
CREATE INDEX "SocialPost_scheduledAt_idx" ON "SocialPost"("scheduledAt");
CREATE INDEX "SocialPost_publishedAt_idx" ON "SocialPost"("publishedAt");
CREATE INDEX "SocialPost_createdAt_idx" ON "SocialPost"("createdAt");
