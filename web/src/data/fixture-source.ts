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

import obsFixture from "../../fixtures/observation_obs_20260211_0001.json";
import rec1Fixture from "../../fixtures/recommendation_rec_20260211_0001.json";
import rec2Fixture from "../../fixtures/recommendation_rec_20260211_0002.json";
import playbookFixture from "../../fixtures/playbook_pbk_yolo_grape_v3.json";
import weatherFixture from "../../fixtures/weatherfeatures_wxf_20260211_demo_01.json";
import patchFixture from "../../fixtures/playbookpatch_pch_20260211_0001.json";
import traceFixture from "../../fixtures/trace_obs_20260211_0001.json";

const observations = new Map<string, Observation>([
  [obsFixture.observationId, obsFixture as Observation],
]);

const recommendations = new Map<string, Recommendation>([
  [rec1Fixture.recommendationId, rec1Fixture as Recommendation],
  [rec2Fixture.recommendationId, rec2Fixture as Recommendation],
]);

const playbooks = new Map<string, Playbook>([
  [`${playbookFixture.playbookId}@${playbookFixture.version}`, playbookFixture as unknown as Playbook],
]);

const patches = new Map<string, PlaybookPatch>([
  [patchFixture.patchId, patchFixture as PlaybookPatch],
]);

function resolveJsonPath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.replace(/^\//, "").split("/");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

function setJsonPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.replace(/^\//, "").split("/");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    current = current[parts[i]] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
}

function collectEditablePaths(playbook: Playbook): string[] {
  return Object.values(playbook.rules).flatMap((r) => r.editablePaths);
}

export class FixtureSource implements DataSource {
  kind = "fixture" as const;
  private _activeVersion = playbookFixture.version;

  async listObservations() {
    return [...observations.values()];
  }
  async getObservation(id: string) {
    const obs = observations.get(id);
    if (!obs) throw new Error(`NOT_FOUND: observation ${id}`);
    return obs;
  }
  async listRecommendations() {
    return [...recommendations.values()];
  }
  async getRecommendation(id: string) {
    const rec = recommendations.get(id);
    if (!rec) throw new Error(`NOT_FOUND: recommendation ${id}`);
    return rec;
  }
  async getPlaybook(id: string, version?: number) {
    const v = version ?? this._activeVersion;
    const key = `${id}@${v}`;
    const pb = playbooks.get(key);
    if (!pb) throw new Error(`NOT_FOUND: playbook ${key}`);
    return pb;
  }
  async getWeatherFeatures(id: string) {
    if (id !== weatherFixture.weatherFeaturesId)
      throw new Error(`NOT_FOUND: weatherfeatures ${id}`);
    return weatherFixture as unknown as WeatherFeatures;
  }
  async getPatch(id: string) {
    const p = patches.get(id);
    if (!p) throw new Error(`NOT_FOUND: patch ${id}`);
    return p;
  }
  async getTrace(observationId: string) {
    if (observationId !== traceFixture.observationId)
      throw new Error(`NOT_FOUND: trace for ${observationId}`);
    return traceFixture as TraceData;
  }
  async applyPatch(patch: PlaybookPatch): Promise<PatchApplyResult> {
    const playbook = await this.getPlaybook(patch.playbookId, patch.baseVersion);
    const allowed = collectEditablePaths(playbook);

    for (const op of patch.operations) {
      if (!allowed.includes(op.path)) {
        return {
          patchId: patch.patchId,
          playbookId: patch.playbookId,
          oldVersion: patch.baseVersion,
          newVersion: patch.baseVersion,
          status: "rejected",
          validationErrors: [`PLAYBOOK_PATCH_PATH_NOT_ALLOWED: ${op.path}`],
          recomputedRecommendationId: null,
          appliedAt: new Date().toISOString(),
        };
      }
    }

    // Deep clone + apply
    const patched = JSON.parse(JSON.stringify(playbook)) as Playbook;
    for (const op of patch.operations) {
      if (op.op === "replace") {
        setJsonPath(patched as unknown as Record<string, unknown>, op.path, op.value);
      }
    }
    patched.version = patch.baseVersion + 1;
    patched.updatedAt = new Date().toISOString();
    this._activeVersion = patched.version;

    playbooks.set(`${patched.playbookId}@${patched.version}`, patched);

    return {
      patchId: patch.patchId,
      playbookId: patched.playbookId,
      oldVersion: patch.baseVersion,
      newVersion: patched.version,
      status: "applied",
      validationErrors: [],
      recomputedRecommendationId: "rec_20260211_0002",
      appliedAt: patched.updatedAt,
    };
  }

  // Expose for store
  get activeVersion() {
    return this._activeVersion;
  }

  /** Check if a path is in the allowlist without applying. */
  async validatePatchPath(playbookId: string, path: string): Promise<boolean> {
    const pb = await this.getPlaybook(playbookId);
    return collectEditablePaths(pb).includes(path);
  }
}
