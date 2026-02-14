export interface TraceThreshold {
  label: string;
  maxMs: number;
}

export const TRACE_THRESHOLDS: TraceThreshold[] = [
  { label: "Record -> Transcript", maxMs: 8_000 },
  { label: "Transcript -> Observation", maxMs: 15_000 },
  { label: "Recommendation", maxMs: 5_000 },
  { label: "Patch + Recompute", maxMs: 4_000 },
  { label: "Full Loop", maxMs: 90_000 },
];

export const FULL_LOOP_MAX_MS = 90_000;

export interface TraceThresholdResult {
  label: string;
  maxMs: number;
  actualMs: number;
  pass: boolean;
}

export function evaluateThresholds(
  stageTimings: Record<string, number>,
  totalDurationMs: number,
): TraceThresholdResult[] {
  return TRACE_THRESHOLDS.map((t) => {
    let actualMs: number;
    switch (t.label) {
      case "Record -> Transcript":
        actualMs = stageTimings["transcribing"] ?? stageTimings["transcription_resolved"] ?? 0;
        break;
      case "Transcript -> Observation":
        actualMs = stageTimings["extracting"] ?? stageTimings["extraction_complete"] ?? 0;
        break;
      case "Recommendation":
        actualMs = stageTimings["recommending"] ?? 0;
        break;
      case "Patch + Recompute":
        actualMs = (stageTimings["patch_apply"] ?? 0) + (stageTimings["recompute"] ?? 0);
        break;
      case "Full Loop":
        actualMs = totalDurationMs;
        break;
      default:
        actualMs = 0;
    }
    return { label: t.label, maxMs: t.maxMs, actualMs, pass: actualMs <= t.maxMs };
  });
}

export type OverallStatus = "PASS" | "WARN" | "FAIL";

export function deriveOverallStatus(
  totalDurationMs: number,
  thresholdResults: TraceThresholdResult[],
): OverallStatus {
  if (totalDurationMs > FULL_LOOP_MAX_MS) return "FAIL";
  if (thresholdResults.some((t) => !t.pass)) return "WARN";
  return "PASS";
}
