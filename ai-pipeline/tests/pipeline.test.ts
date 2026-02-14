import { describe, it, expect } from "vitest";
import { createExtractionAdapter } from "../src/pipeline";
import { validateObservation } from "../src/validator";
import { extractFromText } from "../src/extractor";
import { evaluateGating } from "../src/gating";
import { CactusStub } from "../src/cactus-stub";
import type { CapturePayload } from "../src/types";
import canonicalCapture from "../fixtures/canonical-capture.json";
import canonicalObservation from "../fixtures/canonical-observation.json";

const CANONICAL_PAYLOAD = canonicalCapture as CapturePayload;

describe("validator", () => {
  it("accepts canonical observation", () => {
    const result = validateObservation(canonicalObservation);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects invalid observationId pattern", () => {
    const result = validateObservation({ ...canonicalObservation, observationId: "bad" });
    expect(result.valid).toBe(false);
    expect(result.errors[0].field).toBe("observationId");
  });

  it("rejects missing required field", () => {
    const { extraction: _, ...rest } = canonicalObservation;
    const result = validateObservation(rest);
    expect(result.valid).toBe(false);
  });

  it("rejects invalid enum value", () => {
    const bad = {
      ...canonicalObservation,
      extraction: { ...canonicalObservation.extraction, issue: "invalid_issue" },
    };
    const result = validateObservation(bad);
    expect(result.valid).toBe(false);
  });
});

describe("extractor", () => {
  it("extracts canonical note correctly", () => {
    const result = extractFromText(CANONICAL_PAYLOAD.rawNoteText, "2026-02-11T10:30:00-08:00");
    expect(result.extraction.crop).toBe("grape");
    expect(result.extraction.fieldBlock).toBe("Block 7");
    expect(result.extraction.issue).toBe("powdery_mildew");
    expect(result.extraction.severity).toBe("moderate");
    expect(result.extraction.variety).toBe("chardonnay");
    expect(result.extraction.symptoms).toContain("white powder on upper leaf surfaces");
    expect(result.normalization.leafWetness).toBe("dry");
    expect(result.normalization.windEstimateKph).toBe(8);
  });

  it("returns other/low for vague notes", () => {
    const result = extractFromText("something wrong with vines", "2026-02-11T10:30:00-08:00");
    expect(result.extraction.issue).toBe("other");
    expect(result.extraction.severity).toBe("low");
  });
});

describe("gating", () => {
  it("auto-confirms at confidence >= 0.85", () => {
    const result = evaluateGating(0.93, { valid: true, errors: [] });
    expect(result.decision).toBe("auto_confirm");
  });

  it("requires manual review below 0.85", () => {
    const result = evaluateGating(0.72, { valid: true, errors: [] });
    expect(result.decision).toBe("manual_review");
  });

  it("blocks on schema failure", () => {
    const result = evaluateGating(0.95, {
      valid: false,
      errors: [{ field: "issue", message: "invalid" }],
    });
    expect(result.decision).toBe("blocked");
    expect(result.fieldErrors).toHaveLength(1);
  });
});

describe("pipeline", () => {
  it("produces confirmed observation from canonical capture", async () => {
    const adapter = createExtractionAdapter();
    const result = await adapter.extract(CANONICAL_PAYLOAD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.observation.status).toBe("confirmed");
    expect(result.observation.observationId).toBe("obs_20260211_0001");
    expect(result.observation.extraction.issue).toBe("powdery_mildew");

    const validation = validateObservation(result.observation);
    expect(validation.valid).toBe(true);
  });

  it("emits 7 trace events with observationId", async () => {
    const adapter = createExtractionAdapter();
    const result = await adapter.extract(CANONICAL_PAYLOAD);
    expect(result.trace).toHaveLength(7);
    expect(result.trace[0].traceId).toBe("trace_20260211_demo_01");
    expect(result.trace[0].metadata?.observationId).toBe("obs_20260211_0001");
  });

  it("handles typed fallback path", async () => {
    const adapter = createExtractionAdapter();
    const result = await adapter.extract({
      observationId: "obs_20260211_0001",
      captureMode: "typed",
      rawNoteText: "Block 6 Chardonnay. White powder on leaves, moderate.",
      transcription: { text: "", source: "none", confidence: 0 },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.observation.transcription.source).toBe("manual_typed");
    expect(result.observation.transcription.confidence).toBe(1.0);
    expect(result.observation.captureMode).toBe("typed");
  });

  it("routes low confidence to manual review with ErrorEnvelope", async () => {
    const adapter = createExtractionAdapter();
    const result = await adapter.extract({
      observationId: "obs_20260211_0001",
      captureMode: "voice",
      rawNoteText: "Block 7, some mildew",
      transcription: { text: "Block 7, some mildew", source: "on_device_asr", confidence: 0.60 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.gating.decision).toBe("manual_review");
    expect(result.error.error.code).toBe("VALIDATION_ERROR");
    expect(result.error.requestId).toBe("req_obs_20260211_0001");
    expect(result.error.error.traceId).toBe("trace_20260211_demo_01");
  });

  it("flags ai_runtime_fallback_used when no cactus runtime", async () => {
    const adapter = createExtractionAdapter();
    const result = await adapter.extract(CANONICAL_PAYLOAD);

    const extractionTrace = result.trace.find((t) => t.stage === "extraction_complete");
    expect(extractionTrace?.status).toBe("fallback");
    expect(extractionTrace?.metadata?.ai_runtime_fallback_used).toBe(true);
  });

  it("does not flag fallback for typed input", async () => {
    const adapter = createExtractionAdapter();
    const result = await adapter.extract({
      observationId: "obs_20260211_0001",
      captureMode: "typed",
      rawNoteText: "Block 6 Chardonnay. White powder, moderate.",
      transcription: { text: "", source: "none", confidence: 0 },
    });

    const extractionTrace = result.trace.find((t) => t.stage === "extraction_complete");
    expect(extractionTrace?.status).toBe("ok");
    expect(extractionTrace?.metadata?.ai_runtime_fallback_used).toBeUndefined();
  });

  it("falls back to regex when cactus stub returns empty", async () => {
    const cactus = new CactusStub();
    await cactus.init();
    await cactus.loadModel("cactus_extract_q4", "int4");

    const adapter = createExtractionAdapter({ cactusRuntime: cactus });
    const result = await adapter.extract(CANONICAL_PAYLOAD);

    const extractionTrace = result.trace.find((t) => t.stage === "extraction_complete");
    expect(extractionTrace?.status).toBe("fallback");
    expect(extractionTrace?.metadata?.ai_runtime_fallback_used).toBe(true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.observation.extraction.issue).toBe("powdery_mildew");
  });

  it("completes extraction within latency budget", async () => {
    const adapter = createExtractionAdapter();
    const start = Date.now();
    await adapter.extract(CANONICAL_PAYLOAD);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(15_000);
  });
});
