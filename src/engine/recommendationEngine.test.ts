import { describe, it, expect } from 'vitest';
import { generateRecommendation, selectRule } from './recommendationEngine';
import { DEMO_OBSERVATION, DEMO_PLAYBOOK, DEMO_WEATHER_FEATURES } from '../fixtures';

describe('selectRule', () => {
  it('selects rule_pm_moderate for powdery_mildew', () => {
    const rule = selectRule(DEMO_PLAYBOOK, 'powdery_mildew', 'moderate');
    expect(rule).not.toBeNull();
    expect(rule!.ruleId).toBe('rule_pm_moderate');
  });

  it('selects rule_heat_moderate for heat_stress', () => {
    const rule = selectRule(DEMO_PLAYBOOK, 'heat_stress', 'moderate');
    expect(rule).not.toBeNull();
    expect(rule!.ruleId).toBe('rule_heat_moderate');
  });

  it('returns null for unknown issue', () => {
    const rule = selectRule(DEMO_PLAYBOOK, 'other', 'moderate');
    expect(rule).toBeNull();
  });
});

describe('generateRecommendation', () => {
  // Use a fixed reference time so outputs are deterministic
  const referenceTime = new Date('2026-02-11T19:00:00-08:00');

  it('generates recommendation for demo mildew observation', () => {
    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      DEMO_WEATHER_FEATURES,
      'rec_20260211_0001',
      referenceTime,
    );

    expect(rec.recommendationId).toBe('rec_20260211_0001');
    expect(rec.observationId).toBe('obs_20260211_0001');
    expect(rec.playbookId).toBe('pbk_yolo_grape');
    expect(rec.playbookVersion).toBe(3);
    expect(rec.weatherFeaturesId).toBe('wxf_20260211_demo_01');
    expect(rec.issue).toBe('powdery_mildew');
    expect(rec.severity).toBe('moderate');
    expect(rec.action).toBe('Apply sulfur-based contact spray in affected block.');
    expect(rec.requiredConfirmation).toBe(true);
    expect(rec.status).toBe('pending_confirmation');
  });

  it('includes humidity rationale tag for uniform_humid weather', () => {
    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      DEMO_WEATHER_FEATURES,
      'rec_20260211_0001',
      referenceTime,
    );

    expect(rec.rationale).toContain('high_humidity_persistence');
    // inversionPresent=false so avoid_inversion should NOT be in rationale
    expect(rec.rationale).not.toContain('avoid_inversion');
  });

  it('produces a valid timing window', () => {
    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      DEMO_WEATHER_FEATURES,
      'rec_20260211_0001',
      referenceTime,
    );

    // Base: +2h = 21:00, +6h = 01:00 next day
    // Humidity adjustment: end -90min = 23:30
    expect(rec.timingWindow.startAt).toContain('21:00:00');
    expect(rec.timingWindow.endAt).toContain('23:30:00');
    expect(rec.timingWindow.localTimezone).toBe('America/Los_Angeles');
  });

  it('has correct drivers list', () => {
    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      DEMO_WEATHER_FEATURES,
      'rec_20260211_0001',
      referenceTime,
    );

    expect(rec.timingWindow.drivers).toContain('inversionPresent=false');
    expect(rec.timingWindow.drivers).toContain('humidityLayering=uniform_humid');
    expect(rec.timingWindow.drivers).toContain('windShearProxy=moderate');
    expect(rec.timingWindow.drivers).toContain('maxWindKph=12');
  });

  it('has no risk flags for demo weather features', () => {
    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      DEMO_WEATHER_FEATURES,
      'rec_20260211_0001',
      referenceTime,
    );

    expect(rec.riskFlags).toEqual([]);
  });

  it('sets confidence to 0.85 for demo mode', () => {
    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      DEMO_WEATHER_FEATURES,
      'rec_20260211_0001',
      referenceTime,
    );

    // 0.9 - 0.05 (demo) = 0.85
    expect(rec.timingWindow.confidence).toBe(0.85);
  });

  it('adds risk flags for high wind shear', () => {
    const highShearWeather = {
      ...DEMO_WEATHER_FEATURES,
      windShearProxy: 'high' as const,
    };

    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      highShearWeather,
      'rec_test_001',
      referenceTime,
    );

    expect(rec.riskFlags).toContain('high_drift_risk');
    expect(rec.rationale).toContain('spray_drift_risk');
  });

  it('adds low_confidence flag when spray window score < 0.4', () => {
    const lowScoreWeather = {
      ...DEMO_WEATHER_FEATURES,
      sprayWindowScore: 0.3,
    };

    const rec = generateRecommendation(
      DEMO_OBSERVATION,
      DEMO_PLAYBOOK,
      lowScoreWeather,
      'rec_test_002',
      referenceTime,
    );

    expect(rec.riskFlags).toContain('low_confidence');
  });

  it('throws for unknown issue type', () => {
    const otherObs = {
      ...DEMO_OBSERVATION,
      extraction: { ...DEMO_OBSERVATION.extraction, issue: 'other' as const },
    };

    expect(() =>
      generateRecommendation(
        otherObs,
        DEMO_PLAYBOOK,
        DEMO_WEATHER_FEATURES,
        'rec_test_003',
        referenceTime,
      ),
    ).toThrow('No matching rule');
  });
});
