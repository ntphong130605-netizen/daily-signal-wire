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
  slug: z.string().min(3).max(100),
  excerpt: z.string().min(80).max(260),
  content: z.string().min(2500).max(9000),
  seoTitle: z.string().min(20).max(70),
  seoDescription: z.string().min(100).max(165),
  facebookCaption: z.string().min(40).max(500),
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
The article body must be 500-900 words and begin with a short unheaded intro, followed by exactly:
## What happened
## Why it matters
## Background
## What comes next
Return sourceUrls only from the supplied source packet.
factCheckNotes must identify every claim or ambiguity an editor should verify and end with "Fact-check before publishing."
The image prompt must be specific to the article. Base it on the article title, category, short summary, main event or issue, important people/objects only when supported by the sources, location only when supported by the sources, visual mood, and editorial context.
It must request a realistic editorial photography-style image in landscape 16:9, ultra realistic, 8K look, editorial magazine quality, cinematic but natural lighting, high detail, realistic lighting, natural skin tones when people appear, newspaper style, and professional composition.
It must explicitly prohibit watermark, readable text, logos, borders, frames, captions, and brand marks.
If the article discusses a real event or developing report, the prompt must say the image should not look like documentary photography or a real event photo. It should be a staged, symbolic, photorealistic editorial illustration instead.
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
      model: process.env.AI_MODEL || "gpt-5.6-luna",
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
    model: process.env.AI_MODEL || "gpt-5.6-luna",
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
