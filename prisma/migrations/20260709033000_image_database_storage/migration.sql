ALTER TABLE "Post" ADD COLUMN "imageStorage" TEXT NOT NULL DEFAULT 'url';
ALTER TABLE "Post" ADD COLUMN "featuredImageData" TEXT;
ALTER TABLE "Post" ADD COLUMN "thumbnailImageData" TEXT;
