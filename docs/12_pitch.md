# Pitch Narrative

## Core story
FieldScout Copilot is not a generic AI assistant. It is a constrained field workflow that turns one observation note into a validated agronomy record and a deterministic action window, even offline.

What makes it different:
- Schema-constrained extraction: output must validate as `Observation`, not free-form prose.
- Offline-first execution: capture, extraction, recommendation, and patch recompute run without network.
- Deterministic playbook engine: recommendation comes from explicit rules and weather-derived constraints.
- Live rule editing: agronomy playbook changes apply as bounded patches with versioned audit.
- Credible weather seam: vertical-profile features influence recommendation timing, aligned with Sorcerer/Synoptic capability.

## Why judges should care
- Cactus sees practical on-device AI under strict runtime and determinism limits.
- Sorcerer sees weather-aware decision logic from upper-air-derived signals.
- Tellia sees voice-first capture optimized for field speed.
- Morph sees fast apply patch semantics with immediate recompute and auditability.

## 30-second closer
"We are starting with one wedge: Yolo County vineyard scouting. In under 90 seconds, a scout captures a note, gets a structured record, and receives a bounded recommendation window that still works offline. We are not claiming production automation today. We are showing a reliable contract surface that teams can implement and harden quickly."

## Hackathon MVP (5 hours)
- One crop/region wedge and two scenarios.
- Deterministic offline loop plus live playbook patch moment.
- Optional backend sync contract only.

## Post-hack Hardening (2-4 weeks)
- Pilot with partner agronomists for safety and usability validation.
- Expand rule packs and weather provider integrations.
- Add production auth, reliability, and compliance controls.
