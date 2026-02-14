# Morph-Style Fast Apply: Playbook Patch

## Live Playbook Edit moment
Flow:
1. User selects an editable rule field in Playbook Editor.
2. App constructs `PlaybookPatch` with `baseVersion` and operations.
3. Validator checks operation bounds, schema compatibility, and base version.
4. Engine applies patch atomically.
5. Playbook version increments.
6. Last recommendation is recomputed and shown immediately.

Canonical demo patch:
- `patchId=pch_20260211_0001`
- target `playbookId=pbk_yolo_grape`
- `baseVersion=3`
- operation: replace `/rules/rule_pm_moderate/constraints/maxWindKph` from `12` to `10`
- result: `newVersion=4`, recompute `rec_20260211_0002`

## Guardrails
| Guardrail | MVP behavior |
| --- | --- |
| Bounded editable fields | Only paths under `constraints`, `action.instructions`, `timing.baseWindowHours` are patchable |
| Base version check | Reject patch if `baseVersion` != active version |
| Schema validity | Validate entire resulting playbook against schema before commit |
| Atomic apply | Either all operations succeed or none apply |
| Rollback | Keep previous playbook version for one-tap rollback |
| Audit trail | Append immutable record with patch diff, actor, timestamp, outcome |

## Runtime communication prototype
| Producer | Consumer | Payload | Response | Error handling |
| --- | --- | --- | --- | --- |
| Playbook Editor UI | Patch validator | `PlaybookPatch` draft | validation result | highlight invalid path/value |
| Patch validator | Patch applier | validated `PlaybookPatch` + active `Playbook` | `PatchApplyResult` | reject atomically on first violation |
| Patch applier | Recommendation engine | `{observationId, playbookVersion}` | recomputed `Recommendation` | preserve prior recommendation if recompute fails |
| Patch applier | Audit store | immutable patch event | append confirmation | retry append before returning success |

## Hookup prototypes
### Local-first patch apply (required for offline demo)
```text
validate_patch_paths(patch.operations, allowlist)
validate_patch_base_version(patch.baseVersion, activePlaybook.version)
candidatePlaybook = apply_patch_operations(activePlaybook, patch.operations)
validate_schema(candidatePlaybook, Playbook.json)
persist(candidatePlaybook, version=4)
emit PatchApplyResult(status="applied", recomputedRecommendationId="rec_20260211_0002")
```

### Optional Morph seam (non-blocking, network optional)
Use Morph as an optional patch-generation assist path, not as source of truth for apply.

Prototype sequence:
1. User enters natural-language intent in editor.
2. Optional cloud call asks Morph to propose bounded JSON patch operations.
3. App validates and applies locally using the same guardrails above.

This preserves offline guarantee while still demonstrating fast-apply semantics aligned to Morph.

## Formal patch semantics
### Input contract (`PlaybookPatch`)
| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `patchId` | string | yes | client-generated idempotent key |
| `playbookId` | string | yes | target playbook |
| `baseVersion` | integer | yes | optimistic concurrency guard |
| `requestedByDeviceId` | string | yes | actor identity |
| `requestedAt` | string | yes | ISO-8601 timestamp |
| `reason` | string | yes | human-readable intent |
| `operations[]` | array | yes | RFC6902-like bounded operations |

### Output contract (`PatchApplyResult`)
| Field | Type | Description |
| --- | --- | --- |
| `patchId` | string | echoed patch id |
| `playbookId` | string | target playbook |
| `oldVersion` | integer | version before apply |
| `newVersion` | integer | version after apply |
| `status` | enum `applied` \| `rejected` | final state |
| `validationErrors[]` | array | populated when rejected |
| `recomputedRecommendationId` | string or null | set when recompute succeeds |
| `appliedAt` | string | ISO-8601 timestamp |

## Example patch payloads
### Valid patch
```json
{
  "patchId": "pch_20260211_0001",
  "playbookId": "pbk_yolo_grape",
  "baseVersion": 3,
  "requestedByDeviceId": "dev_ios_001",
  "requestedAt": "2026-02-11T18:21:12Z",
  "reason": "Tighten spray wind limit for tonight",
  "operations": [
    {
      "op": "replace",
      "path": "/rules/rule_pm_moderate/constraints/maxWindKph",
      "value": 10,
      "justification": "Local gusts are increasing"
    }
  ]
}
```

### Rejected patch (out-of-bounds path)
```json
{
  "patchId": "pch_20260211_0002",
  "playbookId": "pbk_yolo_grape",
  "baseVersion": 4,
  "requestedByDeviceId": "dev_ios_001",
  "requestedAt": "2026-02-11T18:22:10Z",
  "reason": "Attempt to change immutable metadata",
  "operations": [
    {
      "op": "replace",
      "path": "/metadata/owner",
      "value": "new-owner"
    }
  ]
}
```

Expected rejection error code: `PLAYBOOK_PATCH_PATH_NOT_ALLOWED`.

## Hackathon MVP (5 hours)
- Single-operation replace patches with bounded paths.
- Local apply + version bump + recompute on device.
- Local audit log only.
- Optional Morph call can be shown only if connectivity is stable; local apply remains mandatory path.

## Post-hack Hardening (2-4 weeks)
- Multi-operation transactional patches and richer diff previews.
- Signed patch approvals for high-risk rule changes.
- Server-side audit export and rollback governance.
- Add patch proposal quality metrics if Morph assist is enabled.
