import { prisma } from "../lib/prisma";
import {
  createOneTimeProductionTestBatch,
  loadLatestProductionTestBatch,
  processNextProductionTestItem
} from "../lib/productionTestBatch";

function assertProductionEnvironment() {
  const databaseUrl = process.env.DATABASE_URL || "";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  if (!/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    throw new Error("Production test requires a PostgreSQL DATABASE_URL.");
  }
  if (!siteUrl.startsWith("https://") || siteUrl.includes("localhost")) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a production HTTPS URL.");
  }
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required.");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required for production hero images.");
  }
}

async function main() {
  assertProductionEnvironment();
  const created = await createOneTimeProductionTestBatch();
  const batchId = created.batch.id;

  for (let index = 0; index < created.batch.maxArticles; index += 1) {
    const result = await processNextProductionTestItem(batchId);
    if (result.done) break;
  }

  const batch = await loadLatestProductionTestBatch();
  if (!batch || batch.id !== batchId) throw new Error("The completed batch could not be loaded.");
  const unsafe = batch.items.filter(
    (item) => item.scheduledAt || item.postStatus === "scheduled" || item.postStatus === "published"
  );
  if (unsafe.length) {
    throw new Error("Safety assertion failed: a test article was scheduled or published without approval.");
  }

  console.log(
    JSON.stringify(
      {
        batchId: batch.id,
        targetDate: batch.targetDate,
        timezone: batch.timezone,
        status: batch.status,
        selected: batch.items.length,
        drafted: batch.items.filter((item) => item.writingStatus === "completed").length,
        factCheckPassed: batch.items.filter(
          (item) => ["Verified", "Approved"].includes(item.factCheckStatus) && (item.trustScore || 0) >= 75
        ).length,
        needsReview: batch.items.filter((item) => item.approvalStatus === "needs_review").length,
        eligible: batch.items.filter((item) => item.approvalStatus === "eligible").length,
        imagesGenerated: batch.items.filter((item) =>
          ["completed", "accepted"].includes(item.imageStatus)
        ).length,
        estimatedAiCostUsd: batch.estimatedAiCostUsd,
        published: 0,
        articles: batch.items.map((item) => ({
          title: item.postTitle || item.topic,
          category: item.category,
          trendScore: item.trendScore,
          sourceCount: item.sourceCount,
          factCheckStatus: item.factCheckStatus,
          trustScore: item.trustScore,
          imageStatus: item.imageStatus,
          approvalStatus: item.approvalStatus,
          plannedPublishAt: item.plannedPublishAt.toISOString(),
          estimatedAiCostUsd: item.estimatedAiCostUsd,
          error: item.lastError
        }))
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
