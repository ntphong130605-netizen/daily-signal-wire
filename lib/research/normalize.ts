import { slugify } from "@/lib/slug";
import {
  RESEARCH_CATEGORIES,
  type NormalizedResearchSignal,
  type ResearchCategory,
  type ResearchSourceAdapterOutput
} from "@/lib/research/types";
import { assessCredibility } from "@/lib/research/credibility";
import { classifyRisk } from "@/lib/research/risk";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "gclsrc",
  "dclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "mkt_tok",
  "oly_enc_id",
  "spm",
  "ref",
  "ref_src"
]);

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "for",
  "from",
  "with",
  "into",
  "after",
  "before",
  "over",
  "under",
  "this",
  "that",
  "is",
  "are",
  "was",
  "were",
  "will",
  "new",
  "latest",
  "live",
  "update",
  "updates"
]);

const CATEGORY_RULES: Array<[ResearchCategory, RegExp]> = [
  ["Politics", /\b(election|senate|house|congress|campaign|biden|trump|governor|mayor|vote|ballot|white house|supreme court)\b/i],
  ["Business", /\b(company|earnings|stock|market|inflation|fed|jobs|layoff|merger|ipo|retail|economy|business)\b/i],
  ["Technology", /\b(ai|artificial intelligence|tech|software|iphone|android|google|microsoft|apple|openai|tesla|chip|cyber|data)\b/i],
  ["Science", /\b(space|nasa|research|scientist|study|physics|biology|astronomy|mission|rocket)\b/i],
  ["Health", /\b(health|covid|vaccine|hospital|disease|drug|fda|cdc|doctor|medicine|outbreak)\b/i],
  ["Sports", /\b(nfl|nba|mlb|nhl|soccer|football|basketball|baseball|tennis|golf|olympic|world cup|match|game)\b/i],
  ["Entertainment", /\b(movie|music|celebrity|actor|singer|album|film|netflix|disney|hollywood|box office|tv)\b/i],
  ["Travel", /\b(travel|airline|airport|flight|hotel|tourism|cruise|destination|vacation)\b/i],
  ["Climate", /\b(climate|weather|hurricane|wildfire|storm|heat wave|flood|drought|emissions|earthquake)\b/i],
  ["Lifestyle", /\b(food|restaurant|fashion|home|family|culture|lifestyle|wellness|recipe|shopping)\b/i],
  ["World", /\b(ukraine|russia|china|israel|gaza|europe|asia|africa|global|united nations|war|foreign)\b/i],
  ["US News", /\b(us|u\.s\.|america|american|state|police|school|city|county)\b/i]
];

export function cleanResearchText(value: unknown, maxLength = 700) {
  return String(value ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function canonicalizeUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of Array.from(url.searchParams.keys())) {
      if (key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase())) {
        url.searchParams.delete(key);
      }
    }
    const sorted = new URLSearchParams();
    Array.from(url.searchParams.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, paramValue]) => sorted.append(key, paramValue));
    url.search = sorted.toString();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function normalizeKeyword(value: string) {
  const tokens = cleanResearchText(value, 180)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
  return tokens.slice(0, 12).join(" ") || cleanResearchText(value, 90).toLowerCase();
}

export function clusterKeyFor(topic: string, category: string) {
  return `${slugify(category)}:${slugify(normalizeKeyword(topic)) || slugify(topic)}`;
}

export function classifyCategory(text: string, hint?: string): ResearchCategory {
  const normalizedHint = cleanResearchText(hint || "", 80);
  const fromHint = RESEARCH_CATEGORIES.find(
    (category) => category.toLowerCase() === normalizedHint.toLowerCase()
  );
  if (fromHint) return fromHint;
  for (const [category, rule] of CATEGORY_RULES) {
    if (rule.test(text)) return category;
  }
  return "US News";
}

function parsePublishedAt(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeResearchSignal(
  signal: ResearchSourceAdapterOutput
): NormalizedResearchSignal | null {
  const headline = cleanResearchText(signal.headline || signal.keyword, 220);
  const keyword = cleanResearchText(signal.keyword || headline, 140);
  const sourceUrl = String(signal.sourceUrl || "").trim();
  if (!headline || !keyword || !sourceUrl.startsWith("http")) return null;
  const canonicalUrl = canonicalizeUrl(sourceUrl);
  const category = classifyCategory(`${keyword} ${headline} ${signal.summary}`, signal.categoryHint);
  const riskLevel = classifyRisk(`${keyword} ${headline} ${signal.summary}`).riskLevel;
  return {
    ...signal,
    externalId: cleanResearchText(signal.externalId, 260) || `${signal.source}:${canonicalUrl}`,
    keyword,
    headline,
    summary: cleanResearchText(signal.summary, 600),
    publisher: cleanResearchText(signal.publisher || signal.source, 120),
    region: signal.region || "US",
    language: signal.language || "en-US",
    sourceUrl,
    canonicalUrl,
    normalizedKeyword: normalizeKeyword(keyword || headline),
    category,
    credibilityTier: assessCredibility(sourceUrl, signal.publisher),
    riskLevel,
    publishedAtDate: parsePublishedAt(signal.publishedAt),
    relatedQueries: signal.relatedQueries.map((query) => cleanResearchText(query, 140)).filter(Boolean)
  };
}

export function tokenSet(value: string) {
  return new Set(normalizeKeyword(value).split(/\s+/).filter(Boolean));
}

export function titleSimilarity(a: string, b: string) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (!left.size || !right.size) return 0;
  const intersection = Array.from(left).filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function extractEntitiesFromText(value: string) {
  const matches = cleanResearchText(value, 1000).match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\b/g) || [];
  return Array.from(new Set(matches.filter((item) => item.length > 3))).slice(0, 12);
}
