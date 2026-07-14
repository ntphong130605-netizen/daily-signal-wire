import { absoluteUrl, siteDescription, siteName } from "@/lib/site";

export type NewsroomAuthor = {
  name: string;
  slug: string;
  initials: string;
  role: string;
  bio: string;
  expertise: string[];
};

export const newsroomAuthors: NewsroomAuthor[] = [
  {
    name: "Daily Signal Wire Desk",
    slug: "daily-signal-wire-desk",
    initials: "DS",
    role: "News desk",
    bio:
      "Daily Signal Wire Desk prepares source-first coverage from public signals, RSS feeds and verified references with human editorial review before publication.",
    expertise: ["Source review", "AI-assisted newsroom workflows", "US trends", "Reader context"]
  },
  {
    name: "Editorial Standards Desk",
    slug: "editorial-standards-desk",
    initials: "ES",
    role: "Editorial standards",
    bio:
      "The Editorial Standards Desk maintains corrections, AI transparency, source review and image-disclosure guardrails for Daily Signal Wire.",
    expertise: ["Corrections", "Fact-checking", "AI transparency", "Publishing policy"]
  }
];

export const newsroomPolicies = {
  about: absoluteUrl("/about"),
  contact: absoluteUrl("/contact"),
  editorial: absoluteUrl("/editorial-policy"),
  corrections: absoluteUrl("/corrections-policy"),
  factCheck: absoluteUrl("/fact-check-policy"),
  aiTransparency: absoluteUrl("/ai-transparency"),
  privacy: absoluteUrl("/privacy-policy"),
  terms: absoluteUrl("/terms"),
  cookies: absoluteUrl("/cookie-policy"),
  team: absoluteUrl("/editorial-team")
};

export function authorByName(name: string | null | undefined) {
  const normalized = (name || "").trim().toLowerCase();
  return (
    newsroomAuthors.find((author) => author.name.toLowerCase() === normalized) ||
    newsroomAuthors[0]
  );
}

export function authorBySlug(slug: string | null | undefined) {
  return newsroomAuthors.find((author) => author.slug === slug);
}

export function authorUrl(author: NewsroomAuthor) {
  return absoluteUrl(`/authors/${author.slug}`);
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": absoluteUrl("/#organization"),
    name: siteName,
    url: absoluteUrl("/"),
    description: siteDescription(),
    logo: {
      "@type": "ImageObject",
      "@id": absoluteUrl("/#publisher-logo"),
      url: absoluteUrl("/icon.svg"),
      width: 512,
      height: 512
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "newsroom",
      url: newsroomPolicies.contact,
      availableLanguage: ["English"]
    },
    publishingPrinciples: newsroomPolicies.editorial,
    correctionsPolicy: newsroomPolicies.corrections,
    ethicsPolicy: newsroomPolicies.editorial,
    diversityPolicy: newsroomPolicies.editorial,
    ownershipFundingInfo: newsroomPolicies.about,
    sameAs: []
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: siteName,
    url: absoluteUrl("/"),
    description: siteDescription(),
    publisher: { "@id": absoluteUrl("/#organization") },
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl("/search")}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

export function personJsonLd(author: NewsroomAuthor) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${authorUrl(author)}#person`,
    name: author.name,
    url: authorUrl(author),
    jobTitle: author.role,
    description: author.bio,
    knowsAbout: author.expertise,
    affiliation: { "@id": absoluteUrl("/#organization") },
    worksFor: { "@id": absoluteUrl("/#organization") }
  };
}
