CREATE INDEX "Post_status_publishedAt_idx" ON "Post"("status", "publishedAt");
CREATE INDEX "Post_status_categoryId_publishedAt_idx" ON "Post"("status", "categoryId", "publishedAt");
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");
CREATE INDEX "Post_aiGenerated_idx" ON "Post"("aiGenerated");
