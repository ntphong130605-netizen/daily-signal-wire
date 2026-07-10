ALTER TABLE "Post" ADD COLUMN "featuredImageUrl" TEXT;
ALTER TABLE "Post" ADD COLUMN "imageAlt" TEXT;
ALTER TABLE "Post" ADD COLUMN "imageCaption" TEXT;
ALTER TABLE "Post" ADD COLUMN "imageDisclosure" TEXT;
ALTER TABLE "Post" ADD COLUMN "imageSourceType" TEXT NOT NULL DEFAULT 'placeholder';
