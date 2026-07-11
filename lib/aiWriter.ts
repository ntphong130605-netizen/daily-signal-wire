import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { slugify } from "@/lib/slug";
import type { SourceContext } from "@/lib/trends";

export type TrendForWriter = {
  keyword: string;
  relatedQueries: string[];
  sources: SourceContext[];
};

const ArticleSchema = z.object({
  title: z.string().min(20).max(120),
  subtitle: z.string().min(40).max(180),
  slug: z.string().min(3).max(100),
  excerpt: z.string().min(80).max(260),
  summary: z.string().min(120).max(700),
  content: z.string().min(2500).max(9000),
  seoTitle: z.string().min(20).max(70),
  seoDescription: z.string().min(100).max(165),
  openGraphDescription: z.string().min(90).max(220),
  facebookCaption: z.string().min(40).max(500),
  tags: z.array(z.string().min(2).max(32)).min(3).max(8),
  faq: z
    .array(
      z.object({
        question: z.string().min(20).max(140),
        answer: z.string().min(50).max(420)
      })
    )
    .min(3)
    .max(6),
  imagePrompt: z.string().min(80).max(1200),
  category: z.string().min(3).max(50),
  sourceUrls: z.array(z.string().min(8).max(500)).min(1).max(10),
  factCheckNotes: z.array(z.string().min(5)).min(1).max(20)
});

export type GeneratedArticle = z.infer<typeof ArticleSchema>;

function client() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function wordCount(markdown: string) {
  return markdown
    .replace(/[#*_>`\[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

const editorialRules = `
You are the senior standards editor for Daily Signal Wire, a modern US news publication.
The trend is only an idea signal. Write an entirely original English-language article.
Use ONLY factual claims supported by the supplied source packet. Never copy source wording.
Never invent a number, date, quote, person, attribution, or causal claim.
Do not include direct quotes unless the exact quote appears in the source packet; prefer paraphrase.
If reporting is incomplete or uncertain, explicitly write "according to available reports".
The headline must be engaging but strictly accurate and non-sensational.
Generate a subtitle, short summary, tags, FAQ, SEO title, SEO description, OpenGraph description, slug, and Facebook caption as part of the same JSON object.
The FAQ must answer likely reader questions using only supported facts from the supplied source packet.
Tags must be concise newsroom tags, not hashtags.
The article body must be 500-900 words and begin with a short unheaded intro, followed by exactly:
## What happened
## Why it matters
## Background
## What comes next
Return sourceUrls only from the supplied source packet.
factCheckNotes must identify every claim or ambiguity an editor should verify and end with "Fact-check before publishing."
The image prompt must be specific to the article. Base it on the article title, category, short summary, main event or issue, important people/objects only when supported by the sources, location only when supported by the sources, visual mood, and editorial context.
It must request a realistic editorial news photography style image in landscape 16:9 that looks like professional AP/Reuters-style news photography: realistic, high detail, natural lighting, natural skin tones when people appear, and professional composition.
It must explicitly prohibit cartoon, illustration, painting, anime, 3D render, fantasy art, watermark, readable text, logos, borders, frames, captions, and brand marks.
If the article discusses a real event or developing report, the prompt must say the image must be staged, generic and editorial, not a documentary photo, eyewitness photo, evidence image, mugshot, or actual event capture.
Do not imply that an AI-generated image depicts a real moment, person, crime scene, disaster scene, evidence photo, or event photograph.
`;

export async function generateArticleFromTrend(
  trend: TrendForWriter
): Promise<GeneratedArticle> {
  if (trend.sources.length === 0) {
    throw new Error("No verifiable source packet is available for this trend.");
  }

  const allowedUrls = new Set(trend.sources.map((source) => source.url));
  let lastProblem = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await client().responses.parse({
      model: process.env.AI_MODEL || "gpt-5.5",
      instructions: editorialRules,
      input: JSON.stringify({
        task: "Create a complete draft article JSON object.",
        trendKeyword: trend.keyword,
        relatedQueries: trend.relatedQueries,
        sourcePacket: trend.sources,
        correctionFromPreviousAttempt: lastProblem || undefined
      }),
      text: {
        format: zodTextFormat(ArticleSchema, "daily_signal_wire_article")
      }
    });

    const article = response.output_parsed;
    if (!article) {
      throw new Error("The AI response was refused or did not contain an article.");
    }

    const words = wordCount(article.content);
    const invalidUrl = article.sourceUrls.find((url) => !allowedUrls.has(url));
    if (words >= 500 && words <= 900 && !invalidUrl) {
      return {
        ...article,
        slug: slugify(article.slug || article.title),
        sourceUrls: [...new Set(article.sourceUrls)]
      };
    }

    lastProblem = [
      words < 500 || words > 900
        ? `Article body has ${words} words; it must have 500-900.`
        : "",
      invalidUrl
        ? "sourceUrls included a URL outside the supplied source packet."
        : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  throw new Error(`AI draft failed editorial validation. ${lastProblem}`);
}

const ShortTextSchema = z.object({ value: z.string().min(20).max(500) });

export async function regenerateArticleField(
  field: "title" | "facebookCaption",
  article: { title: string; excerpt: string; content: string }
) {
  const response = await client().responses.parse({
    model: process.env.AI_MODEL || "gpt-5.5",
    instructions:
      field === "title"
        ? "Write one accurate, engaging US news headline. Do not add facts, certainty, or sensational claims. Return JSON."
        : "Write one concise Facebook caption for a US news article. Stay factual, do not add claims, and avoid clickbait. Return JSON.",
    input: JSON.stringify(article),
    text: { format: zodTextFormat(ShortTextSchema, `regenerated_${field}`) }
  });
  if (!response.output_parsed) throw new Error("AI did not return replacement text.");
  return response.output_parsed.value;
}

export async function regenerateFullArticleDraft(article: {
  title: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  content: string;
  seoTitle: string;
  seoDescription: string;
  openGraphDescription?: string | null;
  facebookCaption: string;
  imagePrompt?: string | null;
  category?: string | null;
  sourceUrls: string[];
  factCheckNotes: string[];
  tags?: string[];
  faq?: Array<{ question: string; answer: string }>;
}): Promise<GeneratedArticle> {
  const response = await client().responses.parse({
    model: process.env.AI_MODEL || "gpt-5.5",
    instructions: `${editorialRules}
Regenerate the complete draft from the existing source URLs, fact-check notes, and current draft context.
Do not add facts outside the supplied context. Keep sourceUrls exactly within the supplied sourceUrls list.`,
    input: JSON.stringify({
      task: "Regenerate a complete Daily Signal Wire article draft JSON object.",
      currentDraft: article
    }),
    text: {
      format: zodTextFormat(ArticleSchema, "daily_signal_wire_regenerated_article")
    }
  });

  const result = response.output_parsed;
  if (!result) throw new Error("AI did not return a regenerated article.");

  const allowedUrls = new Set(article.sourceUrls);
  const invalidUrl = result.sourceUrls.find((url) => !allowedUrls.has(url));
  const words = wordCount(result.content);
  if (invalidUrl) {
    throw new Error("Regenerated article included a URL outside the current sources.");
  }
  if (words < 500 || words > 900) {
    throw new Error(`Regenerated article has ${words} words; it must have 500-900.`);
  }

  return {
    ...result,
    slug: slugify(result.slug || result.title),
    sourceUrls: [...new Set(result.sourceUrls)]
  };
}
