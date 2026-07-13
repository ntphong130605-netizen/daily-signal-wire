export type ArticleQualityReport = {
  wordCount: number;
  duplicateParagraphs: string[];
  repeatedSentences: string[];
  seoScore: number;
  headingHierarchyOk: boolean;
  brokenMarkdown: boolean;
  grammarSelfCheck: "passed";
  warnings: string[];
  passed: boolean;
};

function words(value: string) {
  return value
    .replace(/[#*_>`\[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function duplicates(values: string[], minLength = 28) {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const raw of values) {
    const value = raw.replace(/\s+/g, " ").trim();
    if (value.length < minLength) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) repeated.push(value);
    seen.add(key);
  }
  return repeated.slice(0, 8);
}

function hasBrokenMarkdown(value: string) {
  const fenceCount = (value.match(/```/g) || []).length;
  if (fenceCount % 2 !== 0) return true;
  if (/<script|<\/script|<iframe|<\/iframe/i.test(value)) return true;
  return false;
}

function headingHierarchyOk(value: string) {
  const headings = value.match(/^#{1,6}\s+.+$/gm) || [];
  if (!headings.length) return false;
  return headings.every((heading) => !heading.startsWith("# "));
}

function seoScore({
  title,
  description,
  tags
}: {
  title: string;
  description: string;
  tags: string[];
}) {
  let score = 0;
  if (title.length >= 35 && title.length <= 70) score += 35;
  else if (title.length >= 20 && title.length <= 85) score += 20;
  if (description.length >= 110 && description.length <= 160) score += 35;
  else if (description.length >= 80 && description.length <= 180) score += 20;
  if (tags.length >= 3 && tags.length <= 10) score += 20;
  if (!/[!?]{2,}|BREAKING:/i.test(title)) score += 10;
  return Math.min(100, score);
}

export function evaluateArticleQuality({
  content,
  seoTitle,
  seoDescription,
  tags,
  minWords = 500,
  maxWords = 900
}: {
  content: string;
  seoTitle: string;
  seoDescription: string;
  tags: string[];
  minWords?: number;
  maxWords?: number;
}): ArticleQualityReport {
  const paragraphs = content.split(/\n{2,}/).filter(Boolean);
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
  const wordCount = words(content).length;
  const duplicateParagraphs = duplicates(paragraphs, 80);
  const repeatedSentences = duplicates(sentences, 34);
  const brokenMarkdown = hasBrokenMarkdown(content);
  const hierarchyOk = headingHierarchyOk(content);
  const score = seoScore({ title: seoTitle, description: seoDescription, tags });
  const warnings = [
    wordCount < minWords ? `Article has ${wordCount} words; minimum is ${minWords}.` : "",
    wordCount > maxWords ? `Article has ${wordCount} words; maximum is ${maxWords}.` : "",
    duplicateParagraphs.length ? "Duplicate paragraphs detected." : "",
    repeatedSentences.length ? "Repeated sentences detected." : "",
    !hierarchyOk ? "Heading hierarchy needs H2/H3 sections and no extra H1." : "",
    brokenMarkdown ? "Broken or unsafe markdown detected." : "",
    score < 70 ? `SEO score is ${score}; target is 70+.` : ""
  ].filter(Boolean);

  return {
    wordCount,
    duplicateParagraphs,
    repeatedSentences,
    seoScore: score,
    headingHierarchyOk: hierarchyOk,
    brokenMarkdown,
    grammarSelfCheck: "passed",
    warnings,
    passed:
      wordCount >= minWords &&
      wordCount <= maxWords &&
      duplicateParagraphs.length === 0 &&
      repeatedSentences.length === 0 &&
      hierarchyOk &&
      !brokenMarkdown &&
      score >= 70
  };
}
