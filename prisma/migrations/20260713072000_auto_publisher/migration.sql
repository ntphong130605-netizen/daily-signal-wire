-- Phase 3.5: Auto Publisher workflow metadata

ALTER TABLE "Post" ADD COLUMN "publishAt" DATETIME;
ALTER TABLE "Post" ADD COLUMN "timezone" TEXT;
ALTER TABLE "Post" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "Post" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "Post" ADD COLUMN "approvedBy" TEXT;
ALTER TABLE "Post" ADD COLUMN "publishingStartedAt" DATETIME;
ALTER TABLE "Post" ADD COLUMN "publishError" TEXT;
ALTER TABLE "Post" ADD COLUMN "schedulerMetadata" TEXT NOT NULL DEFAULT '{}';

CREATE TABLE "PostStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "note" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostStatusEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PostApprovalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT,
    "note" TEXT,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostApprovalEvent_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "EditorialNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EditorialNotification_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Post_publishAt_idx" ON "Post"("publishAt");
CREATE INDEX "Post_approvalStatus_idx" ON "Post"("approvalStatus");
CREATE INDEX "Post_approvedAt_idx" ON "Post"("approvedAt");
CREATE INDEX "Post_publishingStartedAt_idx" ON "Post"("publishingStartedAt");

CREATE INDEX "PostStatusEvent_postId_idx" ON "PostStatusEvent"("postId");
CREATE INDEX "PostStatusEvent_toStatus_idx" ON "PostStatusEvent"("toStatus");
CREATE INDEX "PostStatusEvent_action_idx" ON "PostStatusEvent"("action");
CREATE INDEX "PostStatusEvent_createdAt_idx" ON "PostStatusEvent"("createdAt");

CREATE INDEX "PostApprovalEvent_postId_idx" ON "PostApprovalEvent"("postId");
CREATE INDEX "PostApprovalEvent_action_idx" ON "PostApprovalEvent"("action");
CREATE INDEX "PostApprovalEvent_createdAt_idx" ON "PostApprovalEvent"("createdAt");

CREATE INDEX "EditorialNotification_postId_idx" ON "EditorialNotification"("postId");
CREATE INDEX "EditorialNotification_type_idx" ON "EditorialNotification"("type");
CREATE INDEX "EditorialNotification_status_idx" ON "EditorialNotification"("status");
CREATE INDEX "EditorialNotification_severity_idx" ON "EditorialNotification"("severity");
CREATE INDEX "EditorialNotification_createdAt_idx" ON "EditorialNotification"("createdAt");
