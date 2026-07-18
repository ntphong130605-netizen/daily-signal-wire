"use client";

import { useEffect, useMemo, useState } from "react";
import ArticleImageFrame from "@/components/ArticleImageFrame";
import { analyticsIdentity, trackCustom } from "@/lib/analytics";
import type { RevenueExperimentPayload } from "@/lib/revenue";

function hash(value: string) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
}

function selectVariant(experiment: RevenueExperimentPayload) {
  const { visitorId } = analyticsIdentity();
  const bucket = hash(`${visitorId || "anonymous"}:${experiment.id}`) % 100;
  let cursor = 0;
  for (const variant of experiment.variants) {
    cursor += variant.weight;
    if (bucket < cursor) return variant;
  }
  return experiment.variants[0];
}

export function useRevenueVariant(experiment?: RevenueExperimentPayload | null) {
  const initial = experiment?.variants[0];
  const [variant, setVariant] = useState(initial);
  const storageKey = experiment ? `dsw_experiment_${experiment.id}` : "";
  const selected = useMemo(() => {
    if (!experiment) return undefined;
    if (typeof window === "undefined") return experiment.variants[0];
    try {
      const stored = window.localStorage.getItem(storageKey);
      return experiment.variants.find((item) => item.id === stored) || selectVariant(experiment);
    } catch {
      return selectVariant(experiment);
    }
  }, [experiment, storageKey]);

  useEffect(() => {
    if (!experiment || !selected) return;
    setVariant(selected);
    try {
      window.localStorage.setItem(storageKey, selected.id);
      const impressionKey = `${storageKey}_impression`;
      if (window.sessionStorage.getItem(impressionKey)) return;
      window.sessionStorage.setItem(impressionKey, "1");
    } catch {
      // Anonymous assignment still works when browser storage is unavailable.
    }
    fetch("/api/experiments/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId: experiment.id, variantId: selected.id, event: "impression" }),
      keepalive: true
    }).catch(() => null);
    trackCustom("experiment_impression", {
      experiment_id: experiment.id,
      experiment_key: experiment.key,
      variant_id: selected.id,
      variant_key: selected.key
    });
  }, [experiment, selected, storageKey]);

  function track(event: "click" | "conversion" | "revenue", value?: number) {
    if (!experiment || !variant) return;
    fetch("/api/experiments/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ experimentId: experiment.id, variantId: variant.id, event, value }),
      keepalive: true
    }).catch(() => null);
    trackCustom(`experiment_${event}`, {
      experiment_id: experiment.id,
      variant_id: variant.id,
      value
    });
  }

  return { variant, track };
}

export function ExperimentHeadline({
  experiment,
  fallback
}: {
  experiment?: RevenueExperimentPayload | null;
  fallback: string;
}) {
  const { variant } = useRevenueVariant(experiment);
  return <h1 data-experiment={experiment?.key}>{variant?.value || fallback}</h1>;
}

export function ExperimentArticleImage({
  experiment,
  src,
  ...props
}: React.ComponentProps<typeof ArticleImageFrame> & {
  experiment?: RevenueExperimentPayload | null;
}) {
  const { variant } = useRevenueVariant(experiment);
  const candidate = variant?.value?.trim();
  const selectedSrc = candidate && (/^https?:\/\//i.test(candidate) || candidate.startsWith("/")) ? candidate : src;
  return <ArticleImageFrame src={selectedSrc} {...props} />;
}
