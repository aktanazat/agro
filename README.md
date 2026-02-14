# FieldScout Copilot

Turn a field worker's voice note into structured scouting data and a time-bounded recommendation window, on-device by default, with optional sync and a live-editable agronomy playbook.

## Hackathon MVP (5 hours)
- Offline iOS-first demo path from note capture to recommendation confirmation in under 90 seconds.
- On-device extraction constrained to `Observation` schema (`contracts/schemas/Observation.json`).
- Deterministic recommendation from local `Playbook` rules + bundled `WeatherFeatures` demo profile.
- Live playbook patch (`PlaybookPatch`) with version bump and immediate recompute.
- Optional sync contract shown via OpenAPI and example payloads; backend can be mocked.

## Post-hack Hardening (2-4 weeks)
- Production auth, encrypted sync storage, and server reconciliation telemetry.
- Expanded crop packs, stronger ASR model selection by device class, and broader weather providers.
- Field-trial calibration and safety review for agronomy actions.

## Tooling and integration
- Execution plan: `docs/13_tooling_integration_plan.md`
- Parallel delivery plan: `docs/14_parallel_5h_execution.md`
- Architecture wiring: `docs/02_architecture.md`
- Weather seam hookup: `docs/06_sorcerer_connector_seam.md`
- Patch/recompute seam hookup: `docs/07_morph_fast_apply_playbook_patch.md`
- Optional sync choreography: `docs/08_backend_sync.md`

MVP tool choices are locked to keep delivery speed high:
- Mobile: React Native (iOS-first target)
- On-device inference: Cactus SDK with quantized runtime
- Weather seam: Demo JSON by default, optional Synoptic Live Mode
- Fast apply seam: local bounded patch engine, optional Morph API assist

## 90-second demo script (exact)
| Time | Action | Expected Output |
| --- | --- | --- |
| 0-10s | Open Home, tap **New Observation** | New Observation screen shows `deviceId=dev_ios_001`, offline badge ON |
| 10-28s | Hold record and speak the mildew note from `docs/01_demo_script.md` | Transcript appears with ASR confidence >= 0.90 |
| 28-42s | Tap **Structure Note** | Draft `Observation` populated: `obs_20260211_0001`, issue `powdery_mildew`, severity `moderate`, block `Block 7` |
| 42-58s | Tap **Generate Recommendation** | `rec_20260211_0001` shows action + timing window `2026-02-11T21:00:00-08:00` to `2026-02-12T00:30:00-08:00` with drivers from `wxf_20260211_demo_01` |
| 58-70s | Tap **Confirm & Log**, then **Share** | History row created with status `confirmed`; share payload preview contains observation + recommendation IDs |
| 70-90s | Open Playbook Editor, apply patch `pch_20260211_0001` (max wind 12 -> 10), auto-recompute | Playbook version `3 -> 4`; recomputed `rec_20260211_0002` window tightens to `2026-02-11T21:15:00-08:00` to `2026-02-11T23:30:00-08:00` |

## What is real vs mocked
| Area | MVP in demo | Mocked seam |
| --- | --- | --- |
| Voice capture and typed fallback | Real mobile capture UI flow | None |
| Schema-constrained extraction | Real contract + deterministic parser/LLM output gate | Model internals can be stubbed if needed |
| Recommendation engine | Real local rules evaluation from `Playbook` + `WeatherFeatures` | None |
| Sorcerer/Synoptic weather path | Real provider-agnostic interface + derived-feature logic | Live API call may be disabled; Demo Mode uses bundled profile JSON |
| Backend sync | Real request/response contracts, idempotency, conflict rules | Live service optional |
| Morph-style fast apply | Real patch contract + apply/validate/version/recompute flow | None |

## Sponsor visibility mapping
| Sponsor/Judge | What they should notice in demo |
| --- | --- |
| Cactus | On-device, quantized, schema-locked extraction and recommendation path works fully offline in <90s. |
| Sorcerer (Austin Tindle) | Recommendation timing is influenced by upper-air-derived features (inversion, humidity layering, shear proxy), not surface-only weather. |
| Tellia (Coline Labadie de Fay) | Voice-first field capture with direct transition into structured record, plus typed fallback with identical downstream behavior. |
| Morph | Live playbook edit is applied as a bounded patch with validation, version bump, audit trail, and immediate recompute. |
