import {
  GeoPoint,
  Observation,
  Playbook,
  PlaybookPatch,
  Recommendation,
  WeatherFeatures,
  PatchApplyResult,
  SyncBatchRequest,
  SyncBatchResponse,
} from '../types';
import { DEMO_PLAYBOOK, DEMO_OBSERVATION, DEMO_WEATHER_FEATURES } from '../fixtures';
import { generateRecommendation } from '../engine/recommendationEngine';
import { getWeatherFeatures, WeatherFeaturesCache } from '../weather/weatherAdapter';
import { applyPatchAndRecompute } from '../patch/patchEngine';
import { syncBatch } from '../sync/syncStub';

// In-memory state
let activePlaybook: Playbook = structuredClone(DEMO_PLAYBOOK);
let lastObservation: Observation = structuredClone(DEMO_OBSERVATION);
let lastWeatherFeatures: WeatherFeatures = structuredClone(DEMO_WEATHER_FEATURES);
let recommendationCounter = 1;

const weatherCache: WeatherFeaturesCache = {
  features: null,
  lastFetchedAt: null,
};

function nextRecommendationId(): string {
  const id = `rec_20260211_${String(recommendationCounter).padStart(4, '0')}`;
  recommendationCounter++;
  return id;
}

export function getActivePlaybook(): Playbook {
  return activePlaybook;
}

export function setActivePlaybook(playbook: Playbook): void {
  activePlaybook = playbook;
}

export function getLastObservation(): Observation {
  return lastObservation;
}

export function setLastObservation(observation: Observation): void {
  lastObservation = observation;
}

export async function handleGenerateRecommendation(input: {
  observation?: Observation;
  playbookId?: string;
  weatherMode?: 'demo' | 'live';
  referenceTime?: Date;
}): Promise<Recommendation> {
  const observation = input.observation ?? lastObservation;
  const weatherMode = input.weatherMode ?? 'demo';
  const referenceTime = input.referenceTime ?? new Date();

  const weather = await getWeatherFeatures(
    observation.location,
    observation.createdAt,
    weatherMode,
    undefined,
    weatherCache,
  );
  lastWeatherFeatures = weather;

  const recId = nextRecommendationId();

  return generateRecommendation(
    observation,
    activePlaybook,
    weather,
    recId,
    referenceTime,
  );
}

export async function handleApplyPatch(input: {
  patch: PlaybookPatch;
  lastObservation?: Observation;
  weatherMode?: 'demo' | 'live';
  referenceTime?: Date;
}): Promise<{
  patchResult: PatchApplyResult;
  newRecommendation: Recommendation | null;
}> {
  const observation = input.lastObservation ?? lastObservation;
  const referenceTime = input.referenceTime ?? new Date();
  const weatherMode = input.weatherMode ?? 'demo';

  const weather = await getWeatherFeatures(
    observation.location,
    observation.createdAt,
    weatherMode,
    undefined,
    weatherCache,
  );
  lastWeatherFeatures = weather;

  const newRecId = nextRecommendationId();
  const appliedAt = new Date().toISOString();

  const { patchResult, newPlaybook, newRecommendation } =
    applyPatchAndRecompute(
      input.patch,
      activePlaybook,
      observation,
      weather,
      appliedAt,
      newRecId,
      referenceTime,
    );

  if (newPlaybook) {
    activePlaybook = newPlaybook;
  }

  return { patchResult, newRecommendation };
}

export async function handleGetWeatherFeatures(input: {
  location: GeoPoint;
  atTime: string;
  mode: 'demo' | 'live';
}): Promise<WeatherFeatures> {
  return getWeatherFeatures(
    input.location,
    input.atTime,
    input.mode,
    undefined,
    weatherCache,
  );
}

export async function handleSyncBatch(
  request: SyncBatchRequest,
): Promise<SyncBatchResponse> {
  return syncBatch(request);
}

export function resetState(): void {
  activePlaybook = structuredClone(DEMO_PLAYBOOK);
  lastObservation = structuredClone(DEMO_OBSERVATION);
  lastWeatherFeatures = structuredClone(DEMO_WEATHER_FEATURES);
  recommendationCounter = 1;
  weatherCache.features = null;
  weatherCache.lastFetchedAt = null;
}
