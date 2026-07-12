import { parseStringArray } from "@/lib/json";

export type EditorialImagePromptInput = {
  headline: string;
  subtitle?: string | null;
  summary?: string | null;
  excerpt?: string | null;
  content?: string | null;
  category?: string | null;
  keywords?: string[] | string | null;
  country?: string | null;
  tone?: string | null;
  basePrompt?: string | null;
};

export type EditorialImagePlan = {
  topic: string;
  category: string;
  keywords: string[];
  entities: string[];
  location: string | null;
  country: string | null;
  timePeriod: string;
  tone: string;
  style: string;
  illustrative: boolean;
  sensitiveContext: boolean;
  prompt: string;
  simplifiedPrompt: string;
  alt: string;
  caption: string;
  title: string;
  description: string;
  credit: string;
  license: string;
  disclosure: string;
  validationNotes: string[];
  metadata: Record<string, unknown>;
};

type CategoryStyle = {
  composition: string;
  subjects: string;
  palette: string;
  lens: string;
};

const categoryStyles: Record<string, CategoryStyle> = {
  business: {
    composition:
      "executives, analysts, documents, glass architecture, trading screens without readable text, and purposeful newsroom-grade composition",
    subjects: "workplace, market, supply-chain or leadership visuals inferred from the story",
    palette: "clean neutrals, deep blues, warm highlights",
    lens: "35mm editorial perspective with subtle depth of field"
  },
  politics: {
    composition:
      "symbolic civic imagery, podium shapes without logos, government architecture, ballot or policy objects, and restrained institutional framing",
    subjects: "civic process, public institutions, policy documents or voter context",
    palette: "muted navy, stone, white, and natural daylight",
    lens: "documentary-inspired wide-angle perspective, clearly staged when needed"
  },
  technology: {
    composition:
      "modern devices, data infrastructure, clean desks, engineers, abstract signal patterns without text, and precise geometric framing",
    subjects: "software, hardware, AI systems, cybersecurity or product context",
    palette: "cool teal, graphite, soft white, controlled reflections",
    lens: "crisp editorial product-news perspective"
  },
  science: {
    composition:
      "research labs, instruments, samples, field research or scientific environments with careful, credible detail",
    subjects: "research process, scientific equipment, experiments or discovery context",
    palette: "cool whites, laboratory blues, restrained accent color",
    lens: "macro-to-medium editorial perspective"
  },
  health: {
    composition:
      "clinical environments, medical professionals, patient-care objects, public-health context and humane, non-alarmist framing",
    subjects: "healthcare, research, wellness, hospital systems or prevention context",
    palette: "natural whites, calm teal, soft skin tones",
    lens: "empathetic editorial healthcare perspective"
  },
  finance: {
    composition:
      "market data ambience without readable numbers, financial district architecture, payment cards, ledgers, offices and consumer-money context",
    subjects: "markets, banking, inflation, personal finance or business performance",
    palette: "charcoal, teal, warm brass, natural office light",
    lens: "high-contrast magazine financial-news perspective"
  },
  climate: {
    composition:
      "weather, energy infrastructure, landscapes, coastlines, wildfire smoke or climate-resilience details represented symbolically when news is ongoing",
    subjects: "environment, severe weather, energy transition or resilience context",
    palette: "earth tones, dramatic sky, natural high dynamic range",
    lens: "wide editorial environmental perspective"
  },
  education: {
    composition:
      "classrooms, campuses, notebooks, laptops, students and educators in thoughtful, privacy-safe compositions",
    subjects: "learning, campuses, policy, student life or education technology",
    palette: "warm daylight, slate, soft teal accents",
    lens: "human-centered editorial perspective"
  },
  sports: {
    composition:
      "stadium energy, athletic motion, equipment, fans as indistinct background, dramatic but believable action framing",
    subjects: "athlete, match, training, arena, scoreboard ambience without readable text",
    palette: "natural stadium lights, high contrast, team-color atmosphere without logos",
    lens: "fast shutter sports-photo perspective"
  },
  world: {
    composition:
      "symbolic international context, streetscapes, official buildings, maps without readable labels, travel corridors or public spaces",
    subjects: "global affairs, diplomacy, conflict context or society-level change",
    palette: "natural daylight, restrained contrast, realistic urban or landscape tones",
    lens: "wire-service-style editorial perspective, staged if tied to a real event"
  },
  culture: {
    composition:
      "performers, audiences, creative workspaces, venues, fashion or media objects without brand logos",
    subjects: "arts, entertainment, media, style or cultural moments",
    palette: "cinematic natural color, warm highlights, polished shadows",
    lens: "magazine culture-news perspective"
  },
  lifestyle: {
    composition:
      "homes, restaurants, wellness settings, consumer objects, people in natural everyday moments",
    subjects: "daily life, food, family, wellness, home or consumer trends",
    palette: "warm, bright, natural, premium editorial finish",
    lens: "lifestyle magazine perspective"
  },
  travel: {
    composition:
      "landscapes, transit, hotels, city details, travelers from behind or as silhouettes, no identifiable private people",
    subjects: "destination, airport, hotel, landmark ambience or travel planning context",
    palette: "natural golden hour or clean daylight",
    lens: "wide premium travel-news perspective"
  },
  editorial: {
    composition:
      "source-first newsroom objects, public-context details, people as non-identifiable silhouettes, and a clean international news composition",
    subjects: "the central topic, setting and objects clearly implied by the story",
    palette: "neutral, teal, natural light, high dynamic range",
    lens: "professional editorial perspective"
  }
};

