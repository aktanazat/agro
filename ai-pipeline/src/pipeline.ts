import type {
  CapturePayload,
  Observation,
  ValidatedObservation,
  ExtractionAdapter,
  ExtractionAdapterResult,
} from "./types";
import { extractFromText } from "./extractor";
import { validateObservation } from "./validator";
import { evaluateGating } from "./gating";
import { PipelineTracer } from "./tracer";
import { computeChecksum } from "./checksum";

const DEMO_DEVICE_ID = "dev_ios_001";
const DEMO_LOCATION = { lat: 38.2919, lon: -122.458 };
const DEMO_TRACE_ID = "trace_20260211_demo_01";

export interface PipelineConfig {
  deviceId?: string;
  location?: { lat: number; lon: number };
  traceId?: string;
}

export function createExtractionAdapter(config?: PipelineConfig): ExtractionAdapter {
  const deviceId = config?.deviceId ?? DEMO_DEVICE_ID;
  const location = config?.location ?? DEMO_LOCATION;
  const traceId = config?.traceId ?? DEMO_TRACE_ID;

  return {
    extract: (payload) => runPipeline(payload, deviceId, location, traceId),
  };
}

async function runPipeline(
  payload: CapturePayload,
  deviceId: string,
  location: { lat: number; lon: number },
  traceId: string,
): Promise<ExtractionAdapterResult> {
  const tracer = new PipelineTracer(traceId);
  const now = new Date().toISOString();

  // Stage 1: Capture received
  tracer.begin("capture_received");
  const { observationId, captureMode, rawNoteText, transcription } = payload;
  tracer.end("capture_received", "ok");

  // Stage 2: Resolve transcription (typed fallback branch)
  tracer.begin("transcription_resolved");
  const resolvedTranscription =
    captureMode === "typed"
      ? { text: rawNoteText, source: "manual_typed" as const, confidence: 1.0 }
      : transcription;
  const isFallback = captureMode === "typed" && transcription.source !== "manual_typed";
  tracer.end("transcription_resolved", isFallback ? "fallback" : "ok", isFallback ? { ai_runtime_fallback_used: true } : undefined);

  // Stage 3: Extract fields
  tracer.begin("extraction_complete");
  const { extraction, normalization } = extractFromText(resolvedTranscription.text, now);
  tracer.end("extraction_complete", "ok");

  // Stage 4: Build candidate observation
  tracer.begin("normalization_complete");
  const candidate: Record<string, unknown> = {
    observationId,
    deviceId,
    createdAt: now,
    captureMode,
    rawNoteText,
    transcription: resolvedTranscription,
    extraction,
    normalization,
    location,
    status: "draft",
    schemaVersion: "1.0.0",
    deterministicChecksum: "",
  };
  candidate.deterministicChecksum = computeChecksum(candidate);
  tracer.end("normalization_complete", "ok");

  // Stage 5: Validate
  tracer.begin("validation_complete");
  const validation = validateObservation(candidate);
  tracer.end("validation_complete", validation.valid ? "ok" : "error");

  // Stage 6: Gate
  tracer.begin("gating_complete");
  const gating = evaluateGating(resolvedTranscription.confidence, validation);
  tracer.end("gating_complete", gating.decision === "blocked" ? "error" : "ok");

  const obs = candidate as unknown as Observation;

  if (gating.decision === "auto_confirm") {
    const confirmed: ValidatedObservation = { ...obs, status: "confirmed" };
    confirmed.deterministicChecksum = computeChecksum(confirmed as unknown as Record<string, unknown>);

    tracer.begin("observation_ready");
    tracer.end("observation_ready", "ok");

    return { ok: true, observation: confirmed, trace: tracer.getEvents() };
  }

  return { ok: false, gating, draft: obs, trace: tracer.getEvents() };
}
