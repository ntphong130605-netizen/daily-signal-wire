import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { evaluateArticleQuality, type ArticleQualityReport } from "@/lib/aiQuality";
import { slugify } from "@/lib/slug";

export const AI_JOURNALIST_PROMPT_VERSION = "ai-journalist-v1.0";

export const JournalistToneSchema = z.enum(["Neutral", "Business", "Breaking", "Analysis"]);
export type JournalistTone = z.infer<typeof JournalistToneSchema>;

const FaqSchema = z.object({
  question: z.string().min(20).max(140),
  answer: z.string().min(50).max(420)
});

const InternalLinkSuggestionSchema = z.object({
  title: z.string().min(5).max(140),
  url: z.string().min(1).max(240),
  reason: z.string().min(10).max(220)
});

export const JournalistArticleSchema = z.object({
  headline: z.string().min(20).max(120),
  seoTitle: z.string().min(20).max(70),
  metaDescription: z.string().min(90).max(165),
  slug: z.string().min(3).max(100),
  deck: z.string().min(40).max(220),
  heroCaption: z.string().min(30).max(260),
  lead: z.string().min(80).max(420),
  body: z.string().min(2200).max(8500),
  timeline: z.array(z.string().min(8).max(240)).max(10),
  keyTakeaways: z.array(z.string().min(20).max(180)).min(3).max(6),
  faq: z.array(FaqSchema).min(3).max(6),
  tags: z.array(z.string().min(2).max(40)).min(3).max(10),
  relatedTopics: z.array(z.string().min(2).max(80)).min(2).max(10),
  internalLinkSuggestions: z.array(InternalLinkSuggestionSchema).max(8),
  category: z.string().min(3).max(50),
  readingTimeMinutes: z.number().int().min(1).max(12),
  author: z.string().min(3).max(80),
  publishedDate: z.string().min(8).max(40),
  updatedDate: z.string().min(8).max(40),
  imagePrompt: z.string().min(100).max(1500),
  summary: z.string().min(100).max(700),
  excerpt: z.string().min(80).max(260),
  openGraphDescription: z.string().min(90).max(220),
  twitterDescription: z.string().min(80).max(220),
  keywords: z.array(z.string().min(2).max(50)).min(4).max(14),
  sourceUrls: z.array(z.string().min(8).max(600)).min(1).max(14),
  factCheckNotes: z.array(z.string().min(5).max(300)).min(1).max(20)
});

export type JournalistArticle = z.infer<typeof JournalistArticleSchema>;

const RewriteSchema = z.object({
  headline: z.string().min(20).max(120).optional(),
  seoTitle: z.string().min(20).max(70).optional(),
  metaDescription: z.string().min(90).max(165).optional(),
  deck: z.string().min(40).max(220).optional(),
  lead: z.string().min(80).max(420).optional(),
  body: z.string().min(600).max(8500).optional(),
  summary: z.string().min(100).max(700).optional(),
  excerpt: z.string().min(80).max(260).optional(),
  openGraphDescription: z.string().min(90).max(220).optional(),
  facebookCaption: z.string().min(40).max(500).optional(),
  faq: z.array(FaqSchema).min(3).max(6).optional(),
  factCheckNotes: z.array(z.string().min(5).max(300)).max(20).optional()
});

export type JournalistRewrite = z.infer<typeof RewriteSchema>;

export type JournalistSection = "headline" | "lead" | "body" | "faq" | "meta" | "summary";

export type JournalistInput = {
  topic: string;
  category: string;
  trendScore?: number;
  relatedQueries: string[];
  keywords: string[];
  entities: string[];
  sourceUrls: string[];
  sourcePacket: Array<{
    headline: string;
    summary?: string | null;
    publisher?: string | null;
    url: string;
    credibilityTier?: string | null;
    publishedAt?: string | null;
  }>;
  researchBrief?: {
    whyTrending?: string | null;
    readerValue?: string | null;
    verifiedFacts: string[];
    uncertainClaims: string[];
    timeline: string[];
    suggestedAngles: string[];
    factCheckNotes: string[];
    riskLevel?: string | null;
    recommendedAction?: string | null;
    scoreBreakdown?: Record<string, unknown>;
  };
  internalLinks: Array<{
    title: string;
    url: string;
    category?: string | null;
  }>;
};

export type JournalistGenerationResult = {
  article: JournalistArticle;
  content: string;
  quality: ArticleQualityReport;
  metadata: {
    promptVersion: string;
    model: string;
    tone: JournalistTone;
    generatedAt: string;
    quality: ArticleQualityReport;
  };
  tokenUsage: unknown;
  generationTimeMs: number;
};

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function usageFrom(response: unknown) {
  if (response && typeof response === "object" && "usage" in response) {
    return (response as { usage?: unknown }).usage ?? {};
  }
  return {};
}

function composeContent(article: JournalistArticle) {
  return `${article.lead.trim()}\n\n${article.body.trim()}`.trim();
}

