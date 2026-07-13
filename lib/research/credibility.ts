import type { SourceCredibilityTier } from "@/lib/research/types";

const TIER_A_DOMAINS = [
  ".gov",
  ".edu",
  "cdc.gov",
  "nih.gov",
  "fda.gov",
  "sec.gov",
  "nasa.gov",
  "noaa.gov",
  "whitehouse.gov",
  "senate.gov",
  "house.gov",
  "supremecourt.gov",
  "who.int",
  "un.org"
];

const TIER_B_DOMAINS = [
  "apnews.com",
  "reuters.com",
  "bbc.com",
  "bbc.co.uk",
  "npr.org",
  "pbs.org",
  "nytimes.com",
  "washingtonpost.com",
  "wsj.com",
  "bloomberg.com",
  "cnbc.com",
  "cnn.com",
  "abcnews.go.com",
  "nbcnews.com",
  "cbsnews.com",
  "theguardian.com",
  "espn.com",
  "theverge.com",
  "wired.com",
  "scientificamerican.com",
  "nature.com",
  "sciencedaily.com"
];

function hostname(value: string) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return value.toLowerCase();
  }
}

export function assessCredibility(sourceUrl: string, publisher?: string): SourceCredibilityTier {
  const host = hostname(sourceUrl);
  const name = String(publisher || "").toLowerCase();
  if (TIER_A_DOMAINS.some((domain) => host.endsWith(domain) || host === domain.replace(/^\./, ""))) {
    return "A";
  }
  if (
    TIER_B_DOMAINS.some((domain) => host.endsWith(domain)) ||
    /\b(ap|associated press|reuters|bbc|npr|pbs|bloomberg|cnbc|espn)\b/i.test(name)
  ) {
    return "B";
  }
  return "C";
}

export function credibilityScore(tier: SourceCredibilityTier) {
  if (tier === "A") return 100;
  if (tier === "B") return 78;
  return 48;
}
