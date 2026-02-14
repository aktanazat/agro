// Pipeline core
export { createExtractionAdapter } from "./pipeline";
export type { PipelineConfig } from "./pipeline";
export { validateObservation } from "./validator";
export { extractFromText } from "./extractor";
export { evaluateGating } from "./gating";
export { PipelineTracer } from "./tracer";
export { computeChecksum } from "./checksum";

// Cactus runtime
export { CactusStub, tryExtractWithCactus, buildSchemaPrompt, CACTUS_CONSTRAINTS } from "./cactus-stub";
export type { CactusRuntime, CactusConfig } from "./cactus-stub";

// Trace thresholds
export {
  TRACE_THRESHOLDS,
  FULL_LOOP_MAX_MS,
  evaluateThresholds,
  deriveOverallStatus,
} from "./thresholds";
export type { TraceThreshold, TraceThresholdResult, OverallStatus } from "./thresholds";

// Audit log
export { buildAuditLog } from "./audit-log";
export type { AuditEvent, AuditEventType } from "./audit-log";

// Share payload
export { buildSharePayload, buildShareSummary } from "./share-payload";
export type { SharePayload } from "./share-payload";

// Pipeline status
export { getPipelineStatus, formatInferenceLabel } from "./pipeline-status";
export type { PipelineStatus, InferenceMode, WeatherMode, DataMode } from "./pipeline-status";

// Contract types
export * from "./types";
