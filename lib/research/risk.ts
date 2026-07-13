import type { ResearchAction, ResearchRiskLevel } from "@/lib/research/types";

const BLOCKED_PATTERN =
  /\b(child sexual|csam|how to make a bomb|bomb recipe|suicide method|self-harm instructions|terrorist manifesto)\b/i;

const HIGH_RISK_PATTERN =
  /\b(election|ballot|war|invasion|shooting|killed|dead|death|murder|terror|lawsuit|court|arrest|crime|crash|explosion|disaster|earthquake|hurricane|wildfire|outbreak|vaccine|pandemic|stock crash|bankruptcy|allegation|abuse|fraud)\b/i;

const MEDIUM_RISK_PATTERN =
  /\b(earnings|stock|recall|layoffs|rumor|leak|health|finance|police|investigation|protest|strike|weather alert)\b/i;

export function classifyRisk(text: string): {
  riskLevel: ResearchRiskLevel;
  factCheckRequired: boolean;
} {
  if (BLOCKED_PATTERN.test(text)) {
    return { riskLevel: "blocked", factCheckRequired: true };
  }
  if (HIGH_RISK_PATTERN.test(text)) {
    return { riskLevel: "high", factCheckRequired: true };
  }
  if (MEDIUM_RISK_PATTERN.test(text)) {
    return { riskLevel: "medium", factCheckRequired: true };
  }
  return { riskLevel: "low", factCheckRequired: false };
}

export function recommendedActionForRisk({
  riskLevel,
  score,
  independentSources,
  minTrendScore
}: {
  riskLevel: ResearchRiskLevel;
  score: number;
  independentSources: number;
  minTrendScore: number;
}): ResearchAction {
  if (riskLevel === "blocked") return "blocked";
  if (riskLevel === "high" && independentSources < 2) return "monitor";
  if (score >= 75 && score >= minTrendScore) return "generate_draft";
  if (score >= minTrendScore) return "monitor";
  return "ignore";
}
