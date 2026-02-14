# Architecture

## System components
1. Mobile app (iOS-first, React Native optional): local capture, extraction orchestration, recommendation rendering, history, playbook editor.
2. On-device AI runtime: ASR (optional), schema-constrained extraction, confidence gate.
3. Local recommendation engine: deterministic rule evaluation from `Playbook` + `WeatherFeatures`.
4. Weather connector seam: provider-agnostic adapter with Demo Mode (bundled profile) and Live Mode (Synoptic path).
5. Optional backend sync service: conflict-aware batch sync for observations, recommendations, and playbook versions.

## Tool stack lock (MVP)
| Layer | Tool choice | Notes |
| --- | --- | --- |
| Mobile app | React Native (TypeScript), iOS-first target | Faster iteration for 5-hour team delivery |
| On-device inference | Cactus runtime via `cactus-react-native` | Quantized inference, deterministic settings |
| Local storage | SQLite-backed local store | Offline-first audit/history |
| Contracts | JSON Schema + OpenAPI (`contracts/*`) | Shared source of truth across mobile/backend |
| Weather seam | Bundled profile JSON + Synoptic Live adapter | Demo-safe offline default, live optional |
| Patch seam | Local bounded patch engine + optional Morph apply assist | Offline guarantee with sponsor-aligned semantics |
| Optional sync backend | OpenAPI-defined `/v1/*` service | Non-blocking for demo |

## Core flow
`capture -> local transcription (optional) -> extraction -> normalization -> recommendation -> log -> share -> sync`

Detailed sequence is captured in:
- `docs/diagrams/observation-flow.mmd`
- `docs/diagrams/sync-flow.mmd`

## Data contracts at each stage
| Stage | Input contract | Output contract |
| --- | --- | --- |
| Capture | raw voice frames or typed text | note text + `captureMode` |
| Transcription | audio frames | transcript + confidence + source |
| Extraction | transcript text | valid `Observation` |
| Normalization | `Observation.extraction` fields | canonicalized units/labels in `Observation.normalization` |
| Recommendation | `Observation` + active `Playbook` + `WeatherFeatures` | valid `Recommendation` |
| Patch/recompute | `PlaybookPatch` + `Playbook` | updated `Playbook` + recomputed `Recommendation` |
| Sync | local changes batch | server cursor + conflict list |

## Communication contracts (runtime choreography)
| Step | Producer -> Consumer | Contract | Success output | Failure output |
| --- | --- | --- | --- | --- |
| 1 | Capture UI -> Extraction orchestrator | `rawNoteText`, `captureMode`, transcript metadata | `Observation` candidate | extraction error payload |
| 2 | Extraction orchestrator -> Schema validator | full `Observation` | validated `Observation` | `ErrorEnvelope` with `VALIDATION_ERROR` |
| 3 | Recommendation UI -> Recommendation engine | `{observationId, playbookId, playbookVersion, weatherFeaturesId}` | `Recommendation` | blocked recommendation with risk flags |
| 4 | Recommendation engine -> Weather adapter | `{location, atTime, mode}` | `WeatherFeatures` | fallback `WeatherFeatures` with `sourceMode=none` |
| 5 | Playbook editor -> Patch engine | `PlaybookPatch` | `PatchApplyResult` + recompute trigger | patch rejection with error code |
| 6 | Sync orchestrator -> Sync API | `SyncBatchRequest` | `SyncBatchResponse` | `ErrorEnvelope` (`CONFLICT`, `AUTH_REQUIRED`, etc.) |

## Integration prototypes
### Capture to recommendation
```text
CaptureSubmitted -> ExtractObservationRequested
ExtractObservationRequested -> ObservationValidated
ObservationValidated -> RecommendationRequested
RecommendationRequested -> RecommendationReady
RecommendationReady -> RecommendationConfirmed -> ObservationLogged
```

### Patch to recompute
```text
ApplyPatchRequested(pch_20260211_0001)
-> PatchValidated
-> PatchApplied(version 3->4)
-> RecommendationRecomputeRequested(obs_20260211_0001)
-> RecommendationReady(rec_20260211_0002)
```

## Privacy posture
- Default mode is offline; no network required for core demo path.
- Sync is explicit opt-in per device/session.
- Shared payloads can be previewed before export.
- No raw audio upload in MVP.

## Performance targets
| Stage | Target |
| --- | --- |
| Record stop -> transcript ready | <= 8s |
| Transcript -> valid `Observation` | <= 15s |
| Recommendation compute | <= 5s |
| Patch apply + recompute | <= 4s |
| Full scripted loop | <= 90s |

## Live demo measurement method (Trace screen)
Trace screen shows one row per stage with:
- `traceId`
- `stage`
- `startedAt`
- `endedAt`
- `durationMs`
- `status`

Canonical trace for scripted run:
- `trace_20260211_demo_01`
- capture_start: `2026-02-11T18:20:00Z`
- recommendation_logged_by: `2026-02-11T18:21:10Z`
- patch_applied: `2026-02-11T18:21:14Z`

## Hackathon MVP (5 hours)
- Local-only architecture with optional mock sync endpoint.
- Demo Mode weather features loaded from bundled demo profile JSON (`weatherFeaturesId=wxf_20260211_demo_01`).
- Minimal trace UI that prints stage durations.
- Integration decision source: `docs/13_tooling_integration_plan.md`.

## Post-hack Hardening (2-4 weeks)
- Background sync queue with retry/backoff policies.
- Secure enclave key storage and encrypted local persistence.
- Multiple weather providers and reconciliation telemetry.
