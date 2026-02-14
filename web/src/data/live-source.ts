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
  private apiKey: string;
  private apiKeyHeader: string;
  private apiKeyPrefix: string;
  private deviceToken: string;

  constructor(baseUrl = import.meta.env.VITE_API_BASE_URL ?? "/v1") {
    this.baseUrl = baseUrl;
    this.apiKey = import.meta.env.VITE_API_KEY ?? "";
    this.apiKeyHeader = import.meta.env.VITE_API_KEY_HEADER ?? "x-api-key";
    this.apiKeyPrefix = import.meta.env.VITE_API_KEY_PREFIX ?? "";
    this.deviceToken = import.meta.env.VITE_DEVICE_TOKEN ?? "";
  }

  private requestHeaders(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extra };
    if (this.apiKey) {
      headers[this.apiKeyHeader] = this.apiKeyPrefix
        ? `${this.apiKeyPrefix} ${this.apiKey}`
        : this.apiKey;
    }
    if (this.deviceToken) {
      headers["X-Device-Token"] = this.deviceToken;
    }
    return headers;
  }

  private idempotencyKey(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: this.requestHeaders(),
    });
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
      headers: this.requestHeaders({
        "Content-Type": "application/json",
        "Idempotency-Key": this.idempotencyKey(`patch-${patch.patchId}`),
      }),
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`LiveSource: ${res.status} ${res.statusText}`);
    return res.json() as Promise<PatchApplyResult>;
  }
}