const baseInstructions = `
You are the AI Journalist for Daily Signal Wire, a source-first US newsroom.
Write professional English news copy inspired by Reuters, AP, Bloomberg, BBC and CNN.
Be concise, natural, factual and calm. Do not use clickbait.
Use only the supplied source packet and research brief.
Never invent statistics, people, organizations, dates, locations, causal claims or quotes.
Do not include direct quotes unless the exact quote is supplied in the source packet.
Mark uncertain or developing claims with "according to available reports".
If sources disagree, explicitly preserve uncertainty instead of choosing a side.
The draft is for editor review only and must not imply final publication.
The body must be 500-900 words including the lead, use markdown H2/H3 section headings, and avoid an H1.
Include a conclusion section.
Hero image prompt must be realistic editorial news photography style, landscape 16:9, no text, no watermark, no logo, no border.
For real-world events, public figures, disasters, elections, crime, war, health or ongoing news, the image prompt must request a staged/generic editorial image and must not fake a documentary scene.
Return JSON only.
`;

function toneInstruction(tone: JournalistTone) {
  if (tone === "Business") {
    return "Tone: business desk. Emphasize economic stakes, market context, consumers, companies and decision-makers without inventing numbers.";
  }
  if (tone === "Breaking") {
    return "Tone: breaking news desk. Use short, direct sentences, emphasize what is known now and clearly mark what remains unclear.";
  }
  if (tone === "Analysis") {
    return "Tone: analysis desk. Add context and implications while clearly separating verified facts from interpretation.";
  }
  return "Tone: neutral news desk. Prioritize clarity, context and careful attribution.";
}

function normalizeArticle(article: JournalistArticle): JournalistArticle {
  return {
    ...article,
    slug: slugify(article.slug || article.headline),
    author: article.author || "Daily Signal Wire Desk",
    tags: Array.from(new Set(article.tags)).slice(0, 10),
    relatedTopics: Array.from(new Set(article.relatedTopics)).slice(0, 10),
    keywords: Array.from(new Set(article.keywords)).slice(0, 14),
    sourceUrls: Array.from(new Set(article.sourceUrls)).slice(0, 14)
  };
}

export async function generateJournalistArticle(
  input: JournalistInput,
  tone: JournalistTone = "Neutral"
): Promise<JournalistGenerationResult> {
  const model = process.env.AI_MODEL || "gpt-5.5";
  const allowedUrls = new Set(input.sourceUrls);
  let correction = "";
  const startedAt = Date.now();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await client().responses.parse({
      model,
      instructions: `${baseInstructions}\n${toneInstruction(tone)}`,
      input: JSON.stringify({
        task: "Transform this research brief into a complete newsroom draft article.",
        promptVersion: AI_JOURNALIST_PROMPT_VERSION,
        tone,
        input,
        correctionFromPreviousAttempt: correction || undefined,
        outputRequirements: [
          "headline",
          "seoTitle",
          "metaDescription",
          "slug",
          "deck",
          "heroCaption",
          "lead",
          "body",
          "timeline",
          "keyTakeaways",
          "faq",
          "tags",
          "relatedTopics",
          "internalLinkSuggestions",
          "category",
          "readingTimeMinutes",
          "author",
          "publishedDate",
          "updatedDate",
          "imagePrompt"
        ]
      }),
      text: { format: zodTextFormat(JournalistArticleSchema, "daily_signal_wire_ai_journalist") }
    });

    const parsed = response.output_parsed;
    if (!parsed) throw new Error("AI Journalist did not return a draft.");
    const article = normalizeArticle(parsed);
    const invalidUrl = article.sourceUrls.find((url) => !allowedUrls.has(url));
    const content = composeContent(article);
    const quality = evaluateArticleQuality({
      content,
      seoTitle: article.seoTitle,
      seoDescription: article.metaDescription,
      tags: article.tags
    });

    if (!invalidUrl && quality.passed) {
      return {
        article,
        content,
        quality,
        metadata: {
          promptVersion: AI_JOURNALIST_PROMPT_VERSION,
          model,
          tone,
          generatedAt: new Date().toISOString(),
          quality
        },
        tokenUsage: usageFrom(response),
        generationTimeMs: Date.now() - startedAt
      };
    }

    correction = [
      invalidUrl ? "sourceUrls contained a URL outside the supplied source packet." : "",
      ...quality.warnings
    ]
      .filter(Boolean)
      .join(" ");
  }

  throw new Error(`AI Journalist draft failed quality checks. ${correction}`);
}

export async function rewriteJournalistSection({
  section,
  tone,
  draft
}: {
  section: JournalistSection;
  tone: JournalistTone;
  draft: Record<string, unknown>;
}) {
  const model = process.env.AI_MODEL || "gpt-5.5";
  const startedAt = Date.now();
  const response = await client().responses.parse({
    model,
    instructions: `${baseInstructions}
${toneInstruction(tone)}
Rewrite only the requested section: ${section}.
Do not rewrite unrelated sections. Do not add unsupported facts.
Return JSON with only the fields needed for that section.`,
    input: JSON.stringify({
      task: "Rewrite one section of an existing Daily Signal Wire draft.",
      promptVersion: AI_JOURNALIST_PROMPT_VERSION,
      section,
      tone,
      draft
    }),
    text: { format: zodTextFormat(RewriteSchema, `daily_signal_wire_rewrite_${section}`) }
  });
  if (!response.output_parsed) throw new Error("AI Journalist did not return a rewrite.");
  return {
    rewrite: response.output_parsed,
    metadata: {
      promptVersion: AI_JOURNALIST_PROMPT_VERSION,
      model,
      tone,
      section,
      generatedAt: new Date().toISOString()
    },
    tokenUsage: usageFrom(response),
    generationTimeMs: Date.now() - startedAt
  };
}
