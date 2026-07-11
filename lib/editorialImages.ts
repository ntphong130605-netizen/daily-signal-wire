export function placeholderImageForCategory(category?: string | null) {
  const value = (category || "").toLowerCase();
  if (value.includes("sport")) return "/editorial/ai/sports.jpg";
  if (value.includes("money") || value.includes("business")) {
    return "/editorial/ai/business.jpg";
  }
  if (value.includes("tech") || value.includes("ai")) {
    return "/editorial/ai/responsible-ai.jpg";
  }
  if (value.includes("entertain") || value.includes("culture")) {
    return "/editorial/ai/culture.jpg";
  }
  if (value.includes("science")) return "/editorial/ai/responsible-ai.jpg";
  if (value.includes("world") || value.includes("us news")) {
    return "/editorial/ai/fact-check.jpg";
  }
  return "/editorial/ai/newsroom.jpg";
}

const legacyEditorialImageMap: Record<string, string> = {
  "/editorial/source-first-newsroom.svg": "/editorial/ai/newsroom.jpg",
  "/editorial/trend-signals.svg": "/editorial/ai/trends.jpg",
  "/editorial/fact-check-desk.svg": "/editorial/ai/fact-check.jpg",
  "/editorial/news-workflow.svg": "/editorial/ai/newsroom.jpg",
  "/editorial/responsible-ai.svg": "/editorial/ai/responsible-ai.jpg",
  "/editorial/money-context.svg": "/editorial/ai/business.jpg",
  "/editorial/sports-desk.svg": "/editorial/ai/sports.jpg",
  "/editorial/culture-wire.svg": "/editorial/ai/culture.jpg",
  "/editorial/science-context.svg": "/editorial/ai/responsible-ai.jpg",
  "/editorial/developing-story.svg": "/editorial/ai/fact-check.jpg"
};

export function normalizeEditorialImageUrl(
  imageUrl?: string | null,
  category?: string | null
) {
  if (!imageUrl) return placeholderImageForCategory(category);
  return legacyEditorialImageMap[imageUrl] || imageUrl;
}
