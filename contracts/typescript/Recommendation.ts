import type { Issue, Severity } from "./Observation";

export type RecommendationStatus =
  | "pending_confirmation"
  | "confirmed"
  | "rejected";

export type RiskFlag =
  | "weather_data_missing"
  | "high_drift_risk"
  | "low_confidence"
  | "manual_review_required";

export interface Recommendation {
  recommendationId: string;
  observationId: string;
  playbookId: string;
  playbookVersion: number;
  weatherFeaturesId: string;
  generatedAt: string;
  issue: Issue;
  severity: Severity;
  action: string;
  rationale: string[];
  timingWindow: RecommendationTimingWindow;
  riskFlags: RiskFlag[];
  requiredConfirmation: true;
  status: RecommendationStatus;
}

export interface RecommendationTimingWindow {
  startAt: string;
  endAt: string;
  localTimezone: string;
  confidence: number;
  drivers: string[];
}
