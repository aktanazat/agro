import type { CactusRuntime } from "./cactus-stub";

export type InferenceMode = "cactus" | "rule_based" | "unavailable";
export type WeatherMode = "demo" | "live";
export type DataMode = "fixture" | "live";

export interface PipelineStatus {
  offlineMode: boolean;
  inferenceMode: InferenceMode;
  weatherMode: WeatherMode;
  dataMode: DataMode;
  cactusModelId: string | null;
  activePlaybookVersion: number;
  deviceId: string;
}

export function getPipelineStatus(params: {
  cactusRuntime?: CactusRuntime | null;
  weatherMode?: WeatherMode;
  dataMode?: DataMode;
  activePlaybookVersion?: number;
  deviceId?: string;
}): PipelineStatus {
  const cactus = params.cactusRuntime;
  let inferenceMode: InferenceMode = "rule_based";
  let cactusModelId: string | null = null;

  if (cactus && "isReady" in cactus) {
    const stub = cactus as { isReady(): boolean };
    if (stub.isReady()) {
      inferenceMode = "cactus";
      cactusModelId = "cactus_extract_q4:int4";
    }
  }

  return {
    offlineMode: true,
    inferenceMode,
    weatherMode: params.weatherMode ?? "demo",
    dataMode: params.dataMode ?? "fixture",
    cactusModelId,
    activePlaybookVersion: params.activePlaybookVersion ?? 3,
    deviceId: params.deviceId ?? "dev_ios_001",
  };
}

export function formatInferenceLabel(mode: InferenceMode): string {
  switch (mode) {
    case "cactus": return "on-device (cactus)";
    case "rule_based": return "on-device (rules)";
    case "unavailable": return "unavailable";
  }
}
