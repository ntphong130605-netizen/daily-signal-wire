CREATE TABLE "GeneratedImage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "postId" TEXT,
  "prompt" TEXT NOT NULL,
  "model" TEXT,
  "status" TEXT NOT NULL DEFAULT 'generated',
  "url" TEXT,
  "featuredUrl" TEXT,
  "thumbnailUrl" TEXT,
  "openGraphUrl" TEXT,
  "twitterUrl" TEXT,
  "alt" TEXT,
  "caption" TEXT,
  "disclosure" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'ai',
  "license" TEXT,
  "credit" TEXT,
  "error" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "GeneratedImage_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "GeneratedImage_postId_idx" ON "GeneratedImage"("postId");
CREATE INDEX "GeneratedImage_status_idx" ON "GeneratedImage"("status");
CREATE INDEX "GeneratedImage_sourceType_idx" ON "GeneratedImage"("sourceType");

CREATE TABLE "SiteSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'string',
  "group" TEXT NOT NULL DEFAULT 'general',
  "isPublic" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "SiteSetting_key_key" ON "SiteSetting"("key");
CREATE INDEX "SiteSetting_group_idx" ON "SiteSetting"("group");
CREATE INDEX "SiteSetting_isPublic_idx" ON "SiteSetting"("isPublic");
