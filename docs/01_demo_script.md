# Demo Script (90 seconds)

## Spoken input text (exact)
"Block 7 Chardonnay. I see white powder on upper leaf surfaces, moderate spread after two warm days. Leaves are dry right now, slight musty odor, wind feels light. Log this and give me a spray window tonight."

## Beat-by-beat run of show
| Time | Screen | Operator action | System transition | Expected visible output |
| --- | --- | --- | --- | --- |
| 0-5s | Home | Show offline badge, tap **New Observation** | `Home -> New Observation` | `deviceId=dev_ios_001`, mode `offline` |
| 5-22s | New Observation | Hold record, read exact spoken text | `recording -> transcribing` | Live waveform then transcript with source `on_device_asr` confidence >= 0.90 |
| 22-34s | Review/Edit | Tap **Structure Note** | `transcribing_complete -> extracting -> extracted` | Draft `Observation` with `obs_20260211_0001`, `issue=powdery_mildew`, `severity=moderate`, `fieldBlock=Block 7`, `crop=grape`, `variety=chardonnay` |
| 34-48s | Review/Edit | Tap **Generate Recommendation** | `extracted -> recommending -> recommendation_ready` | `rec_20260211_0001` generated using `playbookVersion=3`, `weatherFeaturesId=wxf_20260211_demo_01` |
| 48-62s | Recommendation | Read recommendation aloud | no state change | Action text shown with timing window `2026-02-11T21:00:00-08:00` to `2026-02-12T00:30:00-08:00` |
| 62-72s | Recommendation | Tap **Confirm & Log** then **Share** | `recommendation_ready -> confirmed -> logged` | History row with observation/recommendation IDs; share payload preview |
| 72-90s | Playbook Editor | Apply patch `pch_20260211_0001` (`/rules/rule_pm_moderate/constraints/maxWindKph` from `12` to `10`) | `patch_validate -> patch_apply -> version_bump -> recompute` | Playbook `3 -> 4`, new `rec_20260211_0002` with tightened window `2026-02-11T21:15:00-08:00` to `2026-02-11T23:30:00-08:00` |

## Failure-mode demo path (speech failure)
If ASR fails or permission is denied:
1. On New Observation, switch input to **Typed Note**.
2. Paste the same text from the spoken script.
3. Tap **Structure Note** and continue the same flow.

Expected output is unchanged except:
- `captureMode=typed`
- `transcription.source=manual_typed`
- `transcription.confidence=1.0`

## Judge callouts (one sentence each)
- Cactus (Henry Ndubuaku): "Everything you see from extraction to recommendation runs on-device with quantized models and schema validation in airplane mode."
- Sorcerer (Austin Tindle): "This timing window changes because we evaluate vertical-profile features like inversion risk and humidity layering, not just surface conditions."
- Morph: "The playbook change is a bounded patch with validate-apply-version semantics, then immediate recommendation recompute."
- Tellia (Coline Labadie de Fay): "Voice is the default capture path in-field, and typed fallback preserves the same structured output contract."

## Hackathon MVP (5 hours)
- Single scripted mildew run plus one typed fallback run.
- Demo Mode weather profile loaded from local JSON.
- One playbook patch operation shown live.

## Post-hack Hardening (2-4 weeks)
- Multiple accents/noise ASR tests and confidence calibration.
- Additional failure-mode branches (partial transcript, conflicting edits).
- Live Synoptic profile pull with robust retries and audit logging.
