# Tooling and Integration Plan

## Objective
Lock the practical toolchain for a 5-hour, 3-person build so implementation teams can wire modules quickly and avoid interface churn.

## MVP tool decisions (locked)
| Workstream | Primary tool | Why this is selected now | Offline posture | Owner |
| --- | --- | --- | --- | --- |
| Mobile shell | React Native (TypeScript) targeting iOS first | Fast UI iteration and direct path to Cactus React Native SDK | Fully local runtime on device | Mobile |
| Voice capture and fallback | Native mic capture + typed note input | Voice-first UX is required (Tellia-aligned pattern); typed path is mandatory backup | No network required | Mobile |
| On-device extraction inference | Cactus React Native SDK (`cactus-react-native`) with quantized model (`int4`) | Sponsor-aligned on-device inference, quantization control, deterministic settings lock | Local model execution | AI Pipeline |
| Schema validation | JSON Schema validation against `contracts/schemas/*.json` | Deterministic contract enforcement before recommendation | Fully local | AI Pipeline |
| Local persistence | SQLite-backed store (implementation wrapper chosen by mobile team) | Reliable offline storage and simple audit/history retrieval | Fully local | Mobile |
| Recommendation engine | Local deterministic rule evaluator from `Playbook` + `WeatherFeatures` | No training, deterministic output requirement | Fully local | Backend/Contracts/Patch |
| Weather connector seam | Demo profile JSON + Live Synoptic Weather API adapter | Demo always works offline; live mode demonstrates real provider seam | Demo local, Live network optional | Backend/Contracts/Patch |
| Playbook patch seam | Local bounded JSON patch apply (`add`/`replace`/`remove`) + audit trail | Satisfies fast-apply semantics while preserving offline guarantee | Fully local | Backend/Contracts/Patch |
| Optional patch assist seam | Morph Apply API (optional, non-blocking) | Sponsor visibility for fast-apply semantics without becoming demo dependency | Network optional only | Backend/Contracts/Patch |
| Optional sync backend | OpenAPI-defined `/v1/*` endpoints | Contract already locked; implementation can be dropped without harming demo | Network optional | Backend/Contracts/Patch |

## Fallback decisions (if blocked)
| If this fails | Immediate fallback | Effect on demo |
| --- | --- | --- |
| Cactus model download/runtime issue | Run extraction via deterministic local parser + strict schema form confirmation | Keeps offline loop and determinism; weaker AI quality |
| Live Synoptic call fails | Use bundled `wxf_20260211_demo_01` profile | Keeps weather-driven timing demonstration |
| Optional backend unavailable | Keep everything local and use share payload preview | Keeps full 90-second loop |
| Morph API unavailable | Keep local patch apply path only | Keeps fast apply semantics in product flow |

## External references used for tool decisions
- Cactus platform/docs: https://cactuscompute.com/
- Cactus React Native SDK: https://cactuscompute.com/docs/react-native
- Morph quickstart (Fast Apply concept): https://docs.morphllm.com/quickstart
- Morph Apply API: https://docs.morphllm.com/api-reference/endpoint/apply
- Synoptic Weather API overview: https://docs.synopticdata.com/services/weather-api
- Synoptic `latest`: https://docs.synopticdata.com/services/latest
- Synoptic `nearesttime`: https://docs.synopticdata.com/services/nearest-time
- Synoptic `timeseries`: https://docs.synopticdata.com/services/time-series
- Sorcerer Stratocast positioning (vertical resolution emphasis): https://www.sorcerer.earth/stratocast
- Tellia voice-first field pattern reference: https://www.linkedin.com/company/tell-ia

