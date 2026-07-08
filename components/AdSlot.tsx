import AdSenseUnit from "@/components/AdSenseUnit";

export default function AdSlot({
  position,
  className = ""
}: {
  position: "top" | "middle" | "bottom" | "sidebar";
  className?: string;
}) {
  const client =
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slotByPosition = {
    top: process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP,
    middle: process.env.NEXT_PUBLIC_ADSENSE_SLOT_MIDDLE,
    bottom: process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM,
    sidebar: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR
  };
  const slot = slotByPosition[position];
  const configured = Boolean(client && slot);

  return (
    <aside
      className={`ad-slot ad-slot-${position} ${className}`}
      aria-label={`Advertisement ${position}`}
      data-ad-position={position}
    >
      {configured ? (
        <AdSenseUnit client={client!} slot={slot!} />
      ) : (
        <>
          <span>Ad Slot</span>
          <small>AdSense placeholder · {position}</small>
        </>
      )}
    </aside>
  );
}
