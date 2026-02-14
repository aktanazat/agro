export type RiskFlag =
  | 'weather_data_missing'
  | 'high_drift_risk'
  | 'low_confidence'
  | 'manual_review_required';

export type RecommendationStatus = 'pending_confirmation' | 'confirmed' | 'rejected';

export interface TimingWindow {
  startAt: string;
  endAt: string;
  localTimezone: string;
  confidence: number;
  drivers: string[];
}

export interface Recommendation {
  recommendationId: string;
  observationId: string;
  playbookId: string;
  playbookVersion: number;
  weatherFeaturesId: string;
  generatedAt: string;
  issue: 'powdery_mildew' | 'heat_stress' | 'other';
  severity: 'low' | 'moderate' | 'high';
  action: string;
  rationale: string[];
  timingWindow: TimingWindow;
  riskFlags: RiskFlag[];
  requiredConfirmation: true;
  status: RecommendationStatus;
}
