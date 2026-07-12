ALTER TABLE "GeneratedImage" ADD COLUMN "finalPrompt" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "generator" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "webpUrl" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "avifUrl" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "width" INTEGER;
ALTER TABLE "GeneratedImage" ADD COLUMN "height" INTEGER;
ALTER TABLE "GeneratedImage" ADD COLUMN "format" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "title" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "description" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "illustrative" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GeneratedImage" ADD COLUMN "storage" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "category" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "metadata" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "GeneratedImage" ADD COLUMN "validationNotes" TEXT NOT NULL DEFAULT '[]';

CREATE INDEX "GeneratedImage_illustrative_idx" ON "GeneratedImage"("illustrative");
CREATE INDEX "GeneratedImage_category_idx" ON "GeneratedImage"("category");
