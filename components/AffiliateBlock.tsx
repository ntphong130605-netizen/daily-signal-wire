"use client";

import { trackAffiliateClick } from "@/lib/analytics";
import { useRevenueVariant } from "@/components/experiments/ExperimentRuntime";
import type { RevenueExperimentPayload } from "@/lib/revenue";

export type AffiliateOffer = {
  id: string;
  label: string;
  imageUrl?: string | null;
  priceText?: string | null;
  callToAction: string;
  disclosure: string;
  program: string;
  network: string;
};

export default function AffiliateBlock({
  offers,
  articleSlug,
  category,
  ctaExperiment
}: {
  offers: AffiliateOffer[];
  articleSlug: string;
  category: string;
  ctaExperiment?: RevenueExperimentPayload | null;
}) {
  const { variant, track } = useRevenueVariant(ctaExperiment);
  if (!offers.length) return null;
  return (
    <aside className="affiliate-block" aria-label="Affiliate recommendations" data-heatmap-key="affiliate-block">
      <div className="affiliate-block-heading">
        <span>Reader resources</span>
        <strong>Relevant products and services</strong>
      </div>
      <div className="affiliate-offer-grid">
        {offers.map((offer) => (
          <article key={offer.id}>
            {offer.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={offer.imageUrl} alt="" loading="lazy" width="96" height="96" />
            )}
            <div>
              <small>{offer.program}</small>
              <h3>{offer.label}</h3>
              {offer.priceText && <p>{offer.priceText}</p>}
              <a
                href={`/api/affiliate/click/${offer.id}?article=${encodeURIComponent(articleSlug)}&category=${encodeURIComponent(category)}`}
                rel="sponsored nofollow noreferrer"
                onClick={() => {
                  track("click");
                  trackAffiliateClick({
                    affiliate_link_id: offer.id,
                    affiliate_network: offer.network,
                    article_slug: articleSlug,
                    category
                  });
                }}
              >
                {variant?.value || offer.callToAction}
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="affiliate-disclosure">Disclosure: {offers[0].disclosure}</p>
    </aside>
  );
}
