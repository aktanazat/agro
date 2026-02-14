import { GeoPoint, WeatherFeatures } from '../types';
import { DEMO_WEATHER_FEATURES } from '../fixtures';

export interface WeatherFeaturesCache {
  features: WeatherFeatures | null;
  lastFetchedAt: Date | null;
}

const MAX_CACHE_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

export function loadDemoWeatherFeatures(): WeatherFeatures {
  return { ...DEMO_WEATHER_FEATURES };
}

export async function fetchLiveWeatherFeatures(
  _location: GeoPoint,
  atTime: string,
  _apiToken: string,
): Promise<WeatherFeatures> {
  // Stub: In production, this would call Synoptic API endpoints:
  //   GET /v2/stations/latest?token=...&radius=lat,lon,25
  //   GET /v2/stations/nearesttime?token=...&attime=...&radius=lat,lon,25
  // Then normalize station data to vertical layers and derive features.

  const dateStr = atTime.slice(0, 10).replace(/-/g, '');
  return {
    ...DEMO_WEATHER_FEATURES,
    weatherFeaturesId: `wxf_${dateStr}_live_0001`,
    sourceMode: 'live',
    profileTime: atTime,
    sprayWindowScore: 0.72,
    diseaseRiskScore: 0.68,
    heatStressScore: 0.35,
    notes: ['Live fetch - Synoptic API'],
  };
}

export async function getWeatherFeatures(
  location: GeoPoint,
  atTime: string,
  mode: 'demo' | 'live',
  apiToken?: string,
  cache?: WeatherFeaturesCache,
): Promise<WeatherFeatures> {
  if (mode === 'demo') {
    return loadDemoWeatherFeatures();
  }

  // Live mode
  try {
    if (!apiToken) throw new Error('No API token for live mode');
    const features = await fetchLiveWeatherFeatures(location, atTime, apiToken);
    // Update cache
    if (cache) {
      cache.features = features;
      cache.lastFetchedAt = new Date();
    }
    return features;
  } catch {
    // Failover: check cache
    if (
      cache?.features &&
      cache.lastFetchedAt &&
      Date.now() - cache.lastFetchedAt.getTime() <= MAX_CACHE_AGE_MS
    ) {
      return {
        ...cache.features,
        notes: [...cache.features.notes, 'live_cache_used'],
      };
    }

    // Final fallback: demo profile
    return loadDemoWeatherFeatures();
  }
}
