import { describe, it, expect } from 'vitest';
import { loadDemoWeatherFeatures, getWeatherFeatures } from './weatherAdapter';

describe('loadDemoWeatherFeatures', () => {
  it('returns canonical demo features', () => {
    const features = loadDemoWeatherFeatures();
    expect(features.weatherFeaturesId).toBe('wxf_20260211_demo_01');
    expect(features.sourceMode).toBe('demo');
    expect(features.inversionPresent).toBe(false);
    expect(features.humidityLayering).toBe('uniform_humid');
    expect(features.windShearProxy).toBe('moderate');
    expect(features.sprayWindowScore).toBe(0.75);
    expect(features.diseaseRiskScore).toBe(0.65);
    expect(features.heatStressScore).toBe(0.3);
  });
});

describe('getWeatherFeatures', () => {
  const location = { lat: 38.5449, lon: -121.7405 };

  it('returns demo features in demo mode', async () => {
    const features = await getWeatherFeatures(
      location,
      '2026-02-11T18:00:00Z',
      'demo',
    );
    expect(features.sourceMode).toBe('demo');
    expect(features.weatherFeaturesId).toBe('wxf_20260211_demo_01');
  });

  it('falls back to demo when live mode has no token', async () => {
    const features = await getWeatherFeatures(
      location,
      '2026-02-11T18:00:00Z',
      'live',
    );
    // No token provided, should fall back to demo
    expect(features.sourceMode).toBe('demo');
  });

  it('uses cache when available and fresh', async () => {
    const cache = {
      features: {
        ...loadDemoWeatherFeatures(),
        sourceMode: 'live' as const,
        weatherFeaturesId: 'wxf_cached',
      },
      lastFetchedAt: new Date(), // Fresh
    };

    const features = await getWeatherFeatures(
      location,
      '2026-02-11T18:00:00Z',
      'live',
      undefined,
      cache,
    );
    expect(features.weatherFeaturesId).toBe('wxf_cached');
    expect(features.notes).toContain('live_cache_used');
  });
});
