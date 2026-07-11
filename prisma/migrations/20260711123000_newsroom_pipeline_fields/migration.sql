ALTER TABLE "Post" ADD COLUMN "subtitle" TEXT;
ALTER TABLE "Post" ADD COLUMN "summary" TEXT;
ALTER TABLE "Post" ADD COLUMN "openGraphDescription" TEXT;
ALTER TABLE "Post" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "faq" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "scheduledAt" DATETIME;
ALTER TABLE "Post" ADD COLUMN "rejectedAt" DATETIME;
ALTER TABLE "Post" ADD COLUMN "rejectionReason" TEXT;

CREATE INDEX "Post_scheduledAt_idx" ON "Post"("scheduledAt");
