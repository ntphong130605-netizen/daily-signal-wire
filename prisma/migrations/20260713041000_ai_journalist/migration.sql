ALTER TABLE "Post" ADD COLUMN "authorName" TEXT NOT NULL DEFAULT 'Daily Signal Wire Desk';
ALTER TABLE "Post" ADD COLUMN "researchCandidateId" TEXT;
ALTER TABLE "Post" ADD COLUMN "readingTimeMinutes" INTEGER;
ALTER TABLE "Post" ADD COLUMN "keyTakeaways" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "timeline" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "relatedTopics" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "internalLinkSuggestions" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "Post" ADD COLUMN "draftVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Post" ADD COLUMN "journalistTone" TEXT NOT NULL DEFAULT 'Neutral';
ALTER TABLE "Post" ADD COLUMN "generationMetadata" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Post" ADD COLUMN "tokenUsage" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Post" ADD COLUMN "generationTimeMs" INTEGER;
ALTER TABLE "Post" ADD COLUMN "promptVersion" TEXT;

CREATE INDEX "Post_researchCandidateId_idx" ON "Post"("researchCandidateId");

CREATE TABLE "PostRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changeType" TEXT NOT NULL,
    "section" TEXT,
    "tone" TEXT,
    "title" TEXT,
    "subtitle" TEXT,
    "excerpt" TEXT,
    "summary" TEXT,
    "content" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "openGraphDescription" TEXT,
    "facebookCaption" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "faq" TEXT NOT NULL DEFAULT '[]',
    "keyTakeaways" TEXT NOT NULL DEFAULT '[]',
    "timeline" TEXT NOT NULL DEFAULT '[]',
    "relatedTopics" TEXT NOT NULL DEFAULT '[]',
    "internalLinkSuggestions" TEXT NOT NULL DEFAULT '[]',
    "factCheckNotes" TEXT NOT NULL DEFAULT '[]',
    "sourceUrls" TEXT NOT NULL DEFAULT '[]',
    "generationMetadata" TEXT NOT NULL DEFAULT '{}',
    "tokenUsage" TEXT NOT NULL DEFAULT '{}',
    "generationTimeMs" INTEGER,
    "promptVersion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostRevision_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PostRevision_postId_version_key" ON "PostRevision"("postId", "version");
CREATE INDEX "PostRevision_postId_idx" ON "PostRevision"("postId");
CREATE INDEX "PostRevision_changeType_idx" ON "PostRevision"("changeType");
CREATE INDEX "PostRevision_section_idx" ON "PostRevision"("section");
CREATE INDEX "PostRevision_createdAt_idx" ON "PostRevision"("createdAt");
