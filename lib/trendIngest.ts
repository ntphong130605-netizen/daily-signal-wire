import { prisma } from "@/lib/prisma";
import { fetchGoogleTrendsUS } from "@/lib/trends";

export async function ingestGoogleTrendsUS() {
  const candidates = await fetchGoogleTrendsUS();
  const newTrendIds: string[] = [];
  let existing = 0;

  for (const candidate of candidates) {
    const current = await prisma.trend.findUnique({
      where: { normalizedKeyword: candidate.normalizedKeyword },
      select: { id: true }
    });
    if (current) {
      existing += 1;
      continue;
    }
    const trend = await prisma.trend.create({
      data: {
        keyword: candidate.keyword,
        normalizedKeyword: candidate.normalizedKeyword,
        traffic: candidate.traffic,
        relatedQueries: JSON.stringify(candidate.relatedQueries),
        sourceUrls: JSON.stringify(candidate.sources.map((source) => source.url)),
        sourceContext: JSON.stringify(candidate.sources)
      }
    });
    newTrendIds.push(trend.id);
  }

  return {
    discovered: candidates.length,
    created: newTrendIds.length,
    existing,
    newTrendIds
  };
}
