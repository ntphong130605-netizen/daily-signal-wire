import { slugify } from "@/lib/slug";

export function stripMarkdown(value: string | null | undefined) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+]\([^)]*\)/g, (match) => match.replace(/^\[|\]\([^)]*\)$/g, ""))
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_`~|>#-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactSeoText(value: string | null | undefined, maxLength = 180) {
  const text = stripMarkdown(value);
  if (text.length <= maxLength) return text;
  const trimmed = text.slice(0, maxLength - 1).trim();
  const sentenceEnd = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf("!"), trimmed.lastIndexOf("?"));
  return `${(sentenceEnd > 80 ? trimmed.slice(0, sentenceEnd + 1) : trimmed).trim()}…`;
}

function sentenceCandidates(value: string | null | undefined) {
  return stripMarkdown(value)
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 55 && item.length <= 240)
    .filter((item) => !/^faq\b|^source urls?\b|^fact-check notes?\b/i.test(item));
}

export function buildKeyTakeaways({
  title,
  subtitle,
  summary,
  excerpt,
  content
}: {
  title: string;
  subtitle?: string | null;
  summary?: string | null;
  excerpt?: string | null;
  content: string;
}) {
  const candidates = [
    ...sentenceCandidates(summary),
    ...sentenceCandidates(excerpt),
    ...sentenceCandidates(subtitle),
    ...sentenceCandidates(content)
  ];
  const seen = new Set<string>();
  const takeaways = candidates
    .filter((item) => {
      const key = slugify(item).slice(0, 80);
      if (!key || seen.has(key) || item.toLowerCase() === title.toLowerCase()) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4);

  if (takeaways.length) return takeaways;
  const fallback = compactSeoText(summary || excerpt || content, 180);
  return fallback && fallback.toLowerCase() !== title.toLowerCase() ? [fallback] : [];
}

export function extractFirstVideoUrl(values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(" ");
  const match = text.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|vimeo\.com\/)[^\s)"'<]+/i);
  return match?.[0] || null;
}

export function videoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/\//g, "");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (parsed.hostname.includes("vimeo.com")) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
  } catch {
    return url;
  }
  return url;
}
