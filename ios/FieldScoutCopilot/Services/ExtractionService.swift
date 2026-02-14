import Foundation

/// Extraction service that converts raw note text into structured Observation
class ExtractionServiceImpl: ExtractionService {
    
    private let cactusAdapter: CactusAdapter?
    
    init(cactusAdapter: CactusAdapter? = nil) {
        self.cactusAdapter = cactusAdapter
    }
    
    func extractObservation(
        from rawNoteText: String,
        captureMode: CaptureMode,
        transcription: ObservationTranscription,
        deviceId: String,
        location: GeoPoint
    ) async throws -> Observation {
        
        let extraction: ObservationExtraction
        
        if let adapter = cactusAdapter {
            // Try Cactus for AI extraction; fall back to rules if model isn't ready or fails
            do {
                extraction = try await adapter.extractStructuredFields(from: rawNoteText)
            } catch {
                extraction = extractWithRules(from: rawNoteText)
            }
        } else {
            extraction = extractWithRules(from: rawNoteText)
        }
        
        let normalization = normalizeFields(from: rawNoteText)
        
        let now = ISO8601DateFormatter().string(from: Date())
        let observationId = generateObservationId()
        
        return Observation(
            observationId: observationId,
            deviceId: deviceId,
            createdAt: now,
            captureMode: captureMode,
            rawNoteText: rawNoteText,
            transcription: transcription,
            extraction: extraction,
            normalization: normalization,
            location: location,
            status: .draft,
            schemaVersion: "1.0.0",
            deterministicChecksum: generateChecksum(rawNoteText)
        )
    }
    
    // MARK: - Rule-based Extraction (Fallback)
    
    private func extractWithRules(from text: String) -> ObservationExtraction {
        let lowercased = text.lowercased()
        
        // Extract issue
        let issue: Issue
        if lowercased.contains("mildew") || lowercased.contains("powder") || lowercased.contains("white") {
            issue = .powderyMildew
        } else if lowercased.contains("heat") || lowercased.contains("stress") || lowercased.contains("wilt") {
            issue = .heatStress
        } else {
            issue = .other
        }
        
        // Extract severity
        let severity: Severity
        if lowercased.contains("severe") || lowercased.contains("heavy") || lowercased.contains("high") {
            severity = .high
        } else if lowercased.contains("moderate") || lowercased.contains("medium") {
            severity = .moderate
        } else {
            severity = .low
        }
        
        // Extract field block
        let fieldBlock = extractFieldBlock(from: text)
        
        // Extract variety
        let variety = extractVariety(from: text)
        
        // Extract symptoms
        let symptoms = extractSymptoms(from: text)
        
        return ObservationExtraction(
            crop: .grape,
            variety: variety,
            fieldBlock: fieldBlock,
            issue: issue,
            severity: severity,
            symptoms: symptoms,
            observationTime: ISO8601DateFormatter().string(from: Date())
        )
    }
    
    private func extractFieldBlock(from text: String) -> String {
        // Look for "Block X" pattern
        let pattern = #"[Bb]lock\s+(\d+|[A-Z])"#
        if let regex = try? NSRegularExpression(pattern: pattern),
           let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) {
            if let range = Range(match.range, in: text) {
                return String(text[range])
            }
        }
        return "Unknown Block"
    }
    
    private func extractVariety(from text: String) -> String? {
        let varieties = ["chardonnay", "cabernet", "merlot", "pinot", "zinfandel", "sauvignon"]
        let lowercased = text.lowercased()
        
        for variety in varieties {
            if lowercased.contains(variety) {
                return variety
            }
        }
        return nil
    }
    
    private func extractSymptoms(from text: String) -> [String] {
        var symptoms: [String] = []
        
        let symptomPatterns = [
            "white powder": "white powder on leaf surfaces",
            "musty": "musty odor",
            "curl": "leaf curling",
            "wilt": "wilting",
            "spots": "visible spots",
            "dry": "dry leaves"
        ]
        
        let lowercased = text.lowercased()
        for (keyword, symptom) in symptomPatterns {
            if lowercased.contains(keyword) {
                symptoms.append(symptom)
            }
        }
        
        return symptoms.isEmpty ? ["general observation noted"] : symptoms
    }
    
    // MARK: - Normalization
    
    private func normalizeFields(from text: String) -> ObservationNormalization {
        let lowercased = text.lowercased()
        
        // Leaf wetness
        let leafWetness: LeafWetness
        if lowercased.contains("dry") {
            leafWetness = .dry
        } else if lowercased.contains("wet") || lowercased.contains("moist") {
            leafWetness = .wet
        } else if lowercased.contains("damp") {
            leafWetness = .damp
        } else {
            leafWetness = .unknown
        }
        
        // Wind estimate
        let windEstimate: Double
        if lowercased.contains("calm") || lowercased.contains("light") || lowercased.contains("still") {
            windEstimate = 8.0
        } else if lowercased.contains("moderate") || lowercased.contains("breez") {
            windEstimate = 15.0
        } else if lowercased.contains("strong") || lowercased.contains("gust") {
            windEstimate = 25.0
        } else {
            windEstimate = 10.0
        }
        
        return ObservationNormalization(
            temperatureC: nil,
            leafWetness: leafWetness,
            windEstimateKph: windEstimate
        )
    }
    
    // MARK: - Helpers
    
    private func generateObservationId() -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd"
        let dateStr = dateFormatter.string(from: Date())
        let sequence = String(format: "%04d", Int.random(in: 1...9999))
        return "obs_\(dateStr)_\(sequence)"
    }
    
    private func generateChecksum(_ text: String) -> String {
        // Simple checksum for demo
        let hash = text.utf8.reduce(0) { $0 &+ Int($1) }
        return "sha256:\(String(format: "%08X", hash))"
    }
}
