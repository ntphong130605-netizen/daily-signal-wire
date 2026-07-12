import { placeholderImageForCategory } from "@/lib/editorialImages";
import { slugify } from "@/lib/slug";

export type NewsroomCategory = {
  name: string;
  slug: string;
  description: string;
  keywords: string[];
  accent: string;
  image: string;
  related: string[];
};

export const newsroomCategories: NewsroomCategory[] = [
  {
    name: "Technology",
    slug: "technology",
    description:
      "Technology coverage on AI, platforms, cybersecurity, devices and the companies shaping digital life.",
    keywords: ["AI", "Apple", "Google", "Microsoft", "OpenAI", "NVIDIA", "Robotics", "Cybersecurity", "Cloud"],
    accent: "#22a6b3",
    image: placeholderImageForCategory("Technology"),
    related: ["ai", "business", "science"]
  },
  {
    name: "Business",
    slug: "business",
    description:
      "Business news on companies, markets, money, leadership and economic signals worth watching.",
    keywords: ["Markets", "Startups", "Wall Street", "Earnings", "Jobs", "Retail", "Inflation", "Leadership"],
    accent: "#0f766e",
    image: placeholderImageForCategory("Business"),
    related: ["technology", "politics", "climate"]
  },
  {
    name: "Politics",
    slug: "politics",
    description:
      "Politics coverage with context on elections, policy, institutions and public accountability.",
    keywords: ["Elections", "White House", "Congress", "Policy", "Courts", "Campaigns", "Polling"],
    accent: "#315f9f",
    image: placeholderImageForCategory("US News"),
    related: ["world", "business", "climate"]
  },
  {
    name: "World",
    slug: "world",
    description:
      "International news and global developments with source-first context and careful attribution.",
    keywords: ["Europe", "Asia", "Middle East", "Diplomacy", "Security", "Global Economy", "Humanitarian"],
    accent: "#2563eb",
    image: placeholderImageForCategory("World"),
    related: ["politics", "climate", "business"]
  },
  {
    name: "Science",
    slug: "science",
    description:
      "Science reporting on space, research, climate data, health studies and the evidence behind discoveries.",
    keywords: ["Space", "Research", "NASA", "Physics", "Biology", "Climate Data", "Universities"],
    accent: "#7c3aed",
    image: placeholderImageForCategory("Science"),
    related: ["health", "climate", "technology"]
  },
  {
    name: "Health",
    slug: "health",
    description:
      "Health coverage on medicine, public health, wellness, policy and research with careful caveats.",
    keywords: ["Public Health", "Medicine", "FDA", "Nutrition", "Mental Health", "Hospitals", "Research"],
    accent: "#16a34a",
    image: placeholderImageForCategory("Health"),
    related: ["science", "lifestyle", "politics"]
  },
  {
    name: "Sports",
    slug: "sports",
    description:
      "Sports coverage across major leagues, athletes, competitions, business and culture.",
    keywords: ["NFL", "NBA", "MLB", "Soccer", "Tennis", "Olympics", "College Sports", "Transfers"],
    accent: "#ea580c",
    image: placeholderImageForCategory("Sports"),
    related: ["entertainment", "business", "lifestyle"]
  },
  {
    name: "Entertainment",
    slug: "entertainment",
    description:
      "Entertainment news on film, music, streaming, creators, culture and the media business.",
    keywords: ["Movies", "Streaming", "Music", "Hollywood", "TV", "Creators", "Awards", "Box Office"],
    accent: "#db2777",
    image: placeholderImageForCategory("Entertainment"),
    related: ["lifestyle", "sports", "business"]
  },
  {
    name: "Travel",
    slug: "travel",
    description:
      "Travel coverage on destinations, airlines, hospitality, disruptions and practical context for readers.",
    keywords: ["Airlines", "Hotels", "Destinations", "Cruises", "National Parks", "Passports", "Travel Deals"],
    accent: "#0891b2",
    image: placeholderImageForCategory("Travel"),
    related: ["lifestyle", "business", "climate"]
  },
  {
    name: "Lifestyle",
    slug: "lifestyle",
    description:
      "Lifestyle coverage on food, home, relationships, wellness, travel and culture with useful context.",
    keywords: ["Food", "Wellness", "Home", "Relationships", "Style", "Travel", "Culture", "Personal Finance"],
    accent: "#ca8a04",
    image: placeholderImageForCategory("Lifestyle"),
    related: ["travel", "health", "entertainment"]
  },
  {
    name: "Climate",
    slug: "climate",
    description:
      "Climate coverage on extreme weather, energy, policy, science and adaptation.",
    keywords: ["Extreme Weather", "Energy", "Emissions", "Wildfires", "Hurricanes", "Adaptation", "Climate Policy"],
    accent: "#059669",
    image: placeholderImageForCategory("Climate"),
    related: ["science", "world", "business"]
  },
  {
    name: "AI",
    slug: "ai",
    description:
      "AI coverage on models, products, policy, safety, chips, automation and the changing technology economy.",
    keywords: ["OpenAI", "ChatGPT", "Google Gemini", "Claude", "NVIDIA", "AI Safety", "Automation", "Agents"],
    accent: "#6d5dfc",
    image: placeholderImageForCategory("AI"),
    related: ["technology", "business", "science"]
  }
];

export function titleFromCategorySlug(slug: string) {
  const category = getCategoryMeta(slug);
  if (category) return category.name;
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) =>
      word.toLowerCase() === "ai"
        ? "AI"
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

export function getCategoryMeta(slugOrName: string) {
  const normalized = slugify(slugOrName);
  return newsroomCategories.find(
    (category) => category.slug === normalized || slugify(category.name) === normalized
  );
}

export function matchesCategorySlug({
  slug,
  categoryName,
  categorySlug,
  trendCategory,
  tags = []
}: {
  slug: string;
  categoryName?: string | null;
  categorySlug?: string | null;
  trendCategory?: string | null;
  tags?: string[];
}) {
  const normalized = slugify(slug);
  const meta = getCategoryMeta(normalized);
  const candidates = [
    categorySlug,
    categoryName,
    trendCategory,
    ...(meta ? [meta.name, ...meta.keywords] : []),
    ...tags
  ]
    .filter(Boolean)
    .map((value) => slugify(String(value)));

  if (candidates.includes(normalized)) return true;

  if (normalized === "business") {
    return candidates.some((value) => ["money", "markets", "finance"].includes(value));
  }
  if (normalized === "technology") {
    return candidates.some((value) => ["tech", "ai", "artificial-intelligence"].includes(value));
  }
  if (normalized === "politics") {
    return candidates.some((value) => ["us-news", "election", "elections", "policy"].includes(value));
  }
  if (normalized === "world") {
    return candidates.some((value) => ["global", "international", "foreign-policy"].includes(value));
  }
  if (normalized === "climate") {
    return candidates.some((value) => ["environment", "weather", "energy"].includes(value));
  }
  if (normalized === "ai") {
    return candidates.some((value) =>
      ["technology", "tech", "openai", "chatgpt", "artificial-intelligence"].includes(value)
    );
  }

  return false;
}

