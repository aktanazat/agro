# Testing Strategy

## Test layers mapped to demo-critical paths
| Layer | Target | Demo-critical coverage |
| --- | --- | --- |
| Unit | Schema validators, playbook rule selection, timing adjustments, patch path guardrails | Correct field parsing and deterministic recommendation calculations |
| Integration | Observation flow (`capture -> extract -> recommend -> log`), patch apply/recompute flow | End-to-end contract compatibility and state transitions |
| E2E | 90-second scripted demo including typed fallback and patch recompute | Judge-facing reliability in airplane mode |

## Acceptance tests
| Test ID | Path | Expected result |
| --- | --- | --- |
| `AT-01` | Voice mildew note -> structured observation | `Observation` validates; issue `powdery_mildew`; severity `moderate` |
| `AT-02` | Structured observation -> recommendation | `rec_20260211_0001` generated with expected timing window bounds |
| `AT-03` | Confirm and log | History entry written; status `confirmed` |
| `AT-04` | Share payload preview | JSON includes `observationId`, `recommendationId`, `playbookVersion` |
| `AT-05` | Playbook patch apply | `pch_20260211_0001` applied; playbook version `3 -> 4` |
| `AT-06` | Recompute after patch | `rec_20260211_0002` generated with tightened window |
| `AT-07` | ASR failure fallback | Typed path reaches same structured outputs and recommendation |
| `AT-08` | Offline mode run | All above pass in airplane mode without backend |

## Performance tests (latency per stage)
| Metric ID | Stage | Threshold | Measurement |
| --- | --- | --- | --- |
| `PT-01` | Record stop -> transcript | <= 8s | Trace event delta |
| `PT-02` | Transcript -> valid observation | <= 15s | Trace event delta |
| `PT-03` | Recommendation compute | <= 5s | Trace event delta |
| `PT-04` | Patch validate/apply/recompute | <= 4s | Trace event delta |
| `PT-05` | Full loop | <= 90s | End-to-end stopwatch and trace |

## Demo acceptance checklist (pass/fail)
| Check | Pass criteria | Fail criteria |
| --- | --- | --- |
| Offline badge | Visible on Home and New Observation screens | Missing or inconsistent badge |
| Deterministic extraction | Same input note produces same structured fields twice | Any field drift across repeated runs |
| Schema validity | No invalid `Observation` or `Recommendation` payloads | Validation error in demo path |
| Recommendation confirmation gate | User must tap confirm before log status changes | Recommendation logged without confirmation |
| Patch guardrail | Out-of-bounds patch is rejected with proper error code | Patch mutates non-editable field |
| Recompute visibility | New recommendation ID and playbook version are visible after patch | No visible version bump/recompute |
| End-to-end time | Completed in <= 90 seconds | Exceeds 90 seconds |

## Hackathon MVP (5 hours)
- Run all acceptance tests once before submission.
- Run `AT-08` in airplane mode immediately before live demo.
- Capture Trace screen screenshot for proof.

## Post-hack Hardening (2-4 weeks)
- Automate full test suite in CI.
- Add property-based tests for patch and timing rules.
- Add device matrix performance testing.
