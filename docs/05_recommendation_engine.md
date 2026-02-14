# Recommendation Engine

## Rule model
The Agronomy Playbook maps:

`issue + severity + constraints + weatherFeatures -> action + timingWindow`

Inputs:
- `Observation` (validated)
- Active `Playbook` version
- `WeatherFeatures`
- Reference time (`now` on device)

Output:
- `Recommendation` with deterministic `action`, `timingWindow`, `rationale`, `riskFlags`, and `requiredConfirmation=true`

## Scenario rules (MVP)
| Rule ID | Issue | Severity | Key constraints | Action | Base timing window |
| --- | --- | --- | --- | --- | --- |
| `rule_pm_moderate` | `powdery_mildew` | `moderate` | `maxWindKph=12`, `avoidInversion=true`, `maxRelativeHumidityPct=85`, `minHoursWithoutRain=4` | Apply sulfur-based contact spray in affected block | start `+2h`, end `+6h` |
| `rule_heat_moderate` | `heat_stress` | `moderate` | `maxTemperatureC=35`, `irrigationWindowLocal=04:30-07:00`, `maxWindKph=15` | Schedule short-cycle irrigation and canopy cooling check | next local irrigation window |

## Timing window derivation
1. Select playbook rule by `issue` and `severity`.
2. Generate base window from rule timing policy.
3. Adjust window using weather-derived features.
4. Apply hard constraints; if violated, mark blocked or tighten window.
5. Emit rationale list describing each adjustment.

### Weather-driven adjustments (deterministic)
| Feature | Condition | Window adjustment | Rationale tag |
| --- | --- | --- | --- |
| `inversionPresent` | `true` | start `+120m`, end `-60m` | `avoid_inversion` |
| `humidityLayering` | `uniform_humid` | end `-90m` | `high_humidity_persistence` |
| `windShearProxy` | `high` | end `-60m` | `spray_drift_risk` |
| `sprayWindowScore` | `<0.4` | block action, convert to monitor-only | `low_spray_window_score` |

## Canonical mildew demo output
- Input: `obs_20260211_0001` with `rule_pm_moderate`, `wxf_20260211_demo_01`, playbook version `3`.
- Output: `rec_20260211_0001`.
- Window: `2026-02-11T21:00:00-08:00` to `2026-02-12T00:30:00-08:00`.
- After patch `pch_20260211_0001` (`maxWindKph` from 12 to 10), recompute `rec_20260211_0002` with window `2026-02-11T21:15:00-08:00` to `2026-02-11T23:30:00-08:00`.

## Offline behavior
- Demo Mode: always load bundled profile (`sourceMode=demo`).
- Live Mode with no network:
- use last cached `WeatherFeatures` if age <= 12h.
- if no cache exists, produce conservative recommendation with `riskFlags=["weather_data_missing"]` and narrow window.
- Recommendation generation never blocks the UI flow; uncertainty is explicit in rationale and risk flags.

## Pseudocode (illustrative only)
```text
rule = playbook.select(issue=observation.extraction.issue, severity=observation.extraction.severity)
window = derive_base_window(rule.timing, now)
window = adjust_for_weather(window, weatherFeatures, rule.constraints)
result = enforce_constraints(rule.constraints, weatherFeatures, window)
return recommendation_from(result, requiredConfirmation=true)
```

## Hackathon MVP (5 hours)
- Implement two scenarios only (`powdery_mildew`, `heat_stress`).
- Support Demo Mode weather features and cached fallback.
- Expose rationale tags on Recommendation screen.

## Post-hack Hardening (2-4 weeks)
- Add uncertainty calibration and agronomist override workflows.
- Expand playbook rule sets by crop/region packs.
- Add automated simulation checks across weather edge cases.
