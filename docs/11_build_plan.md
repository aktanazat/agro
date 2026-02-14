# Five-Hour Build Plan (Team of 3)

## Role split
| Role | Owner focus |
| --- | --- |
| Mobile | Screens, state machine, local storage, trace UI |
| AI Pipeline | On-device extraction orchestration, schema validation, deterministic output gating |
| Backend/Contracts/Patch | OpenAPI + schemas + types, playbook patch apply semantics, optional sync stub |

Tool ownership lock for MVP:
- Mobile owns React Native shell and local SQLite integration.
- AI Pipeline owns Cactus runtime hookup and schema validation gate.
- Backend/Contracts/Patch owns Synoptic adapter seam, patch engine, and sync contract stubs.

## Timeline with dependencies
| Time block | Mobile | AI Pipeline | Backend/Contracts/Patch | Dependency notes |
| --- | --- | --- | --- | --- |
| 0:00-0:30 | Scaffold screens and nav shell | Define extraction input/output adapter | Finalize schemas + TypeScript/Swift types | Contracts must stabilize first |
| 0:30-1:30 | Implement New Observation + Review/Edit UI | Build schema-constrained extraction path | Draft playbook + patch validator + OpenAPI endpoints | Review/Edit fields must match schemas |
| 1:30-2:30 | Implement Recommendation + History + Share views | Wire recommendation input/output contract | Implement deterministic rule engine stubs and patch apply flow | Recommendation screen depends on engine payload shape |
| 2:30-3:15 | Implement Playbook Editor + diff preview | Add typed fallback and failure states | Implement sync batch request/response stubs | Patch flow integration starts |
| 3:15-4:00 | Integrate trace screen timings | Run 10-note evaluation harness manually | Validate idempotency/error envelope examples | All three run joint integration tests |
| 4:00-4:40 | Polish demo transitions | Tune latency, lock deterministic settings | Finalize docs and contract examples | Freeze scope; no new features |
| 4:40-5:00 | Full timed rehearsal x2 | Full timed rehearsal x2 | Full timed rehearsal x2 | Select fallback path and backup script |

## Integration checkpoints (must pass)
| Checkpoint time | Required output | Owner |
| --- | --- | --- |
| 1:00 | `Observation` schema validation passing on one captured note | AI Pipeline |
| 2:00 | Deterministic recommendation payload generated from `obs_20260211_0001` | Backend/Contracts/Patch |
| 3:00 | Patch `pch_20260211_0001` applies and returns recompute `rec_20260211_0002` | Backend/Contracts/Patch + Mobile |
| 4:00 | Full offline flow under 90 seconds on trace screen | Mobile + AI Pipeline |
| 4:40 | Typed fallback path validated end-to-end | All |

## Cut-lines (if behind schedule)
1. Cut Live Mode weather API call; keep Demo Mode profile only.
2. Cut backend runtime entirely; keep OpenAPI contracts and local mock payloads.
3. Cut History search/filter; keep simple list.
4. Cut advanced patch operations; keep single `replace` operation.

## Risk register
| Risk | Probability | Impact | Mitigation |
| --- | --- | --- | --- |
| ASR fails in noisy room | medium | high | typed fallback path pre-tested; script includes failure-mode demo |
| Schema mismatch across teams | medium | high | freeze schema by hour 1; run validator on every sample payload |
| Recommendation logic ambiguity | medium | medium | restrict to two scenarios with explicit deterministic rules |
| Patch flow bugs | medium | medium | single bounded patch operation for MVP |
| Connectivity instability | high | medium | default offline mode; no dependency on live backend |
| Time overrun | high | high | enforce cut-lines at 2:30 and 3:30 checkpoints |

## Hackathon MVP (5 hours)
- Deliver one polished offline demo path with typed fallback and patch recompute.
- Keep rule coverage narrow and deterministic.
- Keep sync optional.
- Use `docs/13_tooling_integration_plan.md` as the source of truth for tool choices and fallbacks.
- Use `docs/14_parallel_5h_execution.md` as the source of truth for synchronous no-wait team execution.

## Post-hack Hardening (2-4 weeks)
- Expand crop/scenario coverage and provider integrations.
- Add production auth, observability, and reliability engineering.
- Add pilot feedback loop with agronomists.
