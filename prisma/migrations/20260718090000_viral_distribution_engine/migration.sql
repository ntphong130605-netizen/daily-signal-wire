ALTER TABLE "SocialPost" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SocialPost" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "SocialPost" ADD COLUMN "nextAttemptAt" DATETIME;
ALTER TABLE "SocialPost" ADD COLUMN "lastAttemptAt" DATETIME;
ALTER TABLE "SocialPost" ADD COLUMN "lastPublishedAt" DATETIME;
ALTER TABLE "SocialPost" ADD COLUMN "maxRetries" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "SocialPost" ADD COLUMN "recurrence" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "SocialPost" ADD COLUMN "recurrenceEndsAt" DATETIME;
ALTER TABLE "SocialPost" ADD COLUMN "occurrenceCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialPost" ADD COLUMN "selectedVariantKey" TEXT NOT NULL DEFAULT 'control';
ALTER TABLE "SocialPost" ADD COLUMN "sourceImage" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "facebookImage" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "twitterImage" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "linkedinImage" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "pinterestImage" TEXT;
ALTER TABLE "SocialPost" ADD COLUMN "reach" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SocialPost" ADD COLUMN "responseTimeMs" INTEGER;

CREATE TABLE "SocialPostVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socialPostId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "callToAction" TEXT NOT NULL,
    "tone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SocialPostVariant_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SocialPostLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "socialPostId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "responseTimeMs" INTEGER,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialPostLog_socialPostId_fkey" FOREIGN KEY ("socialPostId") REFERENCES "SocialPost" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SocialPost_priority_scheduledAt_idx" ON "SocialPost"("priority", "scheduledAt");
CREATE INDEX "SocialPost_nextAttemptAt_idx" ON "SocialPost"("nextAttemptAt");
CREATE UNIQUE INDEX "SocialPostVariant_socialPostId_variantKey_key" ON "SocialPostVariant"("socialPostId", "variantKey");
CREATE INDEX "SocialPostVariant_socialPostId_idx" ON "SocialPostVariant"("socialPostId");
CREATE INDEX "SocialPostVariant_status_idx" ON "SocialPostVariant"("status");
CREATE INDEX "SocialPostVariant_isWinner_idx" ON "SocialPostVariant"("isWinner");
CREATE INDEX "SocialPostLog_socialPostId_idx" ON "SocialPostLog"("socialPostId");
CREATE INDEX "SocialPostLog_action_idx" ON "SocialPostLog"("action");
CREATE INDEX "SocialPostLog_toStatus_idx" ON "SocialPostLog"("toStatus");
CREATE INDEX "SocialPostLog_createdAt_idx" ON "SocialPostLog"("createdAt");

ALTER TABLE "NewsletterSubscriber" ADD COLUMN "unsubscribeToken" TEXT;
ALTER TABLE "NewsletterSubscriber" ADD COLUMN "unsubscribedAt" DATETIME;
ALTER TABLE "NewsletterSubscriber" ADD COLUMN "lastSentAt" DATETIME;
UPDATE "NewsletterSubscriber" SET "unsubscribeToken" = "id" WHERE "unsubscribeToken" IS NULL;
CREATE INDEX "NewsletterSubscriber_unsubscribeToken_idx" ON "NewsletterSubscriber"("unsubscribeToken");
