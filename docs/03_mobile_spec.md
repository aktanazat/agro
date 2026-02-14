# Mobile Spec (iOS-first)

## Screens
| Screen | Purpose | Required fields/components | Primary actions |
| --- | --- | --- | --- |
| Home | Entry point, offline status, recent logs | Offline badge, `deviceId`, last 5 observations | New Observation, History, Playbook Editor |
| New Observation | Capture voice or typed note | Record button, typed note input, permission status | Start/Stop Recording, Switch to Typed, Continue |
| Review/Edit | Validate structured fields | `Observation` form: crop, variety, fieldBlock, issue, severity, symptoms | Structure Note, Edit Fields, Generate Recommendation |
| Recommendation | Show deterministic action window | Action card, timing window card, weather drivers, confidence | Confirm & Log, Back to Edit |
| History | Audit trail of past entries | List keyed by `observationId` and status | Open entry, Share |
| Share | Export payload preview | JSON/text preview with IDs and timestamps | Copy, AirDrop/Share Sheet |
| Playbook Editor | Live rule patching | Active playbook version, allowed patch paths, diff preview | Validate Patch, Apply Patch, Recompute Last Recommendation |
| Trace | Performance inspection for judges | Stage rows with `durationMs` and status | Refresh, Export trace |

## Recording/transcription/extraction state machine
| State | Entry condition | Exit condition | Failure states | Recovery |
| --- | --- | --- | --- | --- |
| `idle` | New Observation opened | user starts recording or typed input | none | none |
| `recording` | mic granted and record pressed | user stops recording | `mic_permission_denied` | switch to typed flow |
| `transcribing` | audio clip submitted locally | transcript received | `asr_failed` | retry ASR once, else typed flow |
| `extracting` | transcript/typed text ready | valid `Observation` produced | `extraction_invalid` | open Review/Edit with highlighted invalid fields |
| `extracted` | `Observation` passes schema validation | user requests recommendation | none | manual edits allowed |
| `recommending` | recommendation requested | valid `Recommendation` generated | `recommendation_blocked` | show blocking reason and edit constraints |
| `recommendation_ready` | recommendation generated | user confirms | none | user can return to edit |
| `confirmed` | user confirms recommendation | logged to local history | none | undo within 10 seconds optional |
| `logged` | persisted locally | optional share/sync | `sync_deferred` (non-blocking) | queue for later sync |

## Local storage model
| Object | Key | Relations | Notes |
| --- | --- | --- | --- |
| `Device` | `deviceId` | one-to-many `Observation`, one-to-many sync batches | stores app/model package versions |
| `Observation` | `observationId` | belongs to `Device`; one-to-many `Recommendation` | source of truth for captured context |
| `Recommendation` | `recommendationId` | belongs to `Observation`; references `Playbook` and `WeatherFeatures` | includes confirmation status |
| `Playbook` | `playbookId` + `version` | one-to-many rules; one-to-many patches | active version pinned locally |
| `PlaybookPatch` | `patchId` | references target `Playbook` | append-only audit trail |
| `WeatherFeatures` | `weatherFeaturesId` | referenced by `Recommendation` | Demo Mode bundle or Live Mode fetch |
| `TraceEvent` | `traceId` + `stage` + `startedAt` | references observation/recommendation IDs | used only for demo measurement |

## iOS constraints and assumptions
- Permissions: microphone permission required for voice path; app must provide typed fallback if denied.
- On-device model packaging: quantized model artifacts bundled in app resources, versioned by `modelPackageVersion`.
- Background audio: not required for MVP; recording only in foreground.
- Disk footprint target for AI artifacts + local data: <= 250 MB.
- Offline mode: all core screens except sync must work in airplane mode.

## Integration adapters (prototype contracts)
| Adapter | Request | Response | Failure behavior |
| --- | --- | --- | --- |
| `ExtractionAdapter` | `{ observationId, rawNoteText, captureMode, transcription }` | validated `Observation` | return field-level validation errors |
| `RecommendationAdapter` | `{ observationId, playbookId, playbookVersion, weatherFeaturesId }` | `Recommendation` | return `recommendation_blocked` with rationale |
| `WeatherAdapter` | `{ location, atTime, mode }` | `WeatherFeatures` | fallback to cached/demo profile |
| `PatchAdapter` | `PlaybookPatch` | `PatchApplyResult` | keep active playbook unchanged |
| `SyncAdapter` | `SyncBatchRequest` | `SyncBatchResponse` | queue remains pending with `sync_deferred` |

Prototype message flow:
```text
NewObservationScreen -> ExtractionAdapter -> Review/Edit
Review/Edit -> RecommendationAdapter -> RecommendationScreen
PlaybookEditor -> PatchAdapter -> RecommendationAdapter(recompute)
History/Share -> SyncAdapter (optional)
```

## Hackathon MVP (5 hours)
- Build Home, New Observation, Review/Edit, Recommendation, Playbook Editor, Trace.
- History and Share can be minimal list + JSON preview.
- Single-device local storage only.

## Post-hack Hardening (2-4 weeks)
- Add robust local migration strategy for schema versions.
- Add encrypted local store and secure key management.
- Add accessibility pass for field use (large tap targets, high contrast, voice-over labels).
