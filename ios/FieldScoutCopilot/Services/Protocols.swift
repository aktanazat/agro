import Foundation

// MARK: - Repository Protocols

public protocol ObservationRepository {
    func saveObservation(_ observation: Observation) throws
    func fetchObservation(observationId: String) throws -> Observation?
    func listRecentObservations(deviceId: String, limit: Int) throws -> [Observation]
}

public protocol RecommendationRepository {
    func saveRecommendation(_ recommendation: Recommendation) throws
    func fetchRecommendation(recommendationId: String) throws -> Recommendation?
    func listRecommendationsForObservation(observationId: String) throws -> [Recommendation]
}

// MARK: - Service Protocols

public protocol ExtractionService {
    func extractObservation(
        from rawNoteText: String,
        captureMode: CaptureMode,
        transcription: ObservationTranscription,
        deviceId: String,
        location: GeoPoint
    ) async throws -> Observation
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
    ) async throws -> WeatherFeatures
}

public protocol SyncService {
    func syncBatch(_ request: SyncBatchRequest, idempotencyKey: String) async throws -> SyncBatchResponse
}

// MARK: - Adapter Protocols

public protocol CactusAdapter {
    func extractStructuredFields(from text: String) async throws -> ObservationExtraction
    func transcribeAudio(from audioData: Data) async throws -> ObservationTranscription
}
