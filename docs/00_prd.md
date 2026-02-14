# Product Requirements: FieldScout Copilot

## User and context
Primary user: a field scout or agronomist in Yolo County managing multiple vineyard blocks under poor connectivity and high time pressure.

Operational constraints:
- Spotty cell coverage in-field.
- Decisions needed in minutes, not hours.
- Notes are often voice-first, short, and inconsistent.
- Recommendation output must be reviewable and confirmable before action.

## Problem statement
Field observations are captured in unstructured notes. Teams lose time rewriting notes into systems and translating them into action windows that depend on weather constraints. Existing tools assume stable connectivity or force generic chat interaction.

## Jobs-to-be-done
1. When I notice an issue in the field, I want to capture it in under 30 seconds so I can keep moving.
2. When the note is captured, I want a structured observation with minimal edits so records stay consistent.
3. When deciding next action, I want a time-bounded recommendation window that reflects weather risk.
4. When guidance changes, I want to edit playbook rules live and immediately see recomputed recommendations.

## Success metrics
| Metric | Hackathon target | Measurement method |
| --- | --- | --- |
| End-to-end demo latency (capture -> confirmed recommendation) | <= 90 seconds | Trace screen stopwatch with per-stage timestamps |
| Extraction latency (note -> valid `Observation`) | <= 15 seconds on demo device | Stage timing in local trace log |
| Recommendation latency (valid `Observation` -> `Recommendation`) | <= 5 seconds | Stage timing in local trace log |
| Offline completion rate | 100% for scripted demo and 10 evaluation notes | Airplane mode runbook |
| Data correctness for core fields (`issue`, `severity`, `fieldBlock`, `action`, timing window bounds) | >= 9/10 notes correct | Evaluation harness in `docs/04_on_device_ai.md` |
| Deterministic schema compliance | 100% | JSON schema validator gate |

## Non-goals
- No generic climate chatbot.
- No broad dashboard analytics buildout.
- No model training or fine-tuning during hackathon.
- No production agronomy automation without human confirmation.

## Scope locks
- Single crop/region wedge for demo: Yolo County grapes.
- Two scenarios only for recommendation rules: powdery mildew, heat stress/irrigation timing.
- Offline-first mobile loop is mandatory; backend is optional.
- Playbook edits are bounded to approved fields and must leave audit trail.

## Canonical demo objects
| Object | Canonical value |
| --- | --- |
| `deviceId` | `dev_ios_001` |
| `observationId` | `obs_20260211_0001` |
| `recommendationId` | `rec_20260211_0001` |
| `recomputedRecommendationId` | `rec_20260211_0002` |
| `playbookId` | `pbk_yolo_grape` |
| `playbookVersion` before patch | `3` |
| `playbookVersion` after patch | `4` |
| `weatherFeaturesId` | `wxf_20260211_demo_01` |
| `patchId` | `pch_20260211_0001` |

## Hackathon MVP (5 hours)
- Implement only the schema-constrained path for one voice note flow and typed fallback.
- Include local recommendation engine with weather-feature-driven timing.
- Show one live playbook patch and recompute.

## Post-hack Hardening (2-4 weeks)
- Extend scenario coverage to additional crop issues and confidence calibration.
- Add robust auth and encrypted sync storage.
- Add field test data capture and recommendation safety review workflow.
