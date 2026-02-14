import Foundation
import SQLite3

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

/// Local storage for observations, recommendations, and sync state
class LocalStore {
    
    static let shared = LocalStore()
    private let queue = DispatchQueue(label: "FieldScoutCopilot.LocalStore")
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private var db: OpaquePointer?
    
    private init() {
        openDatabase()
        createTables()
    }
    
    deinit {
        sqlite3_close(db)
    }
    
    // MARK: - Observations
    
    func saveObservation(_ observation: Observation) {
        queue.sync {
            guard let payload = encodedString(observation) else { return }
            let sql = """
            INSERT OR REPLACE INTO observations (observation_id, device_id, created_at, payload_json)
            VALUES (?, ?, ?, ?);
            """
            guard let statement = prepare(sql) else { return }
            defer { sqlite3_finalize(statement) }
            
            bindText(observation.observationId, to: statement, index: 1)
            bindText(observation.deviceId, to: statement, index: 2)
            bindText(observation.createdAt, to: statement, index: 3)
            bindText(payload, to: statement, index: 4)
            
            guard sqlite3_step(statement) == SQLITE_DONE else { return }
            enqueueSyncItem(entityType: .observation, entityId: observation.observationId)
        }
    }
    
    func fetchObservation(observationId: String) -> Observation? {
        queue.sync {
            let sql = "SELECT payload_json FROM observations WHERE observation_id = ? LIMIT 1;"
            guard let statement = prepare(sql) else { return nil }
            defer { sqlite3_finalize(statement) }
            bindText(observationId, to: statement, index: 1)
            
            guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
            guard let payload = sqliteColumnText(statement, index: 0) else { return nil }
            return decoded(Observation.self, from: payload)
        }
    }
    
