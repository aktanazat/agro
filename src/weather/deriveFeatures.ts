import { HumidityLayering, WindShearProxy, VerticalLayer } from '../types';

export function deriveInversionPresent(layers: VerticalLayer[]): boolean {
  if (layers.length < 2) return false;

  const lowLayers = layers
    .filter((l) => l.altitudeM <= 150)
    .sort((a, b) => a.altitudeM - b.altitudeM);

  if (lowLayers.length < 2) return false;

  for (let i = 1; i < lowLayers.length; i++) {
    if (lowLayers[i].temperatureC > lowLayers[i - 1].temperatureC) {
      return true;
    }
  }
  return false;
}

export function deriveHumidityLayering(
  layers: VerticalLayer[],
): HumidityLayering {
  if (layers.length < 2) return 'unknown';

  const sorted = [...layers].sort((a, b) => a.altitudeM - b.altitudeM);
  const surfaceRH = sorted[0].relativeHumidityPct;
  const aloftRH = sorted[sorted.length - 1].relativeHumidityPct;

  const rhDiff = surfaceRH - aloftRH;

  if (rhDiff > 20) return 'dry_aloft_humid_surface';
  if (surfaceRH > 70 && aloftRH > 70) return 'uniform_humid';
  if (surfaceRH < 50 && aloftRH < 50) return 'uniform_dry';
  return 'unknown';
}

export function deriveWindShearProxy(layers: VerticalLayer[]): WindShearProxy {
  if (layers.length < 2) return 'unknown';

  const sorted = [...layers].sort((a, b) => a.altitudeM - b.altitudeM);
  const surfaceWind = sorted[0].windSpeedKph;
  const upperWind = sorted[sorted.length - 1].windSpeedKph;

  const shear = Math.abs(upperWind - surfaceWind);

  if (shear < 5) return 'low';
  if (shear < 15) return 'moderate';
  return 'high';
}

export function calculateSprayWindowScore(
  inversionPresent: boolean,
  humidityLayering: HumidityLayering,
  windShearProxy: WindShearProxy,
): number {
  let score = 1.0;

  if (inversionPresent) score -= 0.3;

  if (humidityLayering === 'uniform_humid') score -= 0.1;
  else if (humidityLayering === 'dry_aloft_humid_surface') score -= 0.2;

  if (windShearProxy === 'high') score -= 0.3;
  else if (windShearProxy === 'moderate') score -= 0.1;

  return Math.max(0, score);
}