const sensitiveTerms = [
  "accident",
  "attack",
  "bombing",
  "campaign",
  "court",
  "crime",
  "dead",
  "death",
  "disaster",
  "election",
  "explosion",
  "fire",
  "flood",
  "gaza",
  "injured",
  "killed",
  "lawsuit",
  "police",
  "president",
  "protest",
  "shooting",
  "storm",
  "trial",
  "war",
  "wildfire"
];

const countryTerms = [
  "United States",
  "U.S.",
  "US",
  "America",
  "United Kingdom",
  "Canada",
  "Mexico",
  "China",
  "India",
  "Japan",
  "Russia",
  "Ukraine",
  "Israel",
  "France",
  "Germany",
  "Spain",
  "Italy",
  "Brazil",
  "Australia"
];

const locationTerms = [
  "New York",
  "Washington",
  "Los Angeles",
  "Chicago",
  "Miami",
  "San Francisco",
  "London",
  "Paris",
  "Berlin",
  "Tokyo",
  "Beijing",
  "Moscow",
  "Kyiv",
  "Tel Aviv",
  "Brussels",
  "Madrid",
  "Rome"
];

function normalizeCategory(value?: string | null) {
  const lower = (value || "Editorial").toLowerCase();
  if (lower.includes("business")) return "Business";
  if (lower.includes("politic") || lower.includes("government")) return "Politics";
  if (lower.includes("tech") || lower.includes("ai")) return "Technology";
  if (lower.includes("science")) return "Science";
  if (lower.includes("health") || lower.includes("medical")) return "Health";
  if (lower.includes("finance") || lower.includes("money") || lower.includes("market")) return "Finance";
  if (lower.includes("climate") || lower.includes("environment")) return "Climate";
  if (lower.includes("education") || lower.includes("school")) return "Education";
  if (lower.includes("sport")) return "Sports";
  if (lower.includes("world") || lower.includes("global") || lower.includes("international")) return "World";
  if (lower.includes("culture") || lower.includes("entertainment")) return "Culture";
  if (lower.includes("life") || lower.includes("food")) return "Lifestyle";
  if (lower.includes("travel")) return "Travel";
  return "Editorial";
}

function categoryKey(category: string) {
  return category.toLowerCase() as keyof typeof categoryStyles;
}

function compactText(value: string, max = 1100) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function keywordList(value: EditorialImagePromptInput["keywords"], text: string) {
  const explicit =
    typeof value === "string"
      ? parseStringArray(value).length
        ? parseStringArray(value)
        : value.split(/[,;\n]/)
      : value || [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4 && !["about", "after", "before", "their", "there", "which", "while", "would", "could", "should", "according", "available", "reports"].includes(word));
  return Array.from(new Set([...explicit, ...words].map((item) => item.trim()).filter(Boolean))).slice(0, 12);
}

function extractEntities(text: string) {
  const matches = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3}|[A-Z]{2,})\b/g) || [];
  const blocked = new Set([
    "The",
    "This",
    "That",
    "What",
    "Why",
    "Background",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday"
  ]);
  return Array.from(new Set(matches.filter((item) => !blocked.has(item)))).slice(0, 10);
}

function detectLocation(text: string) {
  return locationTerms.find((term) => new RegExp(`\\b${term}\\b`, "i").test(text)) || null;
}

