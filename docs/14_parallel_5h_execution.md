# Parallel 5-Hour Execution Plan (3 People, No Waiting)

## Goal
Ship an offline demo of FieldScout Copilot in 5 hours with three people working in parallel and minimal blocking.

## Working principle
Nobody waits for another person to finish code. Each role builds against frozen contracts, local fixtures, and adapter stubs from minute 20 onward.

## Team lanes (always-on parallel)
| Person | Lane | Owns | Consumes | Produces |
| --- | --- | --- | --- | --- |
| Person A | Mobile UX lane | Screens, state machine, local storage, trace screen | `contracts/typescript/*`, fixture JSON | UI flow from Home -> Recommendation -> Patch -> Trace |
| Person B | AI pipeline lane | Capture to extraction orchestration, schema validation, deterministic gating | `Observation` schema, fixture note text | Validated `Observation` payloads and extraction adapter |
| Person C | Rules + seams lane | Recommendation engine, weather adapter seam, patch engine, optional sync stub | `Playbook`, `WeatherFeatures`, `PlaybookPatch` | `Recommendation`, `PatchApplyResult`, sync request/response stubs |

## Contract freeze (minute 0 to 20)
Required lock at minute 20:
- IDs and canonical objects remain fixed:
- `obs_20260211_0001`
- `rec_20260211_0001`
- `rec_20260211_0002`
- `pbk_yolo_grape`
- `wxf_20260211_demo_01`
- `pch_20260211_0001`
- No schema field renames after freeze.
- Any new field must be optional for MVP.

## Synchronous timeline with no-wait rules
| Time (local) | Person A (Mobile) | Person B (AI) | Person C (Rules/Seams) | Integration gate |
| --- | --- | --- | --- | --- |
| 0:00-0:20 | Create screen shells and navigation | Wire extraction interface signatures only | Wire recommendation/patch interface signatures only | Contract freeze complete |
| 0:20-1:00 | Build Home + New Observation + Review/Edit with fixture data | Build extraction from transcript/typed text to `Observation` draft | Build deterministic recommendation from fixture `Observation` + `Playbook` | Gate 1: schema validation passes locally |
| 1:00-1:45 | Connect Review/Edit to extraction adapter | Add schema validator and confidence gating | Add weather adapter Demo Mode and timing-window derivation | Gate 2: `rec_20260211_0001` generated locally |
| 1:45-2:30 | Build Recommendation + History + Share views | Add typed fallback branch and error surfaces | Build patch validate/apply/version bump/recompute | Gate 3: patch yields `rec_20260211_0002` |
| 2:30-3:15 | Build Playbook Editor and Trace screen | Emit per-stage trace events | Return rationale/risk flags and patch audit object | Gate 4: full offline loop once |
| 3:15-4:00 | UI polish and deterministic state transitions | Tune extraction latency and fallback behavior | Tune recommendation latency and failover behavior | Gate 5: end-to-end < 90s |
| 4:00-4:40 | Rehearsal path A (voice) | Rehearsal path B (typed fallback) | Rehearsal path C (patch + recompute) | Gate 6: three paths pass |
| 4:40-5:00 | Lock demo build and backup screenshots | Lock fixture payloads and logs | Lock playbook/patch fixtures and fallback scripts | Final go/no-go |

## No-wait implementation tactics
1. Fixture-first development
- Use fixture payloads from minute 20.
- Each lane develops against fixed request/response files, not live modules.

2. Adapter boundary rule
- Each cross-lane interaction must be through an adapter function that returns contract payloads.
- No direct imports across lanes for internal logic.

3. Branch and merge discipline
- Keep one branch per lane.
- Merge only at scheduled integration gates (1:00, 1:45, 2:30, 3:15, 4:00).
- If a merge breaks, rollback only the gate merge, not lane progress.

4. Definition of done per lane
- Person A done when UI can run from fixtures and render all required screens.
- Person B done when every output validates against `Observation.json`.
- Person C done when recommendation and patch outputs match canonical IDs and window changes.

## Communication protocol (every 15 minutes)
| Signal | Format | Owner |
| --- | --- | --- |
| Status | `green/yellow/red` + one blocker sentence | Each person |
| Deliverable heartbeat | latest passing payload ID or UI path | Each person |
| Contract drift alert | exact field/path proposal + impact | Initiator |

Rules:
- `yellow` means proceed with fallback, do not block others.
- `red` lasts maximum 10 minutes before fallback path is activated.
- Contract drift after minute 20 requires unanimous approval.

## Integration handshake contracts
### A -> B
`CapturePayload`
```json
{
  "observationId": "obs_20260211_0001",
  "captureMode": "voice",
  "rawNoteText": "Block 7 Chardonnay...",
  "transcription": {
    "text": "Block 7 Chardonnay...",
    "source": "on_device_asr",
    "confidence": 0.93
  }
}
```

### B -> C
`ValidatedObservation`
```json
{
  "observationId": "obs_20260211_0001",
  "schemaVersion": "1.0.0",
  "status": "confirmed",
  "extraction": {
    "issue": "powdery_mildew",
    "severity": "moderate",
    "fieldBlock": "Block 7"
  }
}
```

### C -> A
`RecommendationResult`
```json
{
  "recommendationId": "rec_20260211_0001",
  "observationId": "obs_20260211_0001",
  "playbookVersion": 3,
  "timingWindow": {
    "startAt": "2026-02-11T21:00:00-08:00",
    "endAt": "2026-02-12T00:30:00-08:00"
  }
}
```

`PatchRecomputeResult`
```json
{
  "patchId": "pch_20260211_0001",
  "newVersion": 4,
  "recomputedRecommendationId": "rec_20260211_0002"
}
```

## Fallback matrix (activate without debate)
| Trigger | Immediate fallback | Owner |
| --- | --- | --- |
| Voice transcription unstable | Switch demo to typed path while keeping voice UI visible | Person B + Person A |
| Live weather fails | Force `mode=demo` and continue with bundled `wxf_20260211_demo_01` | Person C |
| Patch recompute bug | Show patch apply success with deterministic recompute fixture | Person C + Person A |
| Sync not ready | Disable sync button and keep share preview path | Person C + Person A |

## Demo readiness checklist (hard pass/fail)
- Offline mode enabled and full loop completes.
- `Observation` validates and maps to `rec_20260211_0001`.
- Patch `pch_20260211_0001` bumps playbook `3 -> 4`.
- Recompute produces `rec_20260211_0002` with tightened window.
- Trace screen shows total <= 90 seconds.
- Typed fallback path succeeds end-to-end.

## Hackathon MVP (5 hours)
- Run only the no-wait plan above.
- Keep all lanes independent through adapter stubs and fixtures.
- Enforce gate-based merges and fallback activation within 10 minutes.

## Post-hack Hardening (2-4 weeks)
- Replace fixture handshakes with automated contract tests in CI.
- Add lane-owned test suites and integration environment checks.
- Add release checklist automation and regression timing benchmarks.
