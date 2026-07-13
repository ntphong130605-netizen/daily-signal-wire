-- Phase 3.4: AI Image Studio metadata

ALTER TABLE "GeneratedImage" ADD COLUMN "generationCostUsd" REAL;
ALTER TABLE "GeneratedImage" ADD COLUMN "generationTimeMs" INTEGER;
ALTER TABLE "GeneratedImage" ADD COLUMN "promptVersion" TEXT;
ALTER TABLE "GeneratedImage" ADD COLUMN "promptTemplate" TEXT;

CREATE INDEX "GeneratedImage_promptVersion_idx" ON "GeneratedImage"("promptVersion");
