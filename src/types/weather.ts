import { GeoPoint } from './common';

export type WeatherSourceMode = 'demo' | 'live' | 'none';
export type HumidityLayering =
  | 'dry_aloft_humid_surface'
  | 'uniform_humid'
  | 'uniform_dry'
  | 'unknown';
export type WindShearProxy = 'low' | 'moderate' | 'high' | 'unknown';

export interface WeatherFeatures {
  weatherFeaturesId: string;
  sourceMode: WeatherSourceMode;
  profileTime: string;
  location: GeoPoint;
  inversionPresent: boolean;
  humidityLayering: HumidityLayering;
  windShearProxy: WindShearProxy;
  sprayWindowScore: number;
  diseaseRiskScore: number;
  heatStressScore: number;
  notes: string[];
}

export interface VerticalLayer {
  altitudeM: number;
  temperatureC: number;
  relativeHumidityPct: number;
  windSpeedKph: number;
  windDirectionDeg: number;
}
