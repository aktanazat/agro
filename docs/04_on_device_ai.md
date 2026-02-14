# On-Device AI Plan

## Pipeline stages
| Stage | Input | Output | Contract |
| --- | --- | --- | --- |
| 1. Capture | Voice frames or typed note | raw text candidate | internal mobile state |
| 2. Local transcription (optional) | Voice frames | transcript text + confidence + source | `Observation.transcription` |
| 3. Schema extraction | transcript/typed text | structured fields | `Observation.extraction` |
| 4. Normalization | extraction fields | canonical labels/units | `Observation.normalization` |
| 5. Validation | full candidate observation | pass/fail + errors | `Observation` JSON schema |
| 6. Recommendation input handoff | validated observation | deterministic recommendation request | `Recommendation` input tuple |

## Determinism strategy
1. Constrain extraction output to fixed enums and typed fields from `contracts/schemas/Observation.json`.
2. Validate every candidate against JSON schema before it can be logged.
3. Reject unknown fields and invalid enum values; surface editable form for correction.
4. Use fixed model settings for extraction (`temperature=0`, bounded output tokens).
5. Persist `deterministicChecksum` on `Observation` to detect accidental mutation before recommendation.
6. Require user confirmation before status moves to `confirmed`.

## Confidence and confirmation loop
| Condition | Behavior |
| --- | --- |
| transcription confidence >= 0.85 and schema valid | auto-fill Review/Edit and highlight only editable fields |
| transcription confidence < 0.85 | keep transcript but require manual field review before recommendation |
| extraction schema invalid | show exact field errors and block recommendation |
| recommendation generated | require explicit user confirmation (`requiredConfirmation=true`) |

## Model strategy
- No model training in hackathon.
- Use small, quantized on-device models suitable for commodity phones.
- Candidate setup:
- ASR: quantized small-footprint model (or platform ASR) with offline support.
- Extraction: quantized instruction model with strict schema output constraints.
- Runtime limits for MVP:
- RAM budget <= 2 GB total app usage during inference.
- Extraction latency <= 15 seconds on demo device.
- Model package footprint <= 250 MB.

## Tool hookup prototype (Cactus runtime)
```text
runtime = cactus.init()
runtime.loadModel(modelId="cactus_extract_q4", quantization="int4")
runtime.setDeterministicMode(true)

prompt = build_schema_prompt(rawNoteText, targetSchema=Observation.extraction)
candidateJson = runtime.generate(prompt, temperature=0, maxTokens=256)
extraction = parse_json(candidateJson)
validate extraction against Observation.extraction schema
```

If runtime/model init fails:
1. route to typed/manual field confirmation path,
2. keep schema validator mandatory,
3. flag trace event as `ai_runtime_fallback_used`.

## Evaluation harness plan (10 notes)
Goal: verify deterministic schema fill for core fields: `crop`, `fieldBlock`, `issue`, `severity`, `symptoms`, and recommendation eligibility.

| Case ID | Note theme | Expected issue | Expected severity | Expected recommendation eligibility |
| --- | --- | --- | --- | --- |
| `eval_01` | Powdery mildew moderate, dry leaves | `powdery_mildew` | `moderate` | yes |
| `eval_02` | Powdery mildew early mild spots | `powdery_mildew` | `low` | yes |
| `eval_03` | Powdery mildew heavy spread | `powdery_mildew` | `high` | yes |
| `eval_04` | Heat stress midday leaf curl | `heat_stress` | `moderate` | yes |
| `eval_05` | Heat stress severe wilting | `heat_stress` | `high` | yes |
| `eval_06` | Vague note missing block | `other` | `low` | blocked until edit |
| `eval_07` | Conflicting severity words | `powdery_mildew` | `moderate` | yes after confirmation |
| `eval_08` | Mixed mildew + irrigation concern | `powdery_mildew` | `moderate` | yes |
| `eval_09` | Typed fallback mildew note | `powdery_mildew` | `moderate` | yes |
| `eval_10` | Noise-heavy short transcript | `other` | `low` | blocked until edit |

## Hackathon MVP (5 hours)
- Run harness manually with 10 prepared notes and log pass/fail in a table.
- Prioritize deterministic schema validity over broad language coverage.
- Keep confidence handling simple and explicit.
- Lock one quantized model package and avoid model switching during demo.

## Post-hack Hardening (2-4 weeks)
- Expand harness to 100+ notes with accent/noise variability.
- Add per-field precision/recall tracking and drift alerts.
- Add adversarial input tests for prompt injection and malformed content.
- Add model fallback matrix by device class and memory profile.