    func listRecentObservations(deviceId: String, limit: Int) -> [Observation] {
        queue.sync {
            let sql = """
            SELECT payload_json
            FROM observations
            WHERE device_id = ?
            ORDER BY created_at DESC
            LIMIT ?;
            """
            guard let statement = prepare(sql) else { return [] }
            defer { sqlite3_finalize(statement) }
            
            bindText(deviceId, to: statement, index: 1)
            sqlite3_bind_int(statement, 2, Int32(limit))
            
            var rows: [Observation] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                guard let payload = sqliteColumnText(statement, index: 0),
                      let observation = decoded(Observation.self, from: payload) else { continue }
                rows.append(observation)
            }
            return rows
        }
    }
    
    // MARK: - Recommendations
    
    func saveRecommendation(_ recommendation: Recommendation) {
        queue.sync {
            guard let payload = encodedString(recommendation) else { return }
            let sql = """
            INSERT OR REPLACE INTO recommendations (recommendation_id, observation_id, generated_at, payload_json)
            VALUES (?, ?, ?, ?);
            """
            guard let statement = prepare(sql) else { return }
            defer { sqlite3_finalize(statement) }
            
            bindText(recommendation.recommendationId, to: statement, index: 1)
            bindText(recommendation.observationId, to: statement, index: 2)
            bindText(recommendation.generatedAt, to: statement, index: 3)
            bindText(payload, to: statement, index: 4)
            
            guard sqlite3_step(statement) == SQLITE_DONE else { return }
            enqueueSyncItem(entityType: .recommendation, entityId: recommendation.recommendationId)
        }
    }
    
    func fetchRecommendation(recommendationId: String) -> Recommendation? {
        queue.sync {
            let sql = "SELECT payload_json FROM recommendations WHERE recommendation_id = ? LIMIT 1;"
            guard let statement = prepare(sql) else { return nil }
            defer { sqlite3_finalize(statement) }
            bindText(recommendationId, to: statement, index: 1)
            
            guard sqlite3_step(statement) == SQLITE_ROW else { return nil }
            guard let payload = sqliteColumnText(statement, index: 0) else { return nil }
            return decoded(Recommendation.self, from: payload)
        }
    }
    
    func listRecommendationsForObservation(observationId: String) -> [Recommendation] {
        queue.sync {
            let sql = """
            SELECT payload_json
            FROM recommendations
            WHERE observation_id = ?
            ORDER BY generated_at DESC;
            """
            guard let statement = prepare(sql) else { return [] }
            defer { sqlite3_finalize(statement) }
            
            bindText(observationId, to: statement, index: 1)
            
            var rows: [Recommendation] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                guard let payload = sqliteColumnText(statement, index: 0),
                      let recommendation = decoded(Recommendation.self, from: payload) else { continue }
                rows.append(recommendation)
            }
            return rows
        }
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
        queue.sync {
            let sql = """
            INSERT INTO trace_events (
              trace_id, stage, started_at, ended_at, duration_ms, status, related_observation_id, related_recommendation_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
            """
            guard let statement = prepare(sql) else { return }
            defer { sqlite3_finalize(statement) }
            
            bindText(traceId, to: statement, index: 1)
            bindText(stage, to: statement, index: 2)
            sqlite3_bind_double(statement, 3, startedAt.timeIntervalSince1970)
            sqlite3_bind_double(statement, 4, endedAt.timeIntervalSince1970)
            sqlite3_bind_int(statement, 5, Int32(endedAt.timeIntervalSince(startedAt) * 1000))
            bindText(status, to: statement, index: 6)
            bindOptionalText(relatedObservationId, to: statement, index: 7)
            bindOptionalText(relatedRecommendationId, to: statement, index: 8)
            
            sqlite3_step(statement)
        }
    }
    
    func listTraceEvents(traceId: String) -> [TraceEventRecord] {
        queue.sync {
            let sql = """
            SELECT stage, started_at, ended_at, duration_ms, status, related_observation_id, related_recommendation_id
            FROM trace_events
            WHERE trace_id = ?
            ORDER BY started_at ASC;
            """
            guard let statement = prepare(sql) else { return [] }
            defer { sqlite3_finalize(statement) }
            bindText(traceId, to: statement, index: 1)
            
            var rows: [TraceEventRecord] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                let stage = sqliteColumnText(statement, index: 0) ?? ""
                let startedAt = Date(timeIntervalSince1970: sqlite3_column_double(statement, 1))
                let endedAt = Date(timeIntervalSince1970: sqlite3_column_double(statement, 2))
                let durationMs = Int(sqlite3_column_int(statement, 3))
                let status = sqliteColumnText(statement, index: 4) ?? ""
                let relatedObservationId = sqliteColumnText(statement, index: 5)
                let relatedRecommendationId = sqliteColumnText(statement, index: 6)
                
                rows.append(TraceEventRecord(
                    traceId: traceId,
                    stage: stage,
                    startedAt: startedAt,
                    endedAt: endedAt,
                    durationMs: durationMs,
                    status: status,
                    relatedObservationId: relatedObservationId,
                    relatedRecommendationId: relatedRecommendationId
                ))
            }
            return rows
        }
    }
    
    // MARK: - Sync Queue
    
    func pendingSyncItems() -> [SyncQueueItem] {
        queue.sync {
            let sql = """
            SELECT entity_type, entity_id, added_at, synced
            FROM sync_queue
            WHERE synced = 0
            ORDER BY added_at ASC;
            """
            guard let statement = prepare(sql) else { return [] }
            defer { sqlite3_finalize(statement) }
            
            var items: [SyncQueueItem] = []
            while sqlite3_step(statement) == SQLITE_ROW {
                guard let entityTypeRaw = sqliteColumnText(statement, index: 0),
                      let entityType = SyncEntityType(rawValue: entityTypeRaw),
                      let entityId = sqliteColumnText(statement, index: 1) else { continue }
                let addedAt = Date(timeIntervalSince1970: sqlite3_column_double(statement, 2))
                let synced = sqlite3_column_int(statement, 3) == 1
                items.append(SyncQueueItem(entityType: entityType, entityId: entityId, addedAt: addedAt, synced: synced))
            }
            return items
        }
    }
    
    func markSynced(entityId: String) {
        queue.sync {
            let sql = "UPDATE sync_queue SET synced = 1 WHERE entity_id = ?;"
            guard let statement = prepare(sql) else { return }
            defer { sqlite3_finalize(statement) }
            bindText(entityId, to: statement, index: 1)
            sqlite3_step(statement)
        }
    }
    
    // MARK: - Clear (for testing)
    
    func clearAll() {
        queue.sync {
            execute("DELETE FROM observations;")
            execute("DELETE FROM recommendations;")
            execute("DELETE FROM trace_events;")
            execute("DELETE FROM sync_queue;")
        }
    }
    
    // MARK: - SQLite
    
    private func openDatabase() {
        let dbURL = databaseURL()
        let directory = dbURL.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        
        if sqlite3_open(dbURL.path, &db) != SQLITE_OK {
            fatalError("Unable to open SQLite database")
        }
    }
    
    private func createTables() {
        execute("""
        CREATE TABLE IF NOT EXISTS observations (
          observation_id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          created_at TEXT NOT NULL,
          payload_json TEXT NOT NULL
        );
        """)
        
        execute("""
        CREATE TABLE IF NOT EXISTS recommendations (
          recommendation_id TEXT PRIMARY KEY,
          observation_id TEXT NOT NULL,
          generated_at TEXT NOT NULL,
          payload_json TEXT NOT NULL
        );
        """)
        
        execute("""
        CREATE TABLE IF NOT EXISTS trace_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          trace_id TEXT NOT NULL,
          stage TEXT NOT NULL,
          started_at REAL NOT NULL,
          ended_at REAL NOT NULL,
          duration_ms INTEGER NOT NULL,
          status TEXT NOT NULL,
          related_observation_id TEXT,
          related_recommendation_id TEXT
        );
        """)
        
        execute("""
        CREATE TABLE IF NOT EXISTS sync_queue (
          entity_id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          added_at REAL NOT NULL,
          synced INTEGER NOT NULL
        );
        """)
    }
    
    private func databaseURL() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
        return base.appendingPathComponent("FieldScoutCopilot.sqlite")
    }
    
    private func prepare(_ sql: String) -> OpaquePointer? {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK else {
            return nil
        }
        return statement
    }
    
    private func execute(_ sql: String) {
        sqlite3_exec(db, sql, nil, nil, nil)
    }
    
    private func enqueueSyncItem(entityType: SyncEntityType, entityId: String) {
        let sql = """
        INSERT OR REPLACE INTO sync_queue (entity_id, entity_type, added_at, synced)
        VALUES (?, ?, ?, 0);
        """
        guard let statement = prepare(sql) else { return }
        defer { sqlite3_finalize(statement) }
        bindText(entityId, to: statement, index: 1)
        bindText(entityType.rawValue, to: statement, index: 2)
        sqlite3_bind_double(statement, 3, Date().timeIntervalSince1970)
        sqlite3_step(statement)
    }
    
    private func bindOptionalText(_ value: String?, to statement: OpaquePointer?, index: Int32) {
        if let value {
            bindText(value, to: statement, index: index)
        } else {
            sqlite3_bind_null(statement, index)
        }
    }
    
    private func bindText(_ value: String, to statement: OpaquePointer?, index: Int32) {
        sqlite3_bind_text(statement, index, (value as NSString).utf8String, -1, SQLITE_TRANSIENT)
    }
    
    private func sqliteColumnText(_ statement: OpaquePointer?, index: Int32) -> String? {
        guard let cString = sqlite3_column_text(statement, index) else { return nil }
        return String(cString: cString)
    }
    
    private func encodedString<T: Encodable>(_ model: T) -> String? {
        guard let data = try? encoder.encode(model) else { return nil }
        return String(data: data, encoding: .utf8)
    }
    
    private func decoded<T: Decodable>(_ type: T.Type, from json: String) -> T? {
        guard let data = json.data(using: .utf8) else { return nil }
        return try? decoder.decode(type, from: data)
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
