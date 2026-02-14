import type {
  Observation,
  ObservationExtraction,
  ObservationNormalization,
  ObservationTranscription,
  ObservationStatus,
  CaptureMode,
  TranscriptionSource,
} from "../../contracts/typescript/Observation";

import type { ErrorEnvelope } from "../../contracts/typescript/ErrorEnvelope";

// Re-export contract types used across the pipeline
export type {
  Observation,
  ObservationExtraction,
  ObservationNormalization,
  ObservationTranscription,
  ObservationStatus,
  CaptureMode,
  TranscriptionSource,
  ErrorEnvelope,
};

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
  | { ok: false; gating: GatingResult; draft: Observation; trace: TraceEvent[] };
