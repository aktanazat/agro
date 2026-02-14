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
    private let syncService: SyncService = SyncServiceImpl()
    private let playbookVersionDefaultsKey = "FieldScoutCopilot.ActivePlaybookVersion"
    private let syncCursorDefaultsKey = "FieldScoutCopilot.ServerCursor"
    private let lastSyncAtDefaultsKey = "FieldScoutCopilot.LastSyncAt"
    private let fallbackTraceId = "trace_obs_20260211_0001"
    private var isSyncInFlight = false

    @Published var isOfflineMode: Bool = ProcessInfo.processInfo.environment["FIELD_SCOUT_OFFLINE_MODE"] == "true"
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
        triggerSyncIfNeeded()
    }

    func stageRecommendation(observation: Observation, recommendation: Recommendation) {
        currentObservation = observation
        currentRecommendation = recommendation
        store.saveObservation(observationWithStatus(observation, status: .confirmed))
        store.saveRecommendation(recommendation)
        triggerSyncIfNeeded()
    }

    func confirmAndLog(observation: Observation, recommendation: Recommendation) {
        let loggedObservation = observationWithStatus(observation, status: .logged)
        let confirmedRecommendation = recommendationWithStatus(recommendation, status: .confirmed)

        store.saveObservation(loggedObservation)
        store.saveRecommendation(confirmedRecommendation)

        currentObservation = loggedObservation
        currentRecommendation = confirmedRecommendation
        observationFlowState = .logged

        triggerSyncIfNeeded()

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
        triggerSyncIfNeeded()
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

    private func triggerSyncIfNeeded() {
        guard !isOfflineMode else { return }
        guard !isSyncInFlight else { return }

        let pendingItems = store.pendingSyncItems()
        guard !pendingItems.isEmpty else { return }
        guard let request = makeSyncRequest(from: pendingItems) else { return }

        isSyncInFlight = true
        Task {
            do {
                let response = try await syncService.syncBatch(request, idempotencyKey: request.syncId)
                await MainActor.run {
                    pendingItems.forEach { store.markSynced(entityId: $0.entityId) }
                    UserDefaults.standard.set(response.serverCursor, forKey: syncCursorDefaultsKey)
                    UserDefaults.standard.set(response.acceptedAt, forKey: lastSyncAtDefaultsKey)
                    isSyncInFlight = false
                }
            } catch {
                await MainActor.run {
                    isSyncInFlight = false
                }
            }
        }
    }

    private func makeSyncRequest(from items: [SyncQueueItem]) -> SyncBatchRequest? {
        var observations: [Observation] = []
        var recommendations: [Recommendation] = []

        for item in items {
            switch item.entityType {
            case .observation:
                if let observation = store.fetchObservation(observationId: item.entityId) {
                    observations.append(observation)
                }
            case .recommendation:
                if let recommendation = store.fetchRecommendation(recommendationId: item.entityId) {
                    recommendations.append(recommendation)
                }
            case .playbookPatch:
                continue
            }
        }

        if observations.isEmpty && recommendations.isEmpty {
            return nil
        }

        let requestedAt = ISO8601DateFormatter().string(from: Date())
        let cursor = UserDefaults.standard.string(forKey: syncCursorDefaultsKey) ?? "cur_20260211_0000"
        let lastSyncAt = UserDefaults.standard.string(forKey: lastSyncAtDefaultsKey)
        let device = Device(
            deviceId: deviceId,
            platform: .ios,
            appVersion: appVersionString(),
            modelPackageVersion: "q4_2026_02",
            offlineModeEnabled: isOfflineMode,
            lastSyncAt: lastSyncAt,
            updatedAt: requestedAt
        )

        return SyncBatchRequest(
            syncId: generateSyncId(),
            requestedAt: requestedAt,
            device: device,
            lastKnownServerCursor: cursor,
            upserts: SyncUpserts(
                observations: observations,
                recommendations: recommendations,
                playbookPatches: []
            )
        )
    }

    private func generateSyncId() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd"
        let date = formatter.string(from: Date())
        let sequence = String(format: "%04d", Int(Date().timeIntervalSince1970) % 10000)
        return "sync_\(date)_\(sequence)"
    }

    private func appVersionString() -> String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1.0"
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
