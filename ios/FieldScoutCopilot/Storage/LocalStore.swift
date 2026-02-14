import Foundation

/// Local storage for observations, recommendations, and sync state
class LocalStore {
    
    static let shared = LocalStore()
    
    private var observations: [String: Observation] = [:]
    private var recommendations: [String: Recommendation] = [:]
    private var traceEvents: [TraceEventRecord] = []
    private var syncQueue: [SyncQueueItem] = []
    
    private init() {}
    
    // MARK: - Observations
    
    func saveObservation(_ observation: Observation) {
        observations[observation.observationId] = observation
        
        // Add to sync queue
        syncQueue.append(SyncQueueItem(
            entityType: .observation,
            entityId: observation.observationId,
            addedAt: Date(),
            synced: false
        ))
    }
    
    func fetchObservation(observationId: String) -> Observation? {
        return observations[observationId]
    }
    
    func listRecentObservations(deviceId: String, limit: Int) -> [Observation] {
        return observations.values
            .filter { $0.deviceId == deviceId }
            .sorted { $0.createdAt > $1.createdAt }
            .prefix(limit)
            .map { $0 }
    }
    
    // MARK: - Recommendations
    
    func saveRecommendation(_ recommendation: Recommendation) {
        recommendations[recommendation.recommendationId] = recommendation
        
        syncQueue.append(SyncQueueItem(
            entityType: .recommendation,
            entityId: recommendation.recommendationId,
            addedAt: Date(),
            synced: false
        ))
    }
    
    func fetchRecommendation(recommendationId: String) -> Recommendation? {
        return recommendations[recommendationId]
    }
    
    func listRecommendationsForObservation(observationId: String) -> [Recommendation] {
        return recommendations.values
            .filter { $0.observationId == observationId }
            .sorted { $0.generatedAt > $1.generatedAt }
    }
    
    // MARK: - Trace Events
    
    func recordTraceEvent(
        traceId: String,
        stage: String,
        startedAt: Date,
        endedAt: Date,
        status: String,
        relatedObservationId: String? = nil,
        relatedRecommendationId: String? = nil
    ) {
        let event = TraceEventRecord(
            traceId: traceId,
            stage: stage,
            startedAt: startedAt,
            endedAt: endedAt,
            durationMs: Int(endedAt.timeIntervalSince(startedAt) * 1000),
            status: status,
            relatedObservationId: relatedObservationId,
            relatedRecommendationId: relatedRecommendationId
        )
        traceEvents.append(event)
    }
    
    func listTraceEvents(traceId: String) -> [TraceEventRecord] {
        return traceEvents
            .filter { $0.traceId == traceId }
            .sorted { $0.startedAt < $1.startedAt }
    }
    
    // MARK: - Sync Queue
    
    func pendingSyncItems() -> [SyncQueueItem] {
        return syncQueue.filter { !$0.synced }
    }
    
    func markSynced(entityId: String) {
        if let index = syncQueue.firstIndex(where: { $0.entityId == entityId }) {
            syncQueue[index].synced = true
        }
    }
    
    // MARK: - Clear (for testing)
    
    func clearAll() {
        observations.removeAll()
        recommendations.removeAll()
        traceEvents.removeAll()
        syncQueue.removeAll()
    }
}

// MARK: - Supporting Types

struct TraceEventRecord {
    let traceId: String
    let stage: String
    let startedAt: Date
    let endedAt: Date
    let durationMs: Int
    let status: String
    let relatedObservationId: String?
    let relatedRecommendationId: String?
}

struct SyncQueueItem {
    let entityType: SyncEntityType
    let entityId: String
    let addedAt: Date
    var synced: Bool
}
