import { parseJsonArray, parseStringArray } from "@/lib/json";

type PublishablePost = {
  title: string;
  subtitle?: string | null;
  excerpt: string;
  summary?: string | null;
  content: string;
  seoTitle: string;
  seoDescription: string;
  openGraphDescription?: string | null;
  imageStatus: string;
  imageUrl?: string | null;
  featuredImage?: string | null;
  featuredImageUrl?: string | null;
  imageAlt?: string | null;
  imageSourceType?: string | null;
  imageDisclosure?: string | null;
  factCheckNotes: string;
  sourceUrls: string;
  category?: { name?: string | null } | null;
  trend?: { category?: string | null } | null;
  tags?: string | null;
  faq?: string | null;
};

function wordCount(content: string) {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

export function validatePostForPublishing(
  post: PublishablePost,
  confirmedFactCheck: boolean
) {
  const sources = parseStringArray(post.sourceUrls);
  const notes = parseStringArray(post.factCheckNotes);
  const tags = parseStringArray(post.tags);
  const faq = parseJsonArray<{ question: string; answer: string }>(post.faq);

  if (!confirmedFactCheck) return "Fact-check confirmation is required.";
  if (sources.length === 0 || notes.length === 0) {
    return "Sources and fact-check notes are required.";
  }
  if (!post.title.trim() || !post.excerpt.trim() || !post.content.trim()) {
    return "Title, excerpt and article content are required before publishing.";
  }
  if (!post.subtitle?.trim()) return "Subtitle is required before publishing.";
  if (!post.summary?.trim()) return "Summary is required before publishing.";
  if (!post.seoTitle.trim() || !post.seoDescription.trim()) {
    return "SEO title and meta description are required.";
  }
  if (!post.openGraphDescription?.trim()) {
    return "OpenGraph description is required before publishing.";
  }
  const hasCategory =
    Boolean(post.category?.name?.trim()) || Boolean(post.trend?.category?.trim());
  if (!hasCategory) return "A category is required before publishing.";

  const placeholderPattern =
    /\b(lorem ipsum|placeholder|sample draft|demonstration draft|todo)\b/i;
  if (
    placeholderPattern.test(
      `${post.title}\n${post.subtitle || ""}\n${post.excerpt}\n${post.summary || ""}\n${post.content}\n${post.seoTitle}\n${post.seoDescription}`
    )
  ) {
    return "Placeholder text must be removed before publishing.";
  }

  const words = wordCount(post.content);
  if (words < 500 || words > 900) {
    return "AI news articles must be between 500 and 900 words before publishing.";
  }
  if (tags.length < 3) return "At least three tags are required before publishing.";
  if (faq.length < 3) return "At least three FAQ entries are required before publishing.";
  if (
    !post.imageStatus ||
    post.imageStatus !== "accepted" ||
    (!post.imageUrl && !post.featuredImage && !post.featuredImageUrl)
  ) {
    return "Accept an editorial image before publishing this draft.";
  }
  if (!post.imageAlt?.trim()) return "Image alt text is required before publishing.";
  if (post.imageSourceType === "ai" && !post.imageDisclosure?.trim()) {
    return "AI image disclosure is required before publishing.";
  }

  return null;
}
