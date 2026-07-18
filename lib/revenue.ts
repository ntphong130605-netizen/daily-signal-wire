import { prisma } from "@/lib/prisma";
import { parseStringArray } from "@/lib/json";

export const affiliateNetworks = [
  "amazon",
  "impact",
  "cj",
  "shareasale",
  "awin",
  "custom"
] as const;

export type AffiliateNetwork = (typeof affiliateNetworks)[number];

export type RevenueExperimentPayload = {
  id: string;
  key: string;
  type: string;
  variants: Array<{ id: string; key: string; label: string; value: string; weight: number }>;
};

export function affiliateReadiness() {
  return [
    { network: "amazon", configured: Boolean(process.env.AMAZON_TAG), missing: ["AMAZON_TAG"] },
    { network: "impact", configured: Boolean(process.env.IMPACT_API_KEY), missing: ["IMPACT_API_KEY"] },
    { network: "cj", configured: Boolean(process.env.CJ_API_KEY), missing: ["CJ_API_KEY"] },
    {
      network: "shareasale",
      configured: Boolean(process.env.SHAREASALE_API_TOKEN),
      missing: ["SHAREASALE_API_TOKEN"]
    },
    { network: "awin", configured: Boolean(process.env.AWIN_API_KEY), missing: ["AWIN_API_KEY"] },
    {
      network: "custom",
      configured: Boolean(process.env.CUSTOM_AFFILIATE_URL),
      missing: ["CUSTOM_AFFILIATE_URL"]
    }
  ].map((item) => ({
    ...item,
    missing: item.configured ? [] : item.missing
  }));
}

export function rate(numerator: number, denominator: number, multiplier = 1) {
  return denominator > 0 ? (numerator / denominator) * multiplier : null;
}

type AdMetric = {
  date: Date;
  position: string | null;
  articleSlug: string | null;
  category: string | null;
  country: string | null;
  device: string | null;
  trafficSource: string | null;
  impressions: number;
  viewableImpressions: number;
  clicks: number;
  pageViews: number;
  estimatedRevenue: number;
};

function sumMetrics(rows: AdMetric[]) {
  const totals = rows.reduce(
    (sum, row) => ({
      impressions: sum.impressions + row.impressions,
      viewableImpressions: sum.viewableImpressions + row.viewableImpressions,
      clicks: sum.clicks + row.clicks,
      pageViews: sum.pageViews + row.pageViews,
      revenue: sum.revenue + row.estimatedRevenue
    }),
    { impressions: 0, viewableImpressions: 0, clicks: 0, pageViews: 0, revenue: 0 }
  );
  return {
    ...totals,
    ctr: rate(totals.clicks, totals.impressions, 100),
    viewability: rate(totals.viewableImpressions, totals.impressions, 100),
    rpm: rate(totals.revenue, totals.pageViews, 1000),
    cpc: rate(totals.revenue, totals.clicks)
  };
}

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function ranked(rows: AdMetric[], key: keyof Pick<AdMetric, "position" | "articleSlug" | "category" | "country" | "device" | "trafficSource">) {
  const groups = new Map<string, AdMetric[]>();
  for (const row of rows) {
    const label = row[key] || "Unknown";
    groups.set(label, [...(groups.get(label) || []), row]);
  }
  return [...groups.entries()]
    .map(([label, values]) => ({ label, ...sumMetrics(values) }))
    .sort((a, b) => b.revenue - a.revenue || b.pageViews - a.pageViews)
    .slice(0, 10);
}

