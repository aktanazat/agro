import type { DataSource } from "./datasource";
import type {
  Observation,
  Recommendation,
  Playbook,
  PlaybookPatch,
  WeatherFeatures,
  TraceData,
  PatchApplyResult,
} from "./types";

/**
 * LiveSource stub -- calls /v1/* endpoints when a backend is available.
 * Falls back to errors that the UI layer catches and degrades to FixtureSource.
 * Not required for MVP; exists to prove the adapter seam is real.
 */
export class LiveSource implements DataSource {
  kind = "live" as const;
  private baseUrl: string;

  constructor(baseUrl = "/v1") {
    this.baseUrl = baseUrl;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`LiveSource: ${res.status} ${res.statusText}`);
    return res.json() as Promise<T>;
  }

  listObservations = () => this.get<Observation[]>("/observations");
  getObservation = (id: string) => this.get<Observation>(`/observations/${id}`);
  listRecommendations = () => this.get<Recommendation[]>("/recommendations");
  getRecommendation = (id: string) => this.get<Recommendation>(`/recommendations/${id}`);
  getPlaybook = (id: string, version?: number) =>
    this.get<Playbook>(`/playbooks/${id}${version ? `?version=${version}` : ""}`);
  getWeatherFeatures = (id: string) => this.get<WeatherFeatures>(`/weather/${id}`);
  getPatch = (id: string) => this.get<PlaybookPatch>(`/patches/${id}`);
  getTrace = (observationId: string) =>
    this.get<TraceData>(`/traces/${observationId}`);

  async applyPatch(patch: PlaybookPatch): Promise<PatchApplyResult> {
    const res = await fetch(`${this.baseUrl}/playbooks/${patch.playbookId}/patches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`LiveSource: ${res.status} ${res.statusText}`);
    return res.json() as Promise<PatchApplyResult>;
  }
}
