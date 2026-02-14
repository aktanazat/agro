import Foundation

public protocol ObservationRepository {
    func saveObservation(_ observation: Observation) throws
    func fetchObservation(observationId: String) throws -> Observation?
    func listRecentObservations(deviceId: String, limit: Int) throws -> [Observation]
}

public protocol RecommendationService {
    func generateRecommendation(
        observation: Observation,
        playbook: Playbook,
        weatherFeatures: WeatherFeatures,
        generatedAt: String
    ) throws -> Recommendation
}

public protocol PlaybookService {
    func fetchActivePlaybook(playbookId: String) throws -> Playbook
    func applyPatch(_ patch: PlaybookPatch, to playbook: Playbook, appliedAt: String) throws -> PatchApplyResult
}

public protocol WeatherFeaturesProvider {
    func loadDemoWeatherFeatures(
        weatherFeaturesId: String,
        profileTime: String,
        location: GeoPoint
    ) throws -> WeatherFeatures

    func fetchLiveWeatherFeatures(
        location: GeoPoint,
        atTime: String,
        providerToken: String
    ) throws -> WeatherFeatures
}

public protocol SyncService {
    func syncBatch(_ request: SyncBatchRequest, idempotencyKey: String) throws -> SyncBatchResponse
}
