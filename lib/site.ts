export const siteName = "Daily Signal Wire";

export function siteUrl() {
  const vercelUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    vercelUrl ||
    "https://daily-signal-wire.vercel.app"
  ).replace(/\/+$/, "");
}

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl()}${normalizedPath}`;
}

export function siteDescription() {
  return "Daily Signal Wire is an AI-assisted newsroom and RSS reader for source-first US news coverage.";
}
