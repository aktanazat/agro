export type CaptureMode = "voice" | "typed";
export type TranscriptionSource = "on_device_asr" | "manual_typed" | "none";
export type Crop = "grape";
export type Issue = "powdery_mildew" | "heat_stress" | "other";
export type Severity = "low" | "moderate" | "high";
export type LeafWetness = "dry" | "damp" | "wet" | "unknown";
export type ObservationStatus = "draft" | "confirmed" | "logged";

export interface Observation {
  observationId: string;
  deviceId: string;
  createdAt: string;
  captureMode: CaptureMode;
  rawNoteText: string;
  transcription: ObservationTranscription;
  extraction: ObservationExtraction;
  normalization: ObservationNormalization;
  location: GeoPoint;
  status: ObservationStatus;
  schemaVersion: "1.0.0";
  deterministicChecksum: string;
}

export interface ObservationTranscription {
  text: string;
  source: TranscriptionSource;
  confidence: number;
}

export interface ObservationExtraction {
  crop: Crop;
  variety?: string;
  fieldBlock: string;
  issue: Issue;
  severity: Severity;
  symptoms: string[];
  observationTime: string;
}

export interface ObservationNormalization {
  temperatureC?: number;
  leafWetness: LeafWetness;
  windEstimateKph: number;
}

export interface GeoPoint {
  lat: number;
  lon: number;
}
