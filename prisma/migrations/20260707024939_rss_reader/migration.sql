-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "passwordHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeedFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Feed" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "siteUrl" TEXT,
    "feedUrl" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "fetchStatus" TEXT NOT NULL DEFAULT 'idle',
    "lastFetchedAt" DATETIME,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Feed_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "FeedFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Feed_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FeedStory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "feedId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "author" TEXT,
    "imageUrl" TEXT,
    "publishedAt" DATETIME,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FeedStory_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedStory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storyId" TEXT NOT NULL,
    "userId" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedStory_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "FeedStory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedStory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StoryTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AdSlot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "clientId" TEXT,
    "slotId" TEXT,
    "format" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "_FeedStoryToStoryTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_FeedStoryToStoryTag_A_fkey" FOREIGN KEY ("A") REFERENCES "FeedStory" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_FeedStoryToStoryTag_B_fkey" FOREIGN KEY ("B") REFERENCES "StoryTag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
    CONSTRAINT "Post_trendId_fkey" FOREIGN KEY ("trendId") REFERENCES "Trend" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_sourceStoryId_fkey" FOREIGN KEY ("sourceStoryId") REFERENCES "FeedStory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Post_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Post" ("aiGenerated", "content", "createdAt", "excerpt", "facebookCaption", "factCheckNotes", "id", "imageCredit", "imageLicense", "imagePrompt", "imageUrl", "publishedAt", "seoDescription", "seoTitle", "slug", "sourceUrls", "status", "title", "trendId", "updatedAt") SELECT "aiGenerated", "content", "createdAt", "excerpt", "facebookCaption", "factCheckNotes", "id", "imageCredit", "imageLicense", "imagePrompt", "imageUrl", "publishedAt", "seoDescription", "seoTitle", "slug", "sourceUrls", "status", "title", "trendId", "updatedAt" FROM "Post";
DROP TABLE "Post";
ALTER TABLE "new_Post" RENAME TO "Post";
CREATE UNIQUE INDEX "Post_trendId_key" ON "Post"("trendId");
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");
CREATE INDEX "Post_status_idx" ON "Post"("status");
CREATE INDEX "Post_publishedAt_idx" ON "Post"("publishedAt");
CREATE INDEX "Post_sourceStoryId_idx" ON "Post"("sourceStoryId");
CREATE INDEX "Post_categoryId_idx" ON "Post"("categoryId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FeedFolder_slug_key" ON "FeedFolder"("slug");

-- CreateIndex
CREATE INDEX "FeedFolder_name_idx" ON "FeedFolder"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_slug_key" ON "Feed"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_feedUrl_key" ON "Feed"("feedUrl");

-- CreateIndex
CREATE INDEX "Feed_folderId_idx" ON "Feed"("folderId");

-- CreateIndex
CREATE INDEX "Feed_categoryId_idx" ON "Feed"("categoryId");

-- CreateIndex
CREATE INDEX "Feed_active_idx" ON "Feed"("active");

-- CreateIndex
CREATE INDEX "Feed_lastFetchedAt_idx" ON "Feed"("lastFetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeedStory_externalId_key" ON "FeedStory"("externalId");

-- CreateIndex
CREATE INDEX "FeedStory_feedId_idx" ON "FeedStory"("feedId");

-- CreateIndex
CREATE INDEX "FeedStory_publishedAt_idx" ON "FeedStory"("publishedAt");

-- CreateIndex
CREATE INDEX "FeedStory_isRead_idx" ON "FeedStory"("isRead");

-- CreateIndex
CREATE INDEX "FeedStory_sourceUrl_idx" ON "FeedStory"("sourceUrl");

-- CreateIndex
CREATE INDEX "SavedStory_userId_idx" ON "SavedStory"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedStory_storyId_userId_key" ON "SavedStory"("storyId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTag_name_key" ON "StoryTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "StoryTag_slug_key" ON "StoryTag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AdSlot_key_key" ON "AdSlot"("key");

-- CreateIndex
CREATE INDEX "AdSlot_placement_idx" ON "AdSlot"("placement");

-- CreateIndex
CREATE INDEX "AdSlot_enabled_idx" ON "AdSlot"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "_FeedStoryToStoryTag_AB_unique" ON "_FeedStoryToStoryTag"("A", "B");

-- CreateIndex
CREATE INDEX "_FeedStoryToStoryTag_B_index" ON "_FeedStoryToStoryTag"("B");
