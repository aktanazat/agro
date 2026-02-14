// Contract types inlined from contracts/typescript/ (deleted by iOS lane merge).
// Source of truth remains contracts/schemas/Observation.json and ErrorEnvelope.json.

export type CaptureMode = "voice" | "typed";
export type TranscriptionSource = "on_device_asr" | "manual_typed" | "none";
export type Crop = "grape";
export type Issue = "powdery_mildew" | "heat_stress" | "other";
export type Severity = "low" | "moderate" | "high";
export type LeafWetness = "dry" | "damp" | "wet" | "unknown";
export type ObservationStatus = "draft" | "confirmed" | "logged";

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

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "AUTH_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "PLAYBOOK_PATCH_PATH_NOT_ALLOWED"
  | "PLAYBOOK_VERSION_MISMATCH"
  | "INTERNAL_ERROR";

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  traceId: string;
  details?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  requestId: string;
  timestamp: string;
  error: ErrorBody;
}

// --- Person A -> Person B handshake ---

export interface CapturePayload {
  observationId: string;
  captureMode: CaptureMode;
  rawNoteText: string;
  transcription: {
    text: string;
    source: TranscriptionSource;
    confidence: number;
  };
}

// --- Person B internal types ---

export interface ExtractionResult {
  extraction: ObservationExtraction;
  normalization: ObservationNormalization;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
  value?: unknown;
}

export type GatingDecision = "auto_confirm" | "manual_review" | "blocked";

export interface GatingResult {
  decision: GatingDecision;
  reason: string;
  fieldErrors: FieldError[];
}

// --- Person B -> Person C handshake ---

export interface ValidatedObservation extends Observation {
  status: "confirmed";
}

// --- Trace ---

export type TraceStage =
  | "capture_received"
  | "transcription_resolved"
  | "extraction_complete"
  | "normalization_complete"
  | "validation_complete"
  | "gating_complete"
  | "observation_ready";

export interface TraceEvent {
  traceId: string;
  stage: TraceStage;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  status: "ok" | "error" | "fallback";
  observationId?: string;
  metadata?: Record<string, unknown>;
}

// --- Adapter interface ---

export interface ExtractionAdapter {
  extract(payload: CapturePayload): Promise<ExtractionAdapterResult>;
}

export type ExtractionAdapterResult =
  | { ok: true; observation: ValidatedObservation; trace: TraceEvent[] }
  | { ok: false; error: ErrorEnvelope; gating: GatingResult; draft: Observation; trace: TraceEvent[] };
