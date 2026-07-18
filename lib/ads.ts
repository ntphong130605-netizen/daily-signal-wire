export type AdPosition =
  | "header"
  | "top"
  | "sticky-top"
  | "sticky-bottom"
  | "sidebar"
  | "feed"
  | "in-article"
  | "between-paragraphs"
  | "article-end"
  | "search"
  | "category"
  | "homepage"
  | "middle"
  | "bottom";

export type AdPlacementDefinition = {
  position: AdPosition;
  label: string;
  routeScope: string;
  minHeightDesktop: number;
  minHeightMobile: number;
  lazy: boolean;
  sticky: boolean;
};

export const adPlacementDefinitions: AdPlacementDefinition[] = [
  { position: "header", label: "Header Ad", routeScope: "all", minHeightDesktop: 120, minHeightMobile: 100, lazy: false, sticky: false },
  { position: "sticky-top", label: "Sticky Top", routeScope: "all", minHeightDesktop: 100, minHeightMobile: 90, lazy: false, sticky: true },
  { position: "sticky-bottom", label: "Sticky Bottom", routeScope: "all", minHeightDesktop: 100, minHeightMobile: 90, lazy: true, sticky: true },
  { position: "sidebar", label: "Sidebar", routeScope: "article,category,homepage", minHeightDesktop: 600, minHeightMobile: 250, lazy: true, sticky: false },
  { position: "feed", label: "In-feed", routeScope: "homepage,category", minHeightDesktop: 280, minHeightMobile: 250, lazy: true, sticky: false },
  { position: "in-article", label: "In-article", routeScope: "article", minHeightDesktop: 280, minHeightMobile: 250, lazy: true, sticky: false },
  { position: "between-paragraphs", label: "Between paragraphs", routeScope: "article", minHeightDesktop: 280, minHeightMobile: 250, lazy: true, sticky: false },
  { position: "article-end", label: "Article End", routeScope: "article", minHeightDesktop: 280, minHeightMobile: 250, lazy: true, sticky: false },
  { position: "search", label: "Search Page", routeScope: "search", minHeightDesktop: 280, minHeightMobile: 250, lazy: true, sticky: false },
  { position: "category", label: "Category Page", routeScope: "category", minHeightDesktop: 280, minHeightMobile: 250, lazy: true, sticky: false },
  { position: "homepage", label: "Homepage", routeScope: "homepage", minHeightDesktop: 280, minHeightMobile: 250, lazy: true, sticky: false }
];

export function adsenseClientId() {
  return (
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT ||
    ""
  ).trim();
}

export function adsensePublisherId() {
  const explicit = process.env.ADSENSE_PUBLISHER_ID?.trim();
  if (explicit) return explicit.replace(/^ca-/, "");

  const client = adsenseClientId();
  return client ? client.replace(/^ca-/, "") : "";
}

export function adsenseSlotFor(position: AdPosition) {
  const slots: Record<AdPosition, string | undefined> = {
    header:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP,
    top:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER,
    "sticky-top":
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_STICKY_TOP ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP,
    "sticky-bottom":
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_STICKY_BOTTOM ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM,
    "in-article":
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE,
    "between-paragraphs":
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_BETWEEN_PARAGRAPHS ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE,
    "article-end":
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_END ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM,
    middle:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE,
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
    bottom:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FOOTER,
    feed:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE,
    search:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_SEARCH ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE,
    category:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_CATEGORY ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE,
    homepage:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOMEPAGE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP
  };

  return (slots[position] || "").trim();
}

export function adsenseAutoAdsEnabled() {
  return ["1", "true", "yes", "on"].includes(
    (process.env.NEXT_PUBLIC_ADSENSE_AUTO_ADS || "").trim().toLowerCase()
  );
}

export function adPlacementFor(position: AdPosition) {
  const normalized =
    position === "top"
      ? "header"
      : position === "middle"
        ? "in-article"
        : position === "bottom"
          ? "article-end"
          : position;
  return (
    adPlacementDefinitions.find((placement) => placement.position === normalized) ||
    adPlacementDefinitions.find((placement) => placement.position === "in-article")!
  );
}

export function hasAdsTxtConfiguration() {
  return Boolean(adsensePublisherId());
}

export function maskPublicId(value: string) {
  if (!value) return "Not configured";
  if (value.length <= 10) return "Configured";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