## Communication map (module-level)
| Producer | Interface | Consumer | Payload contract | Ack or error contract |
| --- | --- | --- | --- | --- |
| `NewObservationScreen` | `CaptureSubmitted` event | `ExtractionOrchestrator` | `{ observationId, captureMode, rawNoteText, transcription }` | Validation result with field-level errors |
| `ExtractionOrchestrator` | `validateObservation` call | `SchemaValidator` | `Observation` candidate | `ok` or `VALIDATION_ERROR` |
| `RecommendationScreen` | `GenerateRecommendationRequested` | `RecommendationEngine` | `{ observationId, playbookId, playbookVersion, weatherFeaturesId }` | `Recommendation` or blocking error |
| `RecommendationEngine` | `loadWeatherFeatures` | `WeatherProviderAdapter` | `{ location, atTime, mode }` | `WeatherFeatures` or `sourceMode=none` fallback |
| `PlaybookEditor` | `ApplyPatchRequested` | `PatchEngine` | `PlaybookPatch` | `PatchApplyResult` |
| `PatchEngine` | `RecomputeRequested` | `RecommendationEngine` | `{ observationId, newPlaybookVersion }` | new `Recommendation` |
| `SyncOrchestrator` | `POST /v1/sync/batch` | `SyncAPI` | `SyncBatchRequest` | `SyncBatchResponse` or `ErrorEnvelope` |

## Hookup prototypes (pseudocode)

### 1. App bootstrap
```text
load contracts schema set
load active playbook pbk_yolo_grape version=3
load bundled weather profile wxf_20260211_demo_01
initialize cactus runtime (quantization=int4, deterministic settings)
show Home screen with offline badge=true
```

### 2. Capture -> extraction -> validation
```text
on CaptureSubmitted(observationId, rawNoteText, captureMode):
  transcript = resolve_transcript(captureMode)
  extracted = cactus_extract_to_json_schema(transcript, Observation.extraction)
  observation = build_observation(observationId, extracted, transcript)
  validate observation against Observation.json
  if invalid: route to Review/Edit with field errors
  if valid: emit ObservationReady
```

### 3. Weather adapter (Demo and Live)
```text
if mode == "demo":
  return bundled WeatherFeatures(wxf_20260211_demo_01)

if mode == "live":
  call Synoptic latest or nearesttime endpoint
  normalize station data to WeatherProfile layers
  derive WeatherFeatures fields
  return WeatherFeatures(sourceMode="live")
```

### 4. Patch apply -> recompute
```text
on ApplyPatchRequested(pch_20260211_0001):
  enforce path allowlist under /rules/*/(constraints|action|timing)
  verify baseVersion == activeVersion
  apply atomically
  bump playbook version 3 -> 4
  recompute recommendation for obs_20260211_0001
  return rec_20260211_0002
```

### 5. Optional sync loop
```text
every manual sync trigger:
  build SyncBatchRequest with local upserts
  send with Idempotency-Key and X-Device-Token
  on 200: mark accepted records synced, store serverCursor
  on conflict: persist conflict item and keep local canonical record
```

## Integration checkpoints (project manager view)
| Time | Required integration exit criteria | Owner |
| --- | --- | --- |
| 0:45 | Contracts loaded in app; schema validation callable | AI Pipeline |
| 1:30 | Voice or typed input produces valid `Observation` draft | Mobile + AI Pipeline |
| 2:15 | Recommendation engine returns deterministic `rec_20260211_0001` | Backend/Contracts/Patch |
| 3:00 | Patch apply updates playbook `3 -> 4` and recomputes `rec_20260211_0002` | Backend/Contracts/Patch + Mobile |
| 3:45 | Trace screen displays per-stage timings | Mobile |
| 4:30 | Full offline rehearsal completes under 90 seconds | All |
| 4:50 | Failure-mode typed path rehearsal complete | All |

## Hackathon MVP (5 hours)
- Keep `mode=demo` as default for weather seam.
- Keep local patch engine as source of truth for fast apply demo moment.
- Keep backend sync optional and non-blocking.
- Rehearse one primary path and one typed fallback path.

## Post-hack Hardening (2-4 weeks)
- Expand live weather adapter and provider failover.
- Add stronger auth, encrypted storage, and operational observability.
- Add policy controls for playbook patch approvals and rollback governance.
