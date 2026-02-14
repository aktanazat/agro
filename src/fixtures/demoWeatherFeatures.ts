import { WeatherFeatures, VerticalLayer } from '../types';

export const DEMO_WEATHER_FEATURES: WeatherFeatures = {
  weatherFeaturesId: 'wxf_20260211_demo_01',
  sourceMode: 'demo',
  profileTime: '2026-02-11T18:00:00Z',
  location: {
    lat: 38.5449,
    lon: -121.7405,
  },
  inversionPresent: false,
  humidityLayering: 'uniform_humid',
  windShearProxy: 'moderate',
  sprayWindowScore: 0.75,
  diseaseRiskScore: 0.65,
  heatStressScore: 0.3,
  notes: [
    'Demo profile for hackathon',
    'Yolo County typical evening conditions',
    'Surface wind 8 kph from NW',
    'RH gradient 68% surface to 52% at 500m',
    'No significant temperature inversion',
  ],
};

export const DEMO_VERTICAL_LAYERS: VerticalLayer[] = [
  {
    altitudeM: 0,
    temperatureC: 18.5,
    relativeHumidityPct: 68,
    windSpeedKph: 8,
    windDirectionDeg: 315,
  },
  {
    altitudeM: 100,
    temperatureC: 17.8,
    relativeHumidityPct: 62,
    windSpeedKph: 12,
    windDirectionDeg: 320,
  },
  {
    altitudeM: 300,
    temperatureC: 16.2,
    relativeHumidityPct: 55,
    windSpeedKph: 18,
    windDirectionDeg: 325,
  },
  {
    altitudeM: 500,
    temperatureC: 14.5,
    relativeHumidityPct: 52,
    windSpeedKph: 22,
    windDirectionDeg: 330,
  },
];
