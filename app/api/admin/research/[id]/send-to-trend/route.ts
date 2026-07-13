import { apiError, protectMutation } from "@/lib/apiSecurity";
import { databaseUnavailableResponse, isDatabaseConfigured, prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

function parseList(value: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();
    const { id } = await params;
    const candidate = await prisma.researchCandidate.findUnique({
      where: { id },
      include: { sources: true, brief: true }
    });
    if (!candidate) return Response.json({ error: "Research candidate not found." }, { status: 404 });
    if (candidate.riskLevel === "blocked" || candidate.recommendedAction === "blocked") {
      return Response.json(
        { error: "Blocked research candidates cannot be sent to article generation." },
        { status: 422 }
      );
    }

    const normalizedKeyword = slugify(candidate.topic);
    const sourceUrls = candidate.sources.map((source) => source.canonicalUrl || source.sourceUrl);
    const relatedQueries = candidate.brief
      ? parseList(candidate.brief.relatedQueries)
      : candidate.sources.map((source) => source.headline);
    const sourceContext = candidate.sources.map((source) => ({
      title: source.headline,
      source: source.publisher || source.source,
      url: source.canonicalUrl || source.sourceUrl,
      snippet: source.summary || ""
    }));

    const trend = await prisma.trend.upsert({
      where: { normalizedKeyword },
      update: {
        keyword: candidate.topic,
        traffic: `Research score ${Math.round(candidate.trendScore)}`,
        category: candidate.category,
        relatedQueries: JSON.stringify(relatedQueries.slice(0, 10)),
        sourceUrls: JSON.stringify(sourceUrls.slice(0, 12)),
        sourceContext: JSON.stringify(sourceContext.slice(0, 12))
      },
      create: {
        keyword: candidate.topic,
        normalizedKeyword,
        traffic: `Research score ${Math.round(candidate.trendScore)}`,
        category: candidate.category,
        relatedQueries: JSON.stringify(relatedQueries.slice(0, 10)),
        sourceUrls: JSON.stringify(sourceUrls.slice(0, 12)),
        sourceContext: JSON.stringify(sourceContext.slice(0, 12))
      }
    });

    await prisma.researchCandidate.update({
      where: { id },
      data: {
        status: "sent_to_pipeline",
        recommendedAction: "generate_draft"
      }
    });

    return Response.json({
      ok: true,
      trendId: trend.id,
      trendUrl: `/admin/trends?highlight=${trend.id}`,
      message: "Research brief was sent to the existing trend draft workflow."
    });
  } catch (error) {
    return apiError(error);
  }
}