function detectCountry(inputCountry: string | null | undefined, text: string) {
  if (inputCountry?.trim()) return inputCountry.trim();
  const country = countryTerms.find((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
  if (!country) return "United States";
  if (country === "U.S." || country === "US" || country === "America") return "United States";
  return country;
}

function detectTimePeriod(text: string) {
  const explicitDate = text.match(/\b(?:Jan\.?|January|Feb\.?|February|Mar\.?|March|Apr\.?|April|May|Jun\.?|June|Jul\.?|July|Aug\.?|August|Sep\.?|September|Oct\.?|October|Nov\.?|November|Dec\.?|December)\s+\d{1,2},?\s+\d{4}\b/i);
  if (explicitDate) return explicitDate[0];
  const year = text.match(/\b20\d{2}\b/);
  if (year) return year[0];
  if (/\b(today|tonight|this week|breaking|latest|developing)\b/i.test(text)) {
    return "current news cycle";
  }
  return "contemporary";
}

function detectTone(inputTone: string | null | undefined, text: string) {
  if (inputTone?.trim()) return inputTone.trim();
  if (/\b(dead|killed|injured|war|attack|disaster|crisis|shooting)\b/i.test(text)) {
    return "sober and restrained";
  }
  if (/\blaunch|growth|record|win|breakthrough|recovery|celebrate\b/i.test(text)) {
    return "energetic but credible";
  }
  if (/\bmarket|policy|analysis|data|forecast|earnings\b/i.test(text)) {
    return "analytical and composed";
  }
  return "clear, serious and modern";
}

function isSensitive(category: string, text: string) {
  if (["Politics", "World"].includes(category)) return true;
  return sensitiveTerms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(text));
}

function topicFrom(headline: string, summary: string) {
  const clean = headline.replace(/[“”"']/g, "").trim();
  if (clean.length > 12) return clean.slice(0, 140);
  return compactText(summary, 140) || "Daily Signal Wire editorial news story";
}

export function buildEditorialImagePlan(input: EditorialImagePromptInput): EditorialImagePlan {
  const storyText = compactText(
    [
      input.headline,
      input.subtitle,
      input.summary,
      input.excerpt,
      input.content
    ]
      .filter(Boolean)
      .join("\n"),
    2200
  );
  const category = normalizeCategory(input.category);
  const style = categoryStyles[categoryKey(category)] || categoryStyles.editorial;
  const topic = topicFrom(input.headline, storyText);
  const keywords = keywordList(input.keywords, storyText);
  const entities = extractEntities(storyText);
  const location = detectLocation(storyText);
  const country = detectCountry(input.country, storyText);
  const timePeriod = detectTimePeriod(storyText);
  const tone = detectTone(input.tone, storyText);
  const sensitiveContext = isSensitive(category, storyText);
  const illustrative = sensitiveContext;
  const basePrompt = input.basePrompt?.trim();
  const safetyMode = sensitiveContext
    ? "Use a clearly illustrative, staged, symbolic editorial scene. Do not depict a fabricated real event, casualty, crime scene, battlefield, election scene, public figure likeness, eyewitness photo, mugshot, press conference, or evidence image."
    : "Use a realistic premium editorial photograph aesthetic appropriate for a modern digital news feature.";
  const visualMode = illustrative
    ? "photorealistic editorial illustration with symbolic objects and non-identifiable people"
    : "realistic editorial photography";

  const prompt = `${basePrompt ? `${basePrompt}\n\n` : ""}Create one premium ${visualMode} for Daily Signal Wire.

Story analysis:
- Topic: ${topic}
- Category: ${category}
- Keywords: ${keywords.join(", ") || "source-first news, context, analysis"}
- Entities: ${entities.join(", ") || "none clearly identified"}
- Location: ${location || country}
- Country context: ${country}
- Time period: ${timePeriod}
- Tone: ${tone}

Category composition:
- Composition: ${style.composition}
- Subjects: ${style.subjects}
- Palette: ${style.palette}
- Lens: ${style.lens}

Editorial direction:
${safetyMode}
The image must feel like a premium international digital newsroom visual: editorial composition, natural lighting, realistic perspective, high dynamic range, sharp focus, high detail, natural color grading, magazine-quality finish, landscape 16:9.

Hard visual constraints:
No text, no readable letters or numbers, no watermark, no logo, no frame, no border, no collage, no distorted hands, no artificial artifacts, no fake screenshot, no brand marks.`;

  const simplifiedPrompt = `Premium ${visualMode} about ${topic}. Category: ${category}. ${safetyMode} Natural lighting, professional editorial composition, high detail, natural color grading, landscape 16:9, no text, no watermark, no logo, no frame.`;
  const alt = `${category} editorial image for “${input.headline}”`;
  const caption = illustrative
    ? "AI-generated editorial illustration. It is not a documentary photograph of a real event."
    : "AI-generated editorial image.";
  const description = `${category} editorial visual about ${topic}.`;
  const validationNotes = [
    "Landscape 16:9 editorial composition required.",
    "No readable text, watermark, logo, border, frame or collage.",
    illustrative
      ? "Sensitive real-world context detected; image must be illustrative and not presented as documentary evidence."
      : "Realistic editorial photography aesthetic allowed for this category."
  ];

  return {
    topic,
    category,
    keywords,
    entities,
    location,
    country,
    timePeriod,
    tone,
    style: `${style.composition}; ${style.palette}; ${style.lens}`,
    illustrative,
    sensitiveContext,
    prompt,
    simplifiedPrompt,
    alt,
    caption,
    title: `${category} editorial image: ${input.headline}`.slice(0, 180),
    description,
    credit: "Daily Signal Wire / AI image generation",
    license: "AI-generated editorial image.",
    disclosure: caption,
    validationNotes,
    metadata: {
      topic,
      category,
      keywords,
      entities,
      location,
      country,
      timePeriod,
      tone,
      sensitiveContext,
      illustrative,
      style
    }
  };
}
