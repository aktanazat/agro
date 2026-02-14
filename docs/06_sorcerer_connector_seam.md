# Sorcerer Connector Seam (Upper-air / Vertical Profile)

## Why vertical profile matters
Surface weather alone can miss spray-risk conditions that occur in layers above canopy level. For disease and spray timing, inversion risk, humidity layering, and shear proxies can change drift behavior and deposition quality even when surface wind appears acceptable.

For `powdery_mildew`, this seam influences whether the recommendation engine opens or tightens a spray window.

## Provider-agnostic interface
### Request shape
| Field | Type | Description |
| --- | --- | --- |
| `location.lat` | number | Decimal latitude |
| `location.lon` | number | Decimal longitude |
| `atTime` | string (ISO-8601) | Profile target time |
| `mode` | enum `demo` \| `live` | Source mode selector |

### Response shape (`WeatherProfile`)
| Field | Type | Description |
| --- | --- | --- |
| `weatherFeaturesId` | string | Canonical feature object ID |
| `sourceMode` | enum `demo` \| `live` \| `none` | Data source mode |
| `profileTime` | string | Observation/profile timestamp |
| `location` | object | lat/lon |
| `layers` | array | Vertical layer samples |
| `derived` | object | deterministic derived features |

`layers[]` fields:
- `altitudeM`
- `temperatureC`
- `relativeHumidityPct`
- `windSpeedKph`
- `windDirectionDeg`

`derived` fields map directly to `WeatherFeatures` schema:
- `inversionPresent`
- `humidityLayering`
- `windShearProxy`
- `sprayWindowScore`
- `diseaseRiskScore`
- `heatStressScore`

## Modes
| Mode | Behavior | Credentials | Demo expectation |
| --- | --- | --- | --- |
| Demo Mode | Load bundled profile JSON from app assets and compute derived features locally | none | Always available offline; uses `wxf_20260211_demo_01` |
| Live Mode (Synoptic path) | Fetch profile via connector, normalize into `WeatherProfile`, compute derived fields | API key stored in secure config; never hard-coded in UI | Optional in hackathon; can be disabled if connectivity fails |

## Credential handling
- Hackathon: local env/config value (`SYNOPTIC_API_KEY`) injected at build/run time, never shown in demo UI.
- Post-hack: token broker on backend with short-lived signed requests and per-device access policies.

## Live Mode hookup prototype (Synoptic adapter)
### Endpoint strategy
| Need | Synoptic service | Why |
| --- | --- | --- |
| Current near-field conditions | `latest` | Fast current snapshot for immediate recommendation |
| Closest historical observation near requested time | `nearesttime` | Time alignment for event replay and debugging |
| Short lookback trend | `timeseries` | Stable derived-feature scoring over recent horizon |

### Adapter input and output
`WeatherProviderAdapter.fetchLive` input:
- `location.lat`
- `location.lon`
- `atTime`
- `radiusKm`
- `apiToken`

`WeatherProviderAdapter.fetchLive` output:
- `WeatherProfile` (normalized layers + `derived` features)
- `WeatherFeatures` object ready for recommendation engine (`weatherFeaturesId` pattern preserved)

### Request prototype (illustrative)
```text
GET /v2/stations/latest?token=$SYNOPTIC_API_KEY&within=30&radius=<lat>,<lon>,25
GET /v2/stations/nearesttime?token=$SYNOPTIC_API_KEY&attime=<ISO8601>&radius=<lat>,<lon>,25
GET /v2/stations/timeseries?token=$SYNOPTIC_API_KEY&start=<ISO8601>&end=<ISO8601>&radius=<lat>,<lon>,25
```

### Normalization prototype (illustrative pseudocode)
```text
raw = synoptic_response
layers = derive_layer_samples(raw.station_observations)
derived = derive_features(layers)
weatherFeatures = map_to_contract(wxf_20260211_demo_01 shape, sourceMode="live")
return weatherFeatures
```

### Offline-preserving failover
1. If live request fails, check last cached live profile age.
2. If cache age <= 12h, use cached features and set `notes += ["live_cache_used"]`.
3. If no valid cache, fallback to Demo Mode profile and set `sourceMode=demo`.

## Minimal derived-feature spec
| Derived feature | Derivation rule (deterministic) | Recommendation impact |
| --- | --- | --- |
| `inversionPresent` | true if temperature increases with altitude across low layers (0-150m) | Delay spray start and shorten window |
| `humidityLayering` | classify from RH gradient (`dry_aloft_humid_surface`, `uniform_humid`, `uniform_dry`, `unknown`) | High humidity persistence reduces mildew spray window |
| `windShearProxy` | compare wind speed delta between near-surface and upper layer | High shear reduces allowable spray duration |
| `sprayWindowScore` | weighted score from inversion, humidity, shear | Below threshold blocks spray action |
| `diseaseRiskScore` | weighted humidity + temperature profile risk indicator | Raises urgency/risk flag for mildew |
| `heatStressScore` | weighted near-surface heat load and overnight recovery estimate | Shifts irrigation timing recommendation |

## Hackathon MVP (5 hours)
- Implement Demo Mode with one bundled profile and deterministic derived-feature calculation.
- Implement Live Mode interface contract, but allow no-op/mocked transport.
- Keep Synoptic request wiring behind a single adapter module so demo path is never blocked by network.

## Post-hack Hardening (2-4 weeks)
- Add provider failover and telemetry per request.
- Add profile quality scoring and staleness checks.
- Validate derived-feature rules with agronomist-reviewed datasets.
- Move credential usage to short-lived signed backend tokens.
