export function sanitizeQueryParam(value: string | null | undefined, maxLength = 120) {
  return String(value || "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function publicCache(seconds: number, staleSeconds = seconds * 4) {
  return `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${staleSeconds}`;
}
