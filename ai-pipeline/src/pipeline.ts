import type {
  CapturePayload,
  Observation,
  ValidatedObservation,
  ExtractionAdapter,
  ExtractionAdapterResult,
  ExtractionResult,
  ErrorEnvelope,
} from "./types";
import { extractFromText } from "./extractor";
import { validateObservation } from "./validator";
import { evaluateGating } from "./gating";
import { PipelineTracer } from "./tracer";
import { computeChecksum } from "./checksum";
import { CactusStub, tryExtractWithCactus, CACTUS_CONSTRAINTS } from "./cactus-stub";
import type { CactusRuntime } from "./cactus-stub";

const DEMO_DEVICE_ID = "dev_ios_001";
const DEMO_LOCATION = { lat: 38.2919, lon: -122.458 };
const DEMO_TRACE_ID = "trace_20260211_demo_01";

export interface PipelineConfig {
  deviceId?: string;
  location?: { lat: number; lon: number };
  traceId?: string;
  cactusRuntime?: CactusRuntime;
}

export function createExtractionAdapter(config?: PipelineConfig): ExtractionAdapter {
  const deviceId = config?.deviceId ?? DEMO_DEVICE_ID;
  const location = config?.location ?? DEMO_LOCATION;
  const traceId = config?.traceId ?? DEMO_TRACE_ID;
  const cactus = config?.cactusRuntime ?? null;

  return {
    extract: (payload) => runPipeline(payload, deviceId, location, traceId, cactus),
  };
}

function makeErrorEnvelope(
  observationId: string,
  traceId: string,
  message: string,
  details?: Record<string, unknown>,
): ErrorEnvelope {
  return {
    requestId: `req_${observationId}`,
    timestamp: new Date().toISOString(),
    error: {
      code: "VALIDATION_ERROR",
      message,
      retryable: false,
      traceId,
      ...(details ? { details } : {}),
    },
  };
}

async function runPipeline(
  payload: CapturePayload,
  deviceId: string,
  location: { lat: number; lon: number },
  traceId: string,
  cactus: CactusRuntime | null,
): Promise<ExtractionAdapterResult> {
  const tracer = new PipelineTracer(traceId);
  const now = new Date().toISOString();

  // Stage 1: Capture received
  tracer.begin("capture_received");
  const { observationId, captureMode, rawNoteText, transcription } = payload;
  tracer.end("capture_received", "ok", { observationId });

  // Stage 2: Resolve transcription (typed fallback branch)
  tracer.begin("transcription_resolved");
  const resolvedTranscription =
    captureMode === "typed"
      ? { text: rawNoteText, source: "manual_typed" as const, confidence: 1.0 }
      : transcription;
  tracer.end("transcription_resolved", "ok", { observationId });

  // Stage 3: Extract fields -- try Cactus first, fallback to regex
  tracer.begin("extraction_complete");
  let extractionResult: ExtractionResult;
  let usedRuntimeFallback = false;

  if (cactus && captureMode !== "typed") {
    const cactusResult = await tryExtractWithCactus(cactus, resolvedTranscription.text, now);
    if (cactusResult.ok) {
      const normalization = extractFromText(resolvedTranscription.text, now).normalization;
      extractionResult = { extraction: cactusResult.extraction, normalization };
    } else {
      usedRuntimeFallback = true;
      extractionResult = extractFromText(resolvedTranscription.text, now);
    }
  } else {
    if (captureMode !== "typed" && !cactus) {
      usedRuntimeFallback = true;
    }
    extractionResult = extractFromText(resolvedTranscription.text, now);
  }

  tracer.end("extraction_complete", usedRuntimeFallback ? "fallback" : "ok", {
    observationId,
    ...(usedRuntimeFallback ? { ai_runtime_fallback_used: true } : {}),
  });

  const { extraction, normalization } = extractionResult;

  // Stage 4: Build candidate observation
  tracer.begin("normalization_complete");
  const candidate: Observation = {
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
  candidate.deterministicChecksum = computeChecksum(candidate as unknown as Record<string, unknown>);
  tracer.end("normalization_complete", "ok", { observationId });

  // Stage 5: Validate
  tracer.begin("validation_complete");
  const validation = validateObservation(candidate);
  tracer.end("validation_complete", validation.valid ? "ok" : "error", { observationId });

  // Stage 6: Gate
  tracer.begin("gating_complete");
  const gating = evaluateGating(resolvedTranscription.confidence, validation);
  tracer.end("gating_complete", gating.decision === "blocked" ? "error" : "ok", { observationId });

  if (gating.decision === "auto_confirm") {
    const confirmed: ValidatedObservation = { ...candidate, status: "confirmed" };
    confirmed.deterministicChecksum = computeChecksum(confirmed as unknown as Record<string, unknown>);

    tracer.begin("observation_ready");
    tracer.end("observation_ready", "ok", { observationId });

    return { ok: true, observation: confirmed, trace: tracer.getEvents() };
  }

  const errorEnvelope = makeErrorEnvelope(
    observationId,
    traceId,
    gating.decision === "blocked"
      ? `Schema validation failed: ${gating.fieldErrors.map((e) => e.field).join(", ")}`
      : `Confidence ${resolvedTranscription.confidence} below threshold, manual review required`,
    gating.decision === "blocked"
      ? { fields: gating.fieldErrors }
      : { confidence: resolvedTranscription.confidence },
  );

  return { ok: false, error: errorEnvelope, gating, draft: candidate, trace: tracer.getEvents() };
}
