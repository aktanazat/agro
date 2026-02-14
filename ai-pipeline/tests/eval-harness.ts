import { createExtractionAdapter } from "../src/pipeline";
import type { CapturePayload } from "../src/types";
import evalNotes from "../fixtures/eval-notes.json";
import { validateObservation } from "../src/validator";

type Eligibility = "yes" | "yes_after_confirmation" | "blocked_until_edit";

interface EvalCase {
  caseId: string;
  noteText: string;
  captureMode: "voice" | "typed";
  confidence: number;
  expected: {
    crop: string;
    fieldBlock: string;
    issue: string;
    severity: string;
    symptoms: string[];
    recommendationEligible: Eligibility;
  };
}

function deriveEligibility(ok: boolean, decision: string): Eligibility {
  if (ok) return "yes";
  if (decision === "manual_review") return "yes_after_confirmation";
  return "blocked_until_edit";
}

async function runEval() {
  const adapter = createExtractionAdapter();
  let coreCorrect = 0;
  let schemaValid = 0;
  let eligibilityCorrect = 0;
  const total = evalNotes.length;

  console.log(`Running ${total} eval cases...\n`);

  for (const c of evalNotes as EvalCase[]) {
    const payload: CapturePayload = {
      observationId: "obs_20260211_0001",
      captureMode: c.captureMode,
      rawNoteText: c.noteText,
      transcription: {
        text: c.noteText,
        source: c.captureMode === "typed" ? "manual_typed" : "on_device_asr",
        confidence: c.confidence,
      },
    };

    const result = await adapter.extract(payload);
    const obs = result.ok ? result.observation : result.draft;
    const validation = validateObservation(obs);
    const decision = result.ok ? "auto_confirm" : result.gating.decision;
    const eligibility = deriveEligibility(result.ok, decision);

    if (validation.valid) schemaValid++;

    const ext = obs.extraction;
    const fieldMatch =
      ext.crop === c.expected.crop &&
      ext.fieldBlock === c.expected.fieldBlock &&
      ext.issue === c.expected.issue &&
      ext.severity === c.expected.severity;

    if (fieldMatch) coreCorrect++;

    const eligMatch = eligibility === c.expected.recommendationEligible;
    if (eligMatch) eligibilityCorrect++;

    const status = fieldMatch && validation.valid && eligMatch ? "PASS" : "FAIL";
    console.log(`  ${c.caseId}: ${status}`);
    if (!fieldMatch) {
      console.log(`    fields: got {${ext.issue}, ${ext.severity}, ${ext.fieldBlock}} expected {${c.expected.issue}, ${c.expected.severity}, ${c.expected.fieldBlock}}`);
    }
    if (!eligMatch) {
      console.log(`    eligibility: got ${eligibility} expected ${c.expected.recommendationEligible}`);
    }
    if (!validation.valid) {
      console.log(`    schema errors:`, validation.errors.map((e) => `${e.field}: ${e.message}`).join(", "));
    }
  }

  console.log(`\nCore fields: ${coreCorrect}/${total} (target: >= ${total - 1})`);
  console.log(`Schema valid: ${schemaValid}/${total} (target: ${total}/${total})`);
  console.log(`Eligibility: ${eligibilityCorrect}/${total}`);

  const pass = coreCorrect >= total - 1 && schemaValid === total;
  console.log(`\nOverall: ${pass ? "PASS" : "FAIL"}`);
  process.exit(pass ? 0 : 1);
}

runEval();
