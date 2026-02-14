export interface SharePayload {
  generatedAt: string;
  observation: {
    observationId: string;
    deviceId: string;
    createdAt: string;
    captureMode: string;
    fieldBlock: string;
    crop: string;
    variety?: string | null;
    issue: string;
    severity: string;
    symptoms: string[];
    leafWetness: string;
    windEstimateKph: number;
    status: string;
  };
  recommendation: {
    recommendationId: string;
    playbookId: string;
    playbookVersion: number;
    weatherFeaturesId: string;
    action: string;
    timingWindow: {
      startAt: string;
      endAt: string;
      confidence: number;
    };
    status: string;
  };
  metadata: {
    weatherMode: string;
    offlineMode: boolean;
    schemaVersion: string;
    deterministicChecksum: string;
  };
}

interface ObservationInput {
  observationId: string;
  deviceId: string;
  createdAt: string;
  captureMode: string;
  extraction: {
    crop: string;
    variety?: string | null;
    fieldBlock: string;
    issue: string;
    severity: string;
    symptoms: string[];
  };
  normalization: { leafWetness: string; windEstimateKph: number };
  status: string;
  schemaVersion: string;
  deterministicChecksum: string;
}

interface RecommendationInput {
  recommendationId: string;
  playbookId: string;
  playbookVersion: number;
  weatherFeaturesId: string;
  action: string;
  timingWindow: { startAt: string; endAt: string; confidence: number };
  status: string;
}

export function buildSharePayload(
  obs: ObservationInput,
  rec: RecommendationInput,
  weatherMode = "demo",
): SharePayload {
  return {
    generatedAt: new Date().toISOString(),
    observation: {
      observationId: obs.observationId,
      deviceId: obs.deviceId,
      createdAt: obs.createdAt,
      captureMode: obs.captureMode,
      fieldBlock: obs.extraction.fieldBlock,
      crop: obs.extraction.crop,
      variety: obs.extraction.variety,
      issue: obs.extraction.issue,
      severity: obs.extraction.severity,
      symptoms: obs.extraction.symptoms,
      leafWetness: obs.normalization.leafWetness,
      windEstimateKph: obs.normalization.windEstimateKph,
      status: obs.status,
    },
    recommendation: {
      recommendationId: rec.recommendationId,
      playbookId: rec.playbookId,
      playbookVersion: rec.playbookVersion,
      weatherFeaturesId: rec.weatherFeaturesId,
      action: rec.action,
      timingWindow: {
        startAt: rec.timingWindow.startAt,
        endAt: rec.timingWindow.endAt,
        confidence: rec.timingWindow.confidence,
      },
      status: rec.status,
    },
    metadata: {
      weatherMode,
      offlineMode: true,
      schemaVersion: obs.schemaVersion,
      deterministicChecksum: obs.deterministicChecksum,
    },
  };
}

export function buildShareSummary(
  obs: ObservationInput,
  rec: RecommendationInput,
  weatherMode = "demo",
): string {
  const variety = obs.extraction.variety ?? obs.extraction.crop;
  return [
    "FieldScout Copilot -- Visit Summary",
    `${obs.extraction.fieldBlock} ${variety} -- ${obs.createdAt}`,
    "",
    `Issue: ${obs.extraction.issue.replace(/_/g, " ")} (${obs.extraction.severity})`,
    `Symptoms: ${obs.extraction.symptoms.join(", ")}`,
    `Leaf wetness: ${obs.normalization.leafWetness} | Wind: ${obs.normalization.windEstimateKph} kph`,
    "",
    `Recommendation: ${rec.action}`,
    `Window: ${rec.timingWindow.startAt} to ${rec.timingWindow.endAt}`,
    `Confidence: ${Math.round(rec.timingWindow.confidence * 100)}%`,
    "",
    `Playbook: ${rec.playbookId} v${rec.playbookVersion} | Weather: ${weatherMode}`,
    `IDs: ${obs.observationId} / ${rec.recommendationId}`,
    `Device: ${obs.deviceId} | Mode: offline`,
  ].join("\n");
}
