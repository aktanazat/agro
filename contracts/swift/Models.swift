import Foundation

public struct Device {
    public let deviceId: String
    public let platform: Platform
    public let appVersion: String
    public let modelPackageVersion: String
    public let offlineModeEnabled: Bool
    public let lastSyncAt: String?
    public let updatedAt: String
}

public enum Platform: String {
    case ios
    case android
}

public struct Observation {
    public let observationId: String
    public let deviceId: String
    public let createdAt: String
    public let captureMode: CaptureMode
    public let rawNoteText: String
    public let transcription: ObservationTranscription
    public let extraction: ObservationExtraction
    public let normalization: ObservationNormalization
    public let location: GeoPoint
    public let status: ObservationStatus
    public let schemaVersion: String
    public let deterministicChecksum: String
}

public enum CaptureMode: String {
    case voice
    case typed
}

public enum ObservationStatus: String {
    case draft
    case confirmed
    case logged
}

public struct ObservationTranscription {
    public let text: String
    public let source: TranscriptionSource
    public let confidence: Double
}

public enum TranscriptionSource: String {
    case onDeviceAsr = "on_device_asr"
    case manualTyped = "manual_typed"
    case none
}

public struct ObservationExtraction {
    public let crop: Crop
    public let variety: String?
    public let fieldBlock: String
    public let issue: Issue
    public let severity: Severity
    public let symptoms: [String]
    public let observationTime: String
}

public enum Crop: String {
    case grape
}

public enum Issue: String {
    case powderyMildew = "powdery_mildew"
    case heatStress = "heat_stress"
    case other
}

public enum Severity: String {
    case low
    case moderate
    case high
}

public struct ObservationNormalization {
    public let temperatureC: Double?
    public let leafWetness: LeafWetness
    public let windEstimateKph: Double
}

public enum LeafWetness: String {
    case dry
    case damp
    case wet
    case unknown
}

public struct GeoPoint {
    public let lat: Double
    public let lon: Double
}

public struct WeatherFeatures {
    public let weatherFeaturesId: String
    public let sourceMode: WeatherSourceMode
    public let profileTime: String
    public let location: GeoPoint
    public let inversionPresent: Bool
    public let humidityLayering: HumidityLayering
    public let windShearProxy: WindShearProxy
    public let sprayWindowScore: Double
    public let diseaseRiskScore: Double
    public let heatStressScore: Double
    public let notes: [String]
}

public enum WeatherSourceMode: String {
    case demo
    case live
    case none
}

public enum HumidityLayering: String {
    case dryAloftHumidSurface = "dry_aloft_humid_surface"
    case uniformHumid = "uniform_humid"
    case uniformDry = "uniform_dry"
    case unknown
}

public enum WindShearProxy: String {
    case low
    case moderate
    case high
    case unknown
}

public struct Recommendation {
    public let recommendationId: String
    public let observationId: String
    public let playbookId: String
    public let playbookVersion: Int
    public let weatherFeaturesId: String
    public let generatedAt: String
    public let issue: Issue
    public let severity: Severity
    public let action: String
    public let rationale: [String]
    public let timingWindow: RecommendationTimingWindow
    public let riskFlags: [RiskFlag]
    public let requiredConfirmation: Bool
    public let status: RecommendationStatus
}

public struct RecommendationTimingWindow {
    public let startAt: String
    public let endAt: String
    public let localTimezone: String
    public let confidence: Double
    public let drivers: [String]
}

public enum RecommendationStatus: String {
    case pendingConfirmation = "pending_confirmation"
    case confirmed
    case rejected
}

public enum RiskFlag: String {
    case weatherDataMissing = "weather_data_missing"
    case highDriftRisk = "high_drift_risk"
    case lowConfidence = "low_confidence"
    case manualReviewRequired = "manual_review_required"
}

public struct Playbook {
    public let playbookId: String
    public let crop: PlaybookCrop
    public let region: PlaybookRegion
    public let version: Int
    public let updatedAt: String
    public let rules: PlaybookRules
}

public enum PlaybookCrop: String {
    case grape
}

public enum PlaybookRegion: String {
    case yoloCountyCa = "yolo_county_ca"
}

public struct PlaybookRules {
    public let rulePmModerate: PlaybookRule
    public let ruleHeatModerate: PlaybookRule
}

