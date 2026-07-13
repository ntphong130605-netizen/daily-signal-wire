import { generateDraftForTrendWithStatus } from "@/lib/aiJournalistDraft";

export async function generateDraftForTrend(trendId: string) {
  return generateDraftForTrendWithStatus(trendId, "Neutral");
}
