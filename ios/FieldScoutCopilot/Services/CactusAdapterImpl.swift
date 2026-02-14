import Foundation
import Cactus

enum CactusAdapterError: LocalizedError {
    case modelNotReady
    case invalidResponse(String)
    case transcriptionFailed(String)

    var errorDescription: String? {
        switch self {
        case .modelNotReady:
            return "Cactus model is not loaded yet"
        case .invalidResponse(let detail):
            return "Failed to parse model response: \(detail)"
        case .transcriptionFailed(let detail):
            return "Transcription failed: \(detail)"
        }
    }
}

/// Implements `CactusAdapter` using on-device Cactus LLM inference.
final class CactusAdapterImpl: CactusAdapter {
    private let modelManager: CactusModelManager

    init(modelManager: CactusModelManager) {
        self.modelManager = modelManager
    }

    func extractStructuredFields(from text: String) async throws -> ObservationExtraction {
        guard let model = await modelManager.getLanguageModel() else {
            throw CactusAdapterError.modelNotReady
        }

        let systemPrompt = """
        You are a structured data extractor for vineyard field observations. \
        Extract the following fields from the user's observation text and return ONLY valid JSON. \
        Do not include any explanation or markdown formatting.

        Fields:
        - crop: always "grape"
        - variety: the grape variety mentioned (e.g. "chardonnay", "cabernet"), or null if not mentioned
        - fieldBlock: the block identifier (e.g. "Block 3"), or "Unknown Block" if not mentioned
        - issue: one of "powdery_mildew", "heat_stress", or "other"
        - severity: one of "low", "moderate", or "high"
        - symptoms: array of symptom descriptions
        - observationTime: current ISO 8601 timestamp

        Example output:
        {"crop":"grape","variety":"chardonnay","fieldBlock":"Block 3","issue":"powdery_mildew","severity":"moderate","symptoms":["white powder on leaves"],"observationTime":"2025-06-15T10:30:00Z"}
        """

        let completion = try await runInference(model: model, system: systemPrompt, user: text)
        return try parseExtraction(from: completion)
    }

    func transcribeAudio(from audioData: Data) async throws -> ObservationTranscription {
        // The Cactus SDK does not include audio transcription.
        // Voice transcription is handled by Apple's Speech framework in NewObservationView.
        throw CactusAdapterError.transcriptionFailed(
            "Audio transcription is handled by the Speech framework, not Cactus"
        )
    }

    func generateRecommendation(
        observation: Observation,
        playbook: Playbook,
        weatherFeatures: WeatherFeatures
    ) async throws -> CactusRecommendationResult {
        guard let model = await modelManager.getLanguageModel() else {
            throw CactusAdapterError.modelNotReady
        }

        let rule = playbook.rules.rulePmModerate // Select based on issue in prompt context
        let systemPrompt = """
        You are a vineyard field scout advisor. Given an observation, playbook rules, and weather conditions, \
        generate a recommendation. Return ONLY valid JSON with these fields:
        - action: a concise action instruction string
        - rationale: an array of short reasoning strings explaining why this action is recommended
        - timingOffsetHours: optional object with "start" and "end" (doubles) representing hours from now

        Example output:
        {"action":"Apply sulfur spray at 5 lb/acre","rationale":["Powdery mildew detected at moderate severity","Humidity conditions favor fungal spread","Spray window score is adequate"],"timingOffsetHours":{"start":6,"end":14}}
        """

        let userPrompt = """
        Observation: \(observation.rawNoteText)
        Issue: \(observation.extraction.issue.rawValue), Severity: \(observation.extraction.severity.rawValue)
        Symptoms: \(observation.extraction.symptoms.joined(separator: ", "))
        Field: \(observation.extraction.fieldBlock), Crop: \(observation.extraction.crop.rawValue)

        Playbook rule action: \(rule.action.instructions)
        Playbook constraints: maxWindKph=\(rule.constraints.maxWindKph)

        Weather: inversionPresent=\(weatherFeatures.inversionPresent), \
        humidityLayering=\(weatherFeatures.humidityLayering.rawValue), \
        windShear=\(weatherFeatures.windShearProxy.rawValue), \
        sprayWindowScore=\(weatherFeatures.sprayWindowScore), \
        diseaseRisk=\(weatherFeatures.diseaseRiskScore), \
        heatStress=\(weatherFeatures.heatStressScore)
        """

        let completion = try await runInference(model: model, system: systemPrompt, user: userPrompt)
        return try parseRecommendation(from: completion)
    }

    // MARK: - Private

    /// Runs blocking Cactus inference off the main thread.
    private func runInference(model: CactusLanguageModel, system: String, user: String) async throws -> String {
        let task = Task.detached { () throws -> String in
            let options = CactusLanguageModel.ChatCompletion.Options(
                maxTokens: 512,
                temperature: 0.1,
                topP: 0.9,
                topK: 20
            )
            let completion = try model.chatCompletion(
                messages: [.system(system), .user(user)],
                options: options
            )
            return completion.response
        }
        return try await task.value
    }

    /// Parses the JSON response from the model into an `ObservationExtraction`.
    private func parseExtraction(from response: String) throws -> ObservationExtraction {
        // Strip any markdown code fences the model may have added
        let cleaned = response
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = cleaned.data(using: .utf8) else {
            throw CactusAdapterError.invalidResponse("Could not encode response as UTF-8")
        }

        // Decode into an intermediate struct to handle raw string enums
        let raw = try JSONDecoder().decode(RawExtraction.self, from: data)

        let issue: Issue
        switch raw.issue {
        case "powdery_mildew": issue = .powderyMildew
        case "heat_stress": issue = .heatStress
        default: issue = .other
        }

        let severity: Severity
        switch raw.severity {
        case "low": severity = .low
        case "moderate": severity = .moderate
        case "high": severity = .high
        default: severity = .moderate
        }

        return ObservationExtraction(
            crop: .grape,
            variety: raw.variety,
            fieldBlock: raw.fieldBlock ?? "Unknown Block",
            issue: issue,
            severity: severity,
            symptoms: raw.symptoms ?? ["general observation noted"],
            observationTime: raw.observationTime ?? ISO8601DateFormatter().string(from: Date())
        )
    }

    /// Parses the JSON response from the model into a `CactusRecommendationResult`.
    private func parseRecommendation(from response: String) throws -> CactusRecommendationResult {
        let cleaned = response
            .replacingOccurrences(of: "```json", with: "")
            .replacingOccurrences(of: "```", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard let data = cleaned.data(using: .utf8) else {
            throw CactusAdapterError.invalidResponse("Could not encode response as UTF-8")
        }

        let raw = try JSONDecoder().decode(RawRecommendation.self, from: data)

        let timing: (start: Double, end: Double)?
        if let offset = raw.timingOffsetHours {
            timing = (start: offset.start, end: offset.end)
        } else {
            timing = nil
        }

        return CactusRecommendationResult(
            action: raw.action,
            rationale: raw.rationale,
            timingReasoningHours: timing
        )
    }
}

/// Intermediate type for flexible JSON parsing of recommendation output.
private struct RawRecommendation: Codable {
    let action: String
    let rationale: [String]
    let timingOffsetHours: TimingOffset?

    struct TimingOffset: Codable {
        let start: Double
        let end: Double
    }
}

/// Intermediate type for flexible JSON parsing from model output.
private struct RawExtraction: Codable {
    let crop: String?
    let variety: String?
    let fieldBlock: String?
    let issue: String
    let severity: String
    let symptoms: [String]?
    let observationTime: String?
}