public struct PlaybookRule {
    public let ruleId: String
    public let issue: RuleIssue
    public let severity: Severity
    public let constraints: RuleConstraints
    public let action: RuleAction
    public let timing: RuleTiming
    public let editablePaths: [String]
}

public enum RuleIssue: String {
    case powderyMildew = "powdery_mildew"
    case heatStress = "heat_stress"
}

public struct RuleConstraints {
    public let maxWindKph: Double
    public let avoidInversion: Bool?
    public let maxRelativeHumidityPct: Double?
    public let minHoursWithoutRain: Double?
    public let maxTemperatureC: Double?
    public let irrigationWindowLocal: String?
}

public struct RuleAction {
    public let type: ActionType
    public let instructions: String
}

public enum ActionType: String {
    case spray
    case irrigate
    case monitor
}

public struct RuleTiming {
    public let baseWindowHours: BaseWindowHours
    public let weatherAdjustments: [RuleWeatherAdjustment]
}

public struct BaseWindowHours {
    public let startOffsetHours: Double
    public let endOffsetHours: Double
}

public struct RuleWeatherAdjustment {
    public let feature: AdjustmentFeature
    public let condition: String
    public let shiftStartMinutes: Int
    public let shiftEndMinutes: Int
    public let rationaleTag: String
}

public enum AdjustmentFeature: String {
    case inversionPresent
    case humidityLayering
    case windShearProxy
    case sprayWindowScore
    case diseaseRiskScore
    case heatStressScore
}

public struct PlaybookPatch {
    public let patchId: String
    public let playbookId: String
    public let baseVersion: Int
    public let requestedByDeviceId: String
    public let requestedAt: String
    public let reason: String
    public let operations: [PlaybookPatchOperation]
}

public struct PlaybookPatchOperation {
    public let op: PatchOp
    public let path: String
    public let value: JSONValue?
    public let justification: String?
}

public enum PatchOp: String {
    case add
    case replace
    case remove
}

public enum JSONValue {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null
}

public struct ErrorEnvelope {
    public let requestId: String
    public let timestamp: String
    public let error: ErrorBody
}

public struct ErrorBody {
    public let code: ErrorCode
    public let message: String
    public let retryable: Bool
    public let traceId: String
    public let details: [String: JSONValue]?
}

public enum ErrorCode: String {
    case validationError = "VALIDATION_ERROR"
    case authRequired = "AUTH_REQUIRED"
    case forbidden = "FORBIDDEN"
    case notFound = "NOT_FOUND"
    case conflict = "CONFLICT"
    case idempotencyConflict = "IDEMPOTENCY_CONFLICT"
    case playbookPatchPathNotAllowed = "PLAYBOOK_PATCH_PATH_NOT_ALLOWED"
    case playbookVersionMismatch = "PLAYBOOK_VERSION_MISMATCH"
    case internalError = "INTERNAL_ERROR"
}

public struct PatchApplyResult {
    public let patchId: String
    public let playbookId: String
    public let oldVersion: Int
    public let newVersion: Int
    public let status: PatchApplyStatus
    public let validationErrors: [String]
    public let recomputedRecommendationId: String?
    public let appliedAt: String
}

public enum PatchApplyStatus: String {
    case applied
    case rejected
}

public struct SyncBatchRequest {
    public let syncId: String
    public let requestedAt: String
    public let device: Device
    public let lastKnownServerCursor: String
    public let upserts: SyncUpserts
}

public struct SyncUpserts {
    public let observations: [Observation]
    public let recommendations: [Recommendation]
    public let playbookPatches: [PlaybookPatch]
}

public struct SyncBatchResponse {
    public let syncId: String
    public let acceptedAt: String
    public let serverCursor: String
    public let acceptedCounts: AcceptedCounts
    public let conflicts: [SyncConflict]
    public let downstream: SyncDownstream
}

public struct AcceptedCounts {
    public let observations: Int
    public let recommendations: Int
    public let playbookPatches: Int
}

public struct SyncConflict {
    public let entityType: SyncEntityType
    public let entityId: String
    public let code: String
    public let message: String
}

public enum SyncEntityType: String {
    case observation
    case recommendation
    case playbookPatch
}

public struct SyncDownstream {
    public let playbook: SyncPlaybookVersion
    public let observations: [Observation]
    public let recommendations: [Recommendation]
}

public struct SyncPlaybookVersion {
    public let playbookId: String
    public let version: Int
    public let updatedAt: String
}
