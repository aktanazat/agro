# Backend Sync (Optional in MVP)

## Purpose
The backend is optional for the hackathon demo. The full contract is still defined so a service can be added without changing mobile interfaces.

## Sync model
- Offline-first: mobile writes locally first.
- Sync is pull+push in one batch call.
- Client sends local changes plus `lastKnownServerCursor`.
- Server responds with acceptance, conflicts, new cursor, and remote changes.

## Communication choreography
| Stage | Mobile action | Backend expectation | Contract |
| --- | --- | --- | --- |
| 1 | Create `syncId` and snapshot pending upserts | Treat as idempotent operation | `SyncBatchRequest.syncId` |
| 2 | Send `POST /v1/sync/batch` with `Idempotency-Key` and `X-Device-Token` | Validate auth + schema + idempotency | OpenAPI `syncBatch` |
| 3 | Receive accepted counts and conflicts | Persist sync event and cursor | `SyncBatchResponse` |
| 4 | Mark accepted records synced locally | no further server call required | local sync queue update |
| 5 | Route conflicts to resolution UI/work queue | include actionable conflict metadata | `conflicts[]` payload |

## Batch contract
### Request (`POST /v1/sync/batch`)
| Field | Type | Description |
| --- | --- | --- |
| `syncId` | string | client-generated idempotent sync operation id |
| `requestedAt` | string | ISO-8601 timestamp |
| `device` | `Device` | caller metadata |
| `lastKnownServerCursor` | string | incremental sync token |
| `upserts.observations[]` | `Observation[]` | local records to persist |
| `upserts.recommendations[]` | `Recommendation[]` | local recommendation records |
| `upserts.playbookPatches[]` | `PlaybookPatch[]` | pending patch events |

### Response
| Field | Type | Description |
| --- | --- | --- |
| `syncId` | string | echoed sync id |
| `acceptedAt` | string | server timestamp |
| `serverCursor` | string | next cursor |
| `acceptedCounts` | object | accepted entity counts |
| `conflicts[]` | array | entity-level conflict reports |
| `downstream.playbook` | object | latest playbook id/version metadata |
| `downstream.observations[]` | array | optional new/updated records |
| `downstream.recommendations[]` | array | optional server-generated records |

## Conflict resolution rules
| Entity | Rule |
| --- | --- |
| Observation | Last-write-wins only while `status=draft`; once `confirmed`, immutable except explicit correction event |
| Recommendation | Immutable after confirmation; duplicates resolved by `recommendationId` |
| Playbook patch | Must match active `baseVersion`; mismatch returns conflict and requires client rebase |
| Device metadata | Last-write-wins by `updatedAt` |

## Retry and idempotency prototype
```text
attempt = 0
while attempt < 3:
  send /v1/sync/batch with same syncId and Idempotency-Key
  if 200: apply response and stop
  if error.retryable == false: stop and surface error
  wait backoff(attempt)
  attempt += 1
```

If all retries fail, keep records in pending queue and show `sync_deferred` non-blocking state.

## Minimal server storage model
- `devices` table keyed by `deviceId`
- `observations` table keyed by `observationId`
- `recommendations` table keyed by `recommendationId`
- `playbooks` table keyed by `playbookId`, with versioned rows
- `playbook_patches` append-only table keyed by `patchId`
- `sync_events` table keyed by `syncId` for idempotency and audit

## Auth assumptions
### Hackathon MVP (5 hours)
- Static or pre-shared device token passed as `X-Device-Token`.
- Optional bearer token placeholder in OpenAPI for future compatibility.
- No auth flow UI in demo; token is injected at app config time.

### Post-hack Hardening (2-4 weeks)
- Proper user/device auth (OAuth2 or signed device credentials).
- Token rotation, role-based access, and scoped playbook edit permissions.
- End-to-end audit of who synced and who edited agronomy rules.
- Add server-issued short-lived credentials for Live Mode weather and sync.
