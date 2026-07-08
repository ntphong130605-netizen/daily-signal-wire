-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trendId" TEXT,
    "sourceStoryId" TEXT,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,
    "facebookCaption" TEXT NOT NULL,
    "imagePrompt" TEXT,
    "imageModel" TEXT,
    "imageGeneratedAt" DATETIME,
    "imageStatus" TEXT NOT NULL DEFAULT 'idle',
    "imageError" TEXT,
    "imageUrl" TEXT,
    "featuredImage" TEXT,
    "thumbnailImage" TEXT,
    "openGraphImage" TEXT,
    "twitterImage" TEXT,
    "imageLicense" TEXT,
    "imageCredit" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "factCheckNotes" TEXT NOT NULL DEFAULT '[]',
    "sourceUrls" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_trendId_fkey" FOREIGN KEY ("trendId") REFERENCES "Trend" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_sourceStoryId_fkey" FOREIGN KEY ("sourceStoryId") REFERENCES "FeedStory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("aiGenerated", "categoryId", "content", "createdAt", "excerpt", "facebookCaption", "factCheckNotes", "id", "imageCredit", "imageLicense", "imagePrompt", "imageUrl", "publishedAt", "seoDescription", "seoTitle", "slug", "sourceStoryId", "sourceUrls", "status", "title", "trendId", "updatedAt") SELECT "aiGenerated", "categoryId", "content", "createdAt", "excerpt", "facebookCaption", "factCheckNotes", "id", "imageCredit", "imageLicense", "imagePrompt", "imageUrl", "publishedAt", "seoDescription", "seoTitle", "slug", "sourceStoryId", "sourceUrls", "status", "title", "trendId", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_trendId_key" ON "Post"("trendId");
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_status_idx" ON "Post"("status");
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");
CREATE INDEX "Post_imageStatus_idx" ON "Post"("imageStatus");
CREATE INDEX "Post_sourceStoryId_idx" ON "Post"("sourceStoryId");
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