export async function revenueIntelligence() {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDays = new Date(today);
  sevenDays.setDate(sevenDays.getDate() - 6);
  const thirtyDays = new Date(today);
  thirtyDays.setDate(thirtyDays.getDate() - 29);

  const [adRows, affiliateConversions, affiliateLinks, newsletterRows, subscribers, articleEvents] =
    await Promise.all([
      prisma.adPerformanceMetric.findMany({
        where: { date: { gte: thirtyDays } },
        orderBy: { date: "desc" },
        take: 10_000
      }),
      prisma.affiliateConversion.findMany({
        where: { occurredAt: { gte: thirtyDays } },
        include: { link: { select: { label: true, category: true } } },
        orderBy: { occurredAt: "desc" },
        take: 5_000
      }),
      prisma.affiliateLink.findMany({
        include: { program: { select: { name: true, network: true } } },
        orderBy: [{ revenue: "desc" }, { clicks: "desc" }],
        take: 100
      }),
      prisma.newsletterMetric.findMany({
        where: { date: { gte: thirtyDays } },
        orderBy: { date: "desc" },
        take: 1_000
      }),
      prisma.newsletterSubscriber.count({ where: { status: "active" } }),
      prisma.analyticsEvent.findMany({
        where: { eventName: "article_view", createdAt: { gte: thirtyDays } },
        select: { articleSlug: true, category: true, createdAt: true },
        take: 10_000
      })
    ]);

  const adMetrics = adRows as AdMetric[];
  const todayRows = adMetrics.filter((row) => row.date >= today);
  const yesterdayRows = adMetrics.filter((row) => row.date >= yesterday && row.date < today);
  const sevenDayRows = adMetrics.filter((row) => row.date >= sevenDays);
  const affiliateRevenue = affiliateConversions.reduce((sum, row) => sum + row.commission, 0);
  const newsletter = newsletterRows.reduce(
    (sum, row) => ({
      sends: sum.sends + row.sends,
      delivered: sum.delivered + row.delivered,
      opens: sum.opens + row.opens,
      clicks: sum.clicks + row.clicks,
      affiliateClicks: sum.affiliateClicks + row.affiliateClicks,
      revenue: sum.revenue + row.revenue
    }),
    { sends: 0, delivered: 0, opens: 0, clicks: 0, affiliateClicks: 0, revenue: 0 }
  );
  const hourCounts = Array.from({ length: 24 }, (_, hour) => ({ hour, views: 0 }));
  for (const event of articleEvents) hourCounts[event.createdAt.getUTCHours()].views += 1;
  hourCounts.sort((a, b) => b.views - a.views);

  return {
    today: sumMetrics(todayRows),
    yesterday: sumMetrics(yesterdayRows),
    sevenDays: sumMetrics(sevenDayRows),
    thirtyDays: sumMetrics(adMetrics),
    affiliateRevenue,
    adRevenue: sumMetrics(adMetrics).revenue,
    newsletterRevenue: newsletter.revenue,
    totalRevenue: sumMetrics(adMetrics).revenue + affiliateRevenue + newsletter.revenue,
    subscribers,
    newsletter: {
      ...newsletter,
      openRate: rate(newsletter.opens, newsletter.delivered, 100),
      ctr: rate(newsletter.clicks, newsletter.delivered, 100)
    },
    topArticles: ranked(adMetrics, "articleSlug"),
    topCategories: ranked(adMetrics, "category"),
    topCountries: ranked(adMetrics, "country"),
    topPositions: ranked(adMetrics, "position"),
    topDevices: ranked(adMetrics, "device"),
    topTrafficSources: ranked(adMetrics, "trafficSource"),
    topAffiliateLinks: affiliateLinks,
    bestPublishHourUtc: hourCounts[0]?.views ? hourCounts[0] : null,
    importedRows: adRows.length,
    hasRealRevenueData:
      adRows.length > 0 || affiliateConversions.length > 0 || newsletterRows.length > 0
  };
}

export async function affiliateOffersForArticle(input: {
  category: string;
  content: string;
}) {
  const links = await prisma.affiliateLink.findMany({
    where: { status: "active", program: { status: "active" } },
    include: { program: { select: { name: true, network: true, disclosure: true } } },
    orderBy: [{ revenue: "desc" }, { clicks: "desc" }, { updatedAt: "desc" }],
    take: 50
  });
  const haystack = `${input.category} ${input.content}`.toLowerCase();
  return links
    .map((link) => {
      const keywords = parseStringArray(link.keywords);
      const categoryMatch = link.category?.toLowerCase() === input.category.toLowerCase();
      const keywordMatches = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
      return { link, score: (categoryMatch ? 5 : 0) + keywordMatches };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ link }) => ({
      id: link.id,
      label: link.label,
      imageUrl: link.imageUrl,
      priceText: link.priceText,
      callToAction: link.callToAction,
      disclosure: link.disclosure || link.program.disclosure,
      program: link.program.name,
      network: link.program.network
    }));
}

export function revenueRecommendations(data: Awaited<ReturnType<typeof revenueIntelligence>>) {
  if (!data.hasRealRevenueData) {
    return ["Waiting for imported AdSense, affiliate or newsletter revenue data."];
  }
  const recommendations: string[] = [];
  const topPosition = data.topPositions[0];
  const lowPosition = [...data.topPositions].filter((row) => row.impressions >= 100).sort((a, b) => (a.rpm || 0) - (b.rpm || 0))[0];
  if (topPosition?.rpm) recommendations.push(`${topPosition.label} is the strongest measured ad position at $${topPosition.rpm.toFixed(2)} RPM.`);
  if (lowPosition?.rpm !== null && lowPosition?.rpm !== undefined) recommendations.push(`Review ${lowPosition.label}; it is the lowest measured eligible placement at $${lowPosition.rpm.toFixed(2)} RPM.`);
  if (data.topCategories[0]?.revenue > 0) recommendations.push(`${data.topCategories[0].label} is the highest-revenue category in the imported data.`);
  if (data.topCountries[0]?.revenue > 0) recommendations.push(`${data.topCountries[0].label} is currently the leading revenue country.`);
  if (data.bestPublishHourUtc) recommendations.push(`Recent article traffic peaks around ${String(data.bestPublishHourUtc.hour).padStart(2, "0")}:00 UTC; test publishing near that hour.`);
  return recommendations.length ? recommendations : ["More measured impressions are required before changing monetization placement."];
}

export async function activeRevenueExperiments(input: { articleSlug: string; category: string }) {
  const now = new Date();
  const experiments = await prisma.revenueExperiment.findMany({
    where: {
      status: "active",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        {
          OR: [
            { targetArticleSlug: input.articleSlug },
            { targetCategory: input.category },
            { targetArticleSlug: null, targetCategory: null }
          ]
        }
      ]
    },
    include: { variants: { orderBy: { key: "asc" } } },
    orderBy: { createdAt: "desc" }
  });
  return experiments.map((experiment) => ({
    id: experiment.id,
    key: experiment.key,
    type: experiment.type,
    variants: experiment.variants.map((variant) => ({
      id: variant.id,
      key: variant.key,
      label: variant.label,
      value: variant.value,
      weight: variant.weight
    }))
  })) satisfies RevenueExperimentPayload[];
}
