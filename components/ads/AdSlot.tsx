import type { CSSProperties } from "react";
import AdSenseAd from "@/components/ads/AdSenseAd";
import {
  adPlacementFor,
  adsenseClientId,
  adsenseSlotFor,
  type AdPosition
} from "@/lib/ads";
import { prisma, safeDbQuery } from "@/lib/prisma";

export type AdSlotProps = {
  slot?: string;
  format?: string;
  responsive?: boolean;
  className?: string;
  position?: AdPosition;
  lazy?: boolean;
  renderMode?: "web" | "amp";
};

export default async function AdSlot({
  slot,
  format = "auto",
  responsive = true,
  className = "",
  position = "top",
  lazy,
  renderMode = "web"
}: AdSlotProps) {
  const client = adsenseClientId();
  const placement = adPlacementFor(position);
  const managed = await safeDbQuery("ad_slot_runtime_lookup_failed", null, () =>
    prisma.adSlot.findUnique({ where: { key: placement.position } })
  );
  if (managed && !managed.enabled) return null;
  const resolvedClient = (managed?.clientId || client).trim();
  const resolvedSlot = (slot || managed?.slotId || adsenseSlotFor(position)).trim();
  const configured = Boolean(resolvedClient && resolvedSlot);
  const shouldLazyLoad = lazy ?? managed?.lazy ?? placement.lazy;
  const resolvedFormat = managed?.format || format;
  const style = {
    "--ad-min-height-desktop": `${managed?.minHeightDesktop ?? placement.minHeightDesktop}px`,
    "--ad-min-height-mobile": `${managed?.minHeightMobile ?? placement.minHeightMobile}px`
  } as CSSProperties;

  if (!configured && process.env.NODE_ENV === "production") return null;

  return (
    <aside
      className={`ad-slot ad-slot-${position} ${className}`}
      aria-label={`Advertisement ${position}`}
      data-ad-position={position}
      data-ad-route-scope={placement.routeScope}
      data-ad-lazy={shouldLazyLoad ? "true" : "false"}
      data-ad-render-mode={renderMode}
      style={style}
    >
      <span>Advertisement</span>
      {configured ? (
        <AdSenseAd
          client={resolvedClient}
          slot={resolvedSlot}
          format={resolvedFormat}
          responsive={responsive}
          position={position}
          lazy={shouldLazyLoad}
        />
      ) : (
        <small>Development placeholder · {position}</small>
      )}
    </aside>
  );
}
