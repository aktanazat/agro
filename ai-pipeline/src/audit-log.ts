export type AuditEventType =
  | "observation.created"
  | "observation.confirmed"
  | "extraction.completed"
  | "extraction.fallback_used"
  | "validation.passed"
  | "validation.failed"
  | "gating.auto_confirm"
  | "gating.manual_review"
  | "gating.blocked"
  | "recommendation.generated"
  | "recommendation.confirmed"
  | "playbook.patch_applied"
  | "playbook.patch_rejected"
  | "recommendation.recomputed";

export interface AuditEvent {
  timestamp: string;
  event: AuditEventType;
  entityId: string;
  detail: string;
  causedBy?: string;
  deviceId?: string;
  raw: unknown;
}

interface ObservationLike {
  observationId: string;
  deviceId: string;
  createdAt: string;
  captureMode: string;
  status: string;
  deterministicChecksum: string;
  extraction: {
    crop: string;
    variety?: string | null;
    fieldBlock: string;
    issue: string;
    severity: string;
  };
}

interface RecommendationLike {
  recommendationId: string;
  playbookVersion: number;
  generatedAt: string;
  action: string;
  timingWindow: { startAt: string; endAt: string; confidence: number };
}

interface PatchLike {
  patchId: string;
  playbookId: string;
  baseVersion: number;
  requestedByDeviceId: string;
  requestedAt: string;
  operations: { op: string; path: string; value?: unknown }[];
}

interface PatchResultLike {
  patchId: string;
  oldVersion: number;
  newVersion: number;
  status: string;
  recomputedRecommendationId: string | null;
  appliedAt: string;
}

export function buildAuditLog(params: {
  observation?: ObservationLike;
  recommendations?: RecommendationLike[];
  patch?: PatchLike;
  patchResult?: PatchResultLike;
  recomputedRecommendation?: RecommendationLike;
  extractionFallback?: boolean;
}): AuditEvent[] {
  const events: AuditEvent[] = [];
  const { observation, recommendations, patch, patchResult, recomputedRecommendation, extractionFallback } = params;

  if (observation) {
    events.push({
      timestamp: observation.createdAt,
      event: "observation.created",
      entityId: observation.observationId,
      deviceId: observation.deviceId,
      detail: `${observation.extraction.fieldBlock} ${observation.extraction.crop} -- ${observation.extraction.issue} (${observation.extraction.severity})`,
      raw: observation,
    });

    if (extractionFallback) {
      events.push({
        timestamp: observation.createdAt,
        event: "extraction.fallback_used",
        entityId: observation.observationId,
        deviceId: observation.deviceId,
        detail: "Cactus runtime unavailable, used rule-based extraction",
        raw: { observationId: observation.observationId, fallback: true },
      });
    }

    events.push({
      timestamp: observation.createdAt,
      event: "extraction.completed",
      entityId: observation.observationId,
      detail: `${observation.extraction.issue} / ${observation.extraction.severity} in ${observation.extraction.fieldBlock}`,
      raw: observation.extraction,
    });

    events.push({
      timestamp: observation.createdAt,
      event: "validation.passed",
      entityId: observation.observationId,
      detail: `Schema valid | checksum ${observation.deterministicChecksum}`,
      raw: { observationId: observation.observationId, checksum: observation.deterministicChecksum },
    });

    if (observation.status === "confirmed") {
      events.push({
        timestamp: observation.createdAt,
        event: "observation.confirmed",
        entityId: observation.observationId,
        detail: `Status -> confirmed | checksum ${observation.deterministicChecksum}`,
        raw: { observationId: observation.observationId, status: observation.status, checksum: observation.deterministicChecksum },
      });
    }
  }

  const primaryRec = recommendations?.find((r) => r !== recomputedRecommendation);
  if (primaryRec) {
    events.push({
      timestamp: primaryRec.generatedAt,
      event: "recommendation.generated",
      entityId: primaryRec.recommendationId,
      detail: `${primaryRec.action} | window ${formatTime(primaryRec.timingWindow.startAt)} -- ${formatTime(primaryRec.timingWindow.endAt)}`,
      raw: primaryRec,
    });
  }

  if (patch && patchResult) {
    const applied = patchResult.status === "applied";
    events.push({
      timestamp: patchResult.appliedAt,
      event: applied ? "playbook.patch_applied" : "playbook.patch_rejected",
      entityId: patch.patchId,
      deviceId: patch.requestedByDeviceId,
      detail: applied
        ? `${patch.playbookId} v${patchResult.oldVersion} -> v${patchResult.newVersion} | ${patch.operations[0]?.path}: ${patch.operations[0]?.value}`
        : `${patch.playbookId} patch rejected`,
      raw: patch,
    });
  }

  if (recomputedRecommendation && patchResult) {
    events.push({
      timestamp: recomputedRecommendation.generatedAt,
      event: "recommendation.recomputed",
      entityId: recomputedRecommendation.recommendationId,
      detail: `Recomputed window ${formatTime(recomputedRecommendation.timingWindow.startAt)} -- ${formatTime(recomputedRecommendation.timingWindow.endAt)}`,
      causedBy: patchResult.patchId,
      raw: recomputedRecommendation,
    });
  }

  return events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

function formatTime(iso: string): string {
  const m = iso.match(/T(\d{2}:\d{2}:\d{2})/);
  return m ? m[1] : iso;
}
