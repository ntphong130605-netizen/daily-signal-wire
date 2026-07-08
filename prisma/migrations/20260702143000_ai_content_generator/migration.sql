-- CreateTable
CREATE TABLE "Trend" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "keyword" TEXT NOT NULL,
    "normalizedKeyword" TEXT NOT NULL,
    "traffic" TEXT,
    "relatedQueries" TEXT NOT NULL DEFAULT '[]',
    "sourceUrls" TEXT NOT NULL DEFAULT '[]',
    "sourceContext" TEXT NOT NULL DEFAULT '[]',
    "category" TEXT,
    "generationStatus" TEXT NOT NULL DEFAULT 'idle',
    "generationError" TEXT,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trendId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,
    "facebookCaption" TEXT NOT NULL,
    "imagePrompt" TEXT,
    "imageUrl" TEXT,
    "imageLicense" TEXT,
    "imageCredit" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "factCheckNotes" TEXT NOT NULL DEFAULT '[]',
    "sourceUrls" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Post_trendId_fkey" FOREIGN KEY ("trendId") REFERENCES "Trend" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Trend_normalizedKeyword_key" ON "Trend"("normalizedKeyword");

-- CreateIndex
CREATE INDEX "Trend_generationStatus_idx" ON "Trend"("generationStatus");

-- CreateIndex
CREATE INDEX "Trend_discoveredAt_idx" ON "Trend"("discoveredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Post_trendId_key" ON "Post"("trendId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_status_idx" ON "Post"("status");

-- CreateIndex
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");
