export type AdPosition = "top" | "in-article" | "middle" | "sidebar" | "bottom" | "feed";

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
    top: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP,
    "in-article":
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE,
    middle:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE,
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR,
    bottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM,
    feed:
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_IN_ARTICLE ||
      process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE
  };

  return (slots[position] || "").trim();
}

export function hasAdsTxtConfiguration() {
  return Boolean(adsensePublisherId());
}

export function maskPublicId(value: string) {
  if (!value) return "Not configured";
  if (value.length <= 10) return "Configured";
  return `${value.slice(0, 7)}…${value.slice(-4)}`;
}
