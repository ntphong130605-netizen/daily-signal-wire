import AdSenseAd from "@/components/ads/AdSenseAd";
import {
  adsenseClientId,
  adsenseSlotFor,
  type AdPosition
} from "@/lib/ads";

export type AdSlotProps = {
  slot?: string;
  format?: string;
  responsive?: boolean;
  className?: string;
  position?: AdPosition;
};

export default function AdSlot({
  slot,
  format = "auto",
  responsive = true,
  className = "",
  position = "top"
}: AdSlotProps) {
  const client = adsenseClientId();
  const resolvedSlot = (slot || adsenseSlotFor(position)).trim();
  const configured = Boolean(client && resolvedSlot);

  if (!configured && process.env.NODE_ENV === "production") return null;

  return (
    <aside
      className={`ad-slot ad-slot-${position} ${className}`}
      aria-label={`Advertisement ${position}`}
      data-ad-position={position}
    >
      <span>Advertisement</span>
      {configured ? (
        <AdSenseAd
          client={client}
          slot={resolvedSlot}
          format={format}
          responsive={responsive}
        />
      ) : (
        <small>Development placeholder · {position}</small>
      )}
    </aside>
  );
}
