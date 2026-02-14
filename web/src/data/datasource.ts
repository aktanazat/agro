import type {
  Observation,
  Recommendation,
  Playbook,
  PlaybookPatch,
  WeatherFeatures,
  TraceData,
  PatchApplyResult,
} from "./types";

/** Adapter boundary: every cross-module call returns contract payloads. */
export interface DataSource {
  kind: "fixture" | "live";
  listObservations(): Promise<Observation[]>;
  getObservation(id: string): Promise<Observation>;
  listRecommendations(): Promise<Recommendation[]>;
  getRecommendation(id: string): Promise<Recommendation>;
  getPlaybook(id: string, version?: number): Promise<Playbook>;
  getWeatherFeatures(id: string): Promise<WeatherFeatures>;
  getPatch(id: string): Promise<PlaybookPatch>;
  getTrace(observationId: string): Promise<TraceData>;
  applyPatch(patch: PlaybookPatch): Promise<PatchApplyResult>;
}
