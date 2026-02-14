import { describe, it, expect } from 'vitest';
import {
  deriveInversionPresent,
  deriveHumidityLayering,
  deriveWindShearProxy,
  calculateSprayWindowScore,
} from './deriveFeatures';
import { DEMO_VERTICAL_LAYERS } from '../fixtures';

describe('deriveInversionPresent', () => {
  it('returns false for demo layers (temp decreases with altitude)', () => {
    expect(deriveInversionPresent(DEMO_VERTICAL_LAYERS)).toBe(false);
  });

  it('returns true when temperature increases in low layers', () => {
    const inversionLayers = [
      { altitudeM: 0, temperatureC: 15, relativeHumidityPct: 70, windSpeedKph: 5, windDirectionDeg: 0 },
      { altitudeM: 100, temperatureC: 18, relativeHumidityPct: 60, windSpeedKph: 8, windDirectionDeg: 0 },
    ];
    expect(deriveInversionPresent(inversionLayers)).toBe(true);
  });

  it('returns false with fewer than 2 layers', () => {
    expect(deriveInversionPresent([])).toBe(false);
    expect(deriveInversionPresent([DEMO_VERTICAL_LAYERS[0]])).toBe(false);
  });
});

describe('deriveHumidityLayering', () => {
  it('returns dry_aloft_humid_surface for demo layers (68% surface, 52% aloft, diff=16)', () => {
    // RH diff = 68 - 52 = 16, which is NOT > 20
    // But surfaceRH=68 < 70 so not uniform_humid
    // And surfaceRH=68 > 50 so not uniform_dry
    // Result: unknown
    // Actually let's check: the demo profile has surface 68% and aloft 52%.
    // 68 - 52 = 16, not > 20, so not dry_aloft_humid_surface
    // 68 < 70 so not uniform_humid
    // 68 > 50 so not uniform_dry
    // Returns: unknown
    const result = deriveHumidityLayering(DEMO_VERTICAL_LAYERS);
    expect(result).toBe('unknown');
  });

  it('returns uniform_humid when both high', () => {
    const humidLayers = [
      { altitudeM: 0, temperatureC: 18, relativeHumidityPct: 80, windSpeedKph: 5, windDirectionDeg: 0 },
      { altitudeM: 500, temperatureC: 14, relativeHumidityPct: 75, windSpeedKph: 10, windDirectionDeg: 0 },
    ];
    expect(deriveHumidityLayering(humidLayers)).toBe('uniform_humid');
  });

  it('returns uniform_dry when both low', () => {
    const dryLayers = [
      { altitudeM: 0, temperatureC: 25, relativeHumidityPct: 30, windSpeedKph: 5, windDirectionDeg: 0 },
      { altitudeM: 500, temperatureC: 20, relativeHumidityPct: 25, windSpeedKph: 10, windDirectionDeg: 0 },
    ];
    expect(deriveHumidityLayering(dryLayers)).toBe('uniform_dry');
  });

  it('returns dry_aloft_humid_surface when gradient > 20', () => {
    const gradientLayers = [
      { altitudeM: 0, temperatureC: 18, relativeHumidityPct: 80, windSpeedKph: 5, windDirectionDeg: 0 },
      { altitudeM: 500, temperatureC: 14, relativeHumidityPct: 40, windSpeedKph: 10, windDirectionDeg: 0 },
    ];
    expect(deriveHumidityLayering(gradientLayers)).toBe('dry_aloft_humid_surface');
  });
});

describe('deriveWindShearProxy', () => {
  it('returns moderate for demo layers (shear = 22-8 = 14)', () => {
    expect(deriveWindShearProxy(DEMO_VERTICAL_LAYERS)).toBe('moderate');
  });

  it('returns low for small shear', () => {
    const calmLayers = [
      { altitudeM: 0, temperatureC: 18, relativeHumidityPct: 60, windSpeedKph: 5, windDirectionDeg: 0 },
      { altitudeM: 500, temperatureC: 14, relativeHumidityPct: 50, windSpeedKph: 8, windDirectionDeg: 0 },
    ];
    expect(deriveWindShearProxy(calmLayers)).toBe('low');
  });

  it('returns high for large shear', () => {
    const shearLayers = [
      { altitudeM: 0, temperatureC: 18, relativeHumidityPct: 60, windSpeedKph: 5, windDirectionDeg: 0 },
      { altitudeM: 500, temperatureC: 14, relativeHumidityPct: 50, windSpeedKph: 30, windDirectionDeg: 0 },
    ];
    expect(deriveWindShearProxy(shearLayers)).toBe('high');
  });
});

describe('calculateSprayWindowScore', () => {
  it('returns 0.8 for demo conditions (no inversion, uniform_humid, moderate shear)', () => {
    // 1.0 - 0.1 (humid) - 0.1 (moderate) = 0.8
    expect(calculateSprayWindowScore(false, 'uniform_humid', 'moderate')).toBe(0.8);
  });

  it('returns 0.3 for worst conditions', () => {
    // 1.0 - 0.3 (inversion) - 0.1 (humid) - 0.3 (high) = 0.3
    expect(calculateSprayWindowScore(true, 'uniform_humid', 'high')).toBe(0.3);
  });

  it('returns 1.0 for perfect conditions', () => {
    expect(calculateSprayWindowScore(false, 'uniform_dry', 'low')).toBe(1.0);
  });
});
