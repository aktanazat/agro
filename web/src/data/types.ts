// Contract types -- frozen per schema in contracts/schemas/

export interface Observation {
  observationId: string;
  deviceId: string;
  createdAt: string;
  captureMode: "voice" | "typed";
  rawNoteText: string;
  transcription: { text: string; source: string; confidence: number };
  extraction: {
    crop: string;
    variety: string | null;
    fieldBlock: string;
    issue: string;
    severity: string;
    symptoms: string[];
    observationTime: string;
  };
  normalization: {
    temperatureC?: number | null;
    leafWetness: string;
    windEstimateKph: number;
  };
  location: { lat: number; lon: number };
  status: string;
  schemaVersion: string;
  deterministicChecksum: string;
}

export interface Recommendation {
  recommendationId: string;
  observationId: string;
  playbookId: string;
  playbookVersion: number;
  weatherFeaturesId: string;
  generatedAt: string;
  issue: string;
  severity: string;
  action: string;
  rationale: string[];
  timingWindow: {
    startAt: string;
    endAt: string;
    localTimezone: string;
    confidence: number;
    drivers: string[];
  };
  riskFlags: string[];
  requiredConfirmation: boolean;
  status: string;
}

export interface Playbook {
  playbookId: string;
  crop: string;
  region: string;
  version: number;
  updatedAt: string;
  rules: Record<string, PlaybookRule>;
}

export interface PlaybookRule {
  ruleId: string;
  issue: string;
  severity: string;
  constraints: Record<string, unknown>;
  action: { type: string; instructions: string };
  timing: {
    baseWindowHours: { startOffsetHours: number; endOffsetHours: number };
    weatherAdjustments: {
      feature: string;
      condition: string;
      shiftStartMinutes: number;
      shiftEndMinutes: number;
      rationaleTag: string;
    }[];
  };
  editablePaths: string[];
}

export interface PlaybookPatch {
  patchId: string;
  playbookId: string;
  baseVersion: number;
  requestedByDeviceId: string;
  requestedAt: string;
  reason: string;
  operations: {
    op: "add" | "replace" | "remove";
    path: string;
    value?: unknown;
    justification?: string;
  }[];
}

export interface WeatherFeatures {
  weatherFeaturesId: string;
  sourceMode: "demo" | "live";
  profileTime: string;
  location: { lat: number; lon: number };
  inversionPresent: boolean;
  humidityLayering: string;
  windShearProxy: string;
  sprayWindowScore: number;
  diseaseRiskScore: number;
  heatStressScore: number;
  notes: string[];
  layers: {
    altitudeM: number;
    temperatureC: number;
    relativeHumidityPct: number;
    windSpeedKph: number;
    windDirectionDeg: number;
  }[];
}

export interface TraceData {
  traceId: string;
  observationId: string;
  deviceId: string;
  startedAt: string;
  completedAt: string;
  totalDurationMs: number;
  stages: TraceStage[];
  thresholds: TraceThreshold[];
}

export interface TraceStage {
  stage: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: string;
}

export interface TraceThreshold {
  label: string;
  maxMs: number;
  actualMs: number;
}

export interface PatchApplyResult {
  patchId: string;
  playbookId: string;
  oldVersion: number;
  newVersion: number;
  status: "applied" | "rejected";
  validationErrors: string[];
  recomputedRecommendationId: string | null;
  appliedAt: string;
}
