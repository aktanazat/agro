import SwiftUI

@main
struct FieldScoutCopilotApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

@MainActor
class AppState: ObservableObject {
    private let store = LocalStore.shared
    private let playbookVersionDefaultsKey = "FieldScoutCopilot.ActivePlaybookVersion"
    private let fallbackTraceId = "trace_obs_20260211_0001"

    @Published var isOfflineMode: Bool = true
    @Published var deviceId: String = "dev_ios_001"
    @Published var activePlaybookVersion: Int = 3 {
        didSet {
            UserDefaults.standard.set(activePlaybookVersion, forKey: playbookVersionDefaultsKey)
        }
    }
    
    // Current observation in progress
    @Published var currentObservation: Observation?
    @Published var currentRecommendation: Recommendation?
    
    // Navigation state
    @Published var observationFlowState: ObservationFlowState = .idle

    init() {
        if let persistedVersion = UserDefaults.standard.object(forKey: playbookVersionDefaultsKey) as? Int {
            activePlaybookVersion = persistedVersion
        }
        hydrateFromLocalStore()
    }

    func stageRecommendation(observation: Observation, recommendation: Recommendation) {
        currentObservation = observation
        currentRecommendation = recommendation
        store.saveObservation(observationWithStatus(observation, status: .confirmed))
        store.saveRecommendation(recommendation)
    }

    func confirmAndLog(observation: Observation, recommendation: Recommendation) {
        let loggedObservation = observationWithStatus(observation, status: .logged)
        let confirmedRecommendation = recommendationWithStatus(recommendation, status: .confirmed)

        store.saveObservation(loggedObservation)
        store.saveRecommendation(confirmedRecommendation)

        currentObservation = loggedObservation
        currentRecommendation = confirmedRecommendation
        observationFlowState = .logged

        recordTraceStage(
            stage: "logged",
            durationMs: 2000,
            relatedObservationId: loggedObservation.observationId,
            relatedRecommendationId: confirmedRecommendation.recommendationId
        )
    }

    func saveRecomputedRecommendation(_ recommendation: Recommendation) {
        currentRecommendation = recommendation
        activePlaybookVersion = recommendation.playbookVersion
        store.saveRecommendation(recommendation)
        recordTraceStage(
            stage: "recompute",
            durationMs: 2000,
            relatedObservationId: recommendation.observationId,
            relatedRecommendationId: recommendation.recommendationId
        )
    }

    func recentHistoryRecords(limit: Int = 20) -> [HistoryRecord] {
        let observations = store.listRecentObservations(deviceId: deviceId, limit: limit)
        return observations.map { observation in
            let recommendation = store.listRecommendationsForObservation(observationId: observation.observationId).first
            return HistoryRecord(observation: observation, recommendation: recommendation)
        }
    }

    func traceIdForCurrentObservation() -> String {
        guard let observationId = currentObservation?.observationId else { return fallbackTraceId }
        return "trace_\(observationId)"
    }

    func loadOrCreateTrace(traceId: String) -> [TraceEventRecord] {
        let existing = store.listTraceEvents(traceId: traceId)
        if !existing.isEmpty {
            return existing
        }

        let stageDurations: [(stage: String, durationMs: Int)] = [
            ("capture_start", 5000),
            ("recording", 17000),
            ("transcribing", 6000),
            ("extracting", 14000),
            ("recommending", 6000),
            ("confirmation", 14000),
            ("logged", 8000),
            ("patch_apply", 4000),
            ("recompute", 4000),
        ]
        let traceStart = Date()
        var stageStart = traceStart

        for stageDuration in stageDurations {
            let stageEnd = stageStart.addingTimeInterval(Double(stageDuration.durationMs) / 1000)
            store.recordTraceEvent(
                traceId: traceId,
                stage: stageDuration.stage,
                startedAt: stageStart,
                endedAt: stageEnd,
                status: "completed",
                relatedObservationId: currentObservation?.observationId,
                relatedRecommendationId: currentRecommendation?.recommendationId
            )
            stageStart = stageEnd
        }

        return store.listTraceEvents(traceId: traceId)
    }

    func recordTraceStage(
        stage: String,
        durationMs: Int,
        status: String = "completed",
        relatedObservationId: String? = nil,
        relatedRecommendationId: String? = nil
    ) {
        let traceId = traceIdForCurrentObservation()
        let endedAt = Date()
        let startedAt = endedAt.addingTimeInterval(-Double(durationMs) / 1000)
        store.recordTraceEvent(
            traceId: traceId,
            stage: stage,
            startedAt: startedAt,
            endedAt: endedAt,
            status: status,
            relatedObservationId: relatedObservationId ?? currentObservation?.observationId,
            relatedRecommendationId: relatedRecommendationId ?? currentRecommendation?.recommendationId
        )
    }

    private func hydrateFromLocalStore() {
        guard let observation = store.listRecentObservations(deviceId: deviceId, limit: 1).first else {
            return
        }
        currentObservation = observation

        if let recommendation = store.listRecommendationsForObservation(observationId: observation.observationId).first {
            currentRecommendation = recommendation
            activePlaybookVersion = recommendation.playbookVersion
            observationFlowState = recommendation.status == .confirmed ? .logged : .recommendationReady
        } else {
            observationFlowState = observation.status == .logged ? .logged : .extracted
        }
    }

    private func observationWithStatus(_ observation: Observation, status: ObservationStatus) -> Observation {
        Observation(
            observationId: observation.observationId,
            deviceId: observation.deviceId,
            createdAt: observation.createdAt,
            captureMode: observation.captureMode,
            rawNoteText: observation.rawNoteText,
            transcription: observation.transcription,
            extraction: observation.extraction,
            normalization: observation.normalization,
            location: observation.location,
            status: status,
            schemaVersion: observation.schemaVersion,
            deterministicChecksum: observation.deterministicChecksum
        )
    }

    private func recommendationWithStatus(_ recommendation: Recommendation, status: RecommendationStatus) -> Recommendation {
        Recommendation(
            recommendationId: recommendation.recommendationId,
            observationId: recommendation.observationId,
            playbookId: recommendation.playbookId,
            playbookVersion: recommendation.playbookVersion,
            weatherFeaturesId: recommendation.weatherFeaturesId,
            generatedAt: recommendation.generatedAt,
            issue: recommendation.issue,
            severity: recommendation.severity,
            action: recommendation.action,
            rationale: recommendation.rationale,
            timingWindow: recommendation.timingWindow,
            riskFlags: recommendation.riskFlags,
            requiredConfirmation: recommendation.requiredConfirmation,
            status: status
        )
    }
}

struct HistoryRecord {
    let observation: Observation
    let recommendation: Recommendation?
}

enum ObservationFlowState {
    case idle
    case recording
    case transcribing
    case extracting
    case extracted
    case recommending
    case recommendationReady
    case confirmed
    case logged
}
