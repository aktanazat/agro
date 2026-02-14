# Security and Privacy

## Threat model
| Threat | Impact |
| --- | --- |
| Device theft | Exposure of local observations, recommendations, and playbook history |
| Accidental sync while user expects offline | Data leaves device unexpectedly |
| Prompt injection via voice note text | Corrupted extraction output or unsafe recommendation rationale |
| Unsafe agronomy suggestion | Harmful field action timing |
| Patch misuse | Unauthorized or unsafe playbook changes |

## Mitigations
| Threat | MVP mitigation | Post-hack mitigation |
| --- | --- | --- |
| Device theft | OS-level device lock required; local data minimization; no raw audio retention | Encrypted local DB + secure enclave keys + remote wipe |
| Accidental sync | Explicit sync toggle and visible offline badge | Policy-based sync controls and environment lock (demo/prod) |
| Prompt injection | Schema-constrained extraction, fixed enums, reject unknown fields | Input sanitization pipeline and adversarial test corpus |
| Unsafe suggestions | Recommendation requires explicit human confirmation (`requiredConfirmation=true`) | Multi-step approvals for high-risk actions + agronomist policy gates |
| Patch misuse | Bounded patch paths and local audit trail | Signed patch approvals, role-based path permissions, centralized audit |

## Human-in-the-loop policy (mandatory)
1. Every recommendation is advisory.
2. User must review structured fields and recommendation window before confirming.
3. No auto-apply field actions are triggered by the app.
4. Any playbook change must show diff preview and version bump.

## Data handling policy
- Default mode: offline-only processing.
- Raw audio: not uploaded in MVP; may be discarded after transcript confirmation.
- Shared exports: include explicit preview with IDs and timestamps.
- Sync: opt-in, explicit user action.

## Hackathon MVP (5 hours)
- Enforce confirmation gate in UI and contract.
- Enforce bounded patch edits and version checks.
- Show offline badge and sync toggle state at all times.

## Post-hack Hardening (2-4 weeks)
- Formal security review and penetration testing.
- Cryptographic signing for patch events.
- Compliance-oriented data retention and deletion controls.
