import type { GatingResult, GatingDecision, FieldError, ValidationResult } from "./types";

const CONFIDENCE_THRESHOLD = 0.85;

export function evaluateGating(
  transcriptionConfidence: number,
  validationResult: ValidationResult,
): GatingResult {
  if (!validationResult.valid) {
    return {
      decision: "blocked",
      reason: `Schema validation failed: ${validationResult.errors.length} field error(s)`,
      fieldErrors: validationResult.errors,
    };
  }

  const decision: GatingDecision =
    transcriptionConfidence >= CONFIDENCE_THRESHOLD ? "auto_confirm" : "manual_review";

  const reason =
    decision === "auto_confirm"
      ? `Confidence ${transcriptionConfidence} >= ${CONFIDENCE_THRESHOLD}, auto-confirming`
      : `Confidence ${transcriptionConfidence} < ${CONFIDENCE_THRESHOLD}, requires manual review`;

  return { decision, reason, fieldErrors: [] };
}
