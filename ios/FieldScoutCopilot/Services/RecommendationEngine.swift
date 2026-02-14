import Foundation

/// Deterministic recommendation engine based on playbook rules and weather features.
/// When a `CactusAdapter` is provided, uses on-device LLM for richer action text and rationale,
/// falling back to deterministic output if the adapter is nil or throws.
class RecommendationEngine: RecommendationService {

    private let cactusAdapter: CactusAdapter?

    init(cactusAdapter: CactusAdapter? = nil) {
        self.cactusAdapter = cactusAdapter
    }

    func generateRecommendation(
        observation: Observation,
        playbook: Playbook,
        weatherFeatures: WeatherFeatures,
        generatedAt: String
    ) async throws -> Recommendation {

        // Select rule based on issue and severity
        let rule = selectRule(
            from: playbook,
            issue: observation.extraction.issue,
            severity: observation.extraction.severity
        )

        // If no matching rule, return a default "monitor" recommendation
        guard let rule else {
            let recommendationId = generateRecommendationId()
            let now = Date()
            return Recommendation(
                recommendationId: recommendationId,
                observationId: observation.observationId,
                playbookId: playbook.playbookId,
                playbookVersion: playbook.version,
                weatherFeaturesId: weatherFeatures.weatherFeaturesId,
                generatedAt: generatedAt,
                issue: observation.extraction.issue,
                severity: observation.extraction.severity,
                action: "Monitor affected area and reassess in 24 hours.",
                rationale: ["standard_monitoring_window"],
                timingWindow: RecommendationTimingWindow(
                    startAt: formatISO8601(now.addingTimeInterval(8 * 3600)),
                    endAt: formatISO8601(now.addingTimeInterval(12 * 3600)),
                    localTimezone: "America/Los_Angeles",
                    confidence: 0.6,
                    drivers: ["noMatchingPlaybookRule=true"]
                ),
                riskFlags: [.manualReviewRequired],
                requiredConfirmation: true,
                status: .pendingConfirmation
            )
        }

        // Try LLM-generated action and rationale; fall back to deterministic
        var action = rule.action.instructions
        var rationale: [String] = []

        if let adapter = cactusAdapter {
            do {
                let llmResult = try await adapter.generateRecommendation(
                    observation: observation,
                    playbook: playbook,
                    weatherFeatures: weatherFeatures
                )
                action = llmResult.action
                rationale = llmResult.rationale
            } catch {
                // LLM unavailable — fall through to deterministic rationale below
            }
        }

        // Calculate base timing window
        var window = calculateBaseWindow(rule: rule, referenceTime: Date())

        // Adjust window based on weather features (also appends deterministic rationale tags)
        var weatherRationale: [String] = []
        window = adjustForWeather(
            window: window,
            weatherFeatures: weatherFeatures,
            rule: rule,
            rationale: &weatherRationale
        )

        // If LLM didn't provide rationale, use deterministic tags
        if rationale.isEmpty {
            rationale = weatherRationale
        }

        // Check constraints
        let riskFlags = evaluateConstraints(rule: rule, weatherFeatures: weatherFeatures)

        // Build drivers list
        let drivers = buildDriversList(weatherFeatures: weatherFeatures, rule: rule)

        let recommendationId = generateRecommendationId()

        return Recommendation(
            recommendationId: recommendationId,
            observationId: observation.observationId,
            playbookId: playbook.playbookId,
            playbookVersion: playbook.version,
            weatherFeaturesId: weatherFeatures.weatherFeaturesId,
            generatedAt: generatedAt,
            issue: observation.extraction.issue,
            severity: observation.extraction.severity,
            action: action,
            rationale: rationale,
            timingWindow: RecommendationTimingWindow(
                startAt: formatISO8601(window.start),
                endAt: formatISO8601(window.end),
                localTimezone: "America/Los_Angeles",
                confidence: calculateConfidence(weatherFeatures: weatherFeatures),
                drivers: drivers
            ),
            riskFlags: riskFlags,
            requiredConfirmation: true,
            status: .pendingConfirmation
        )
    }
    
    // MARK: - Rule Selection
    
    private func selectRule(from playbook: Playbook, issue: Issue, severity: Severity) -> PlaybookRule? {
        switch (issue, severity) {
        case (.powderyMildew, .moderate), (.powderyMildew, .low), (.powderyMildew, .high):
            return playbook.rules.rulePmModerate
        case (.heatStress, .moderate), (.heatStress, .low), (.heatStress, .high):
            return playbook.rules.ruleHeatModerate
        default:
            return nil
        }
    }
    
    // MARK: - Timing Window
    
    struct TimingWindow {
        var start: Date
        var end: Date
    }
    
    private func calculateBaseWindow(rule: PlaybookRule, referenceTime: Date) -> TimingWindow {
        let startOffset = rule.timing.baseWindowHours.startOffsetHours * 3600
        let endOffset = rule.timing.baseWindowHours.endOffsetHours * 3600
        
        return TimingWindow(
            start: referenceTime.addingTimeInterval(startOffset),
            end: referenceTime.addingTimeInterval(endOffset)
        )
    }
    
    private func adjustForWeather(
        window: TimingWindow,
        weatherFeatures: WeatherFeatures,
        rule: PlaybookRule,
        rationale: inout [String]
    ) -> TimingWindow {
        var adjusted = window
        
        for adjustment in rule.timing.weatherAdjustments {
            if shouldApplyAdjustment(adjustment: adjustment, weatherFeatures: weatherFeatures) {
                adjusted.start = adjusted.start.addingTimeInterval(Double(adjustment.shiftStartMinutes) * 60)
                adjusted.end = adjusted.end.addingTimeInterval(Double(adjustment.shiftEndMinutes) * 60)
                rationale.append(adjustment.rationaleTag)
            }
        }
        
        // Default rationale if none applied
        if rationale.isEmpty {
            rationale.append("standard_timing")
        }
        
        return adjusted
    }
    
    private func shouldApplyAdjustment(adjustment: RuleWeatherAdjustment, weatherFeatures: WeatherFeatures) -> Bool {
        switch adjustment.feature {
        case .inversionPresent:
            return weatherFeatures.inversionPresent && adjustment.condition == "true"
        case .humidityLayering:
            return weatherFeatures.humidityLayering.rawValue == adjustment.condition
        case .windShearProxy:
            return weatherFeatures.windShearProxy.rawValue == adjustment.condition
        case .sprayWindowScore:
            // Parse condition like "< 0.4"
            if let threshold = Double(adjustment.condition.replacingOccurrences(of: "< ", with: "")) {
                return weatherFeatures.sprayWindowScore < threshold
            }
            return false
        case .diseaseRiskScore:
            return weatherFeatures.diseaseRiskScore > 0.6
        case .heatStressScore:
            return weatherFeatures.heatStressScore > 0.6
        }
    }
    
    // MARK: - Constraints
    
    private func evaluateConstraints(rule: PlaybookRule, weatherFeatures: WeatherFeatures) -> [RiskFlag] {
        var flags: [RiskFlag] = []
        
        if weatherFeatures.sourceMode == .none {
            flags.append(.weatherDataMissing)
        }
        
        if weatherFeatures.windShearProxy == .high {
            flags.append(.highDriftRisk)
        }
        
        if weatherFeatures.sprayWindowScore < 0.4 {
            flags.append(.lowConfidence)
        }
        
        return flags
    }
    
    // MARK: - Drivers
    
    private func buildDriversList(weatherFeatures: WeatherFeatures, rule: PlaybookRule) -> [String] {
        var drivers: [String] = []
        
        drivers.append("inversionPresent=\(weatherFeatures.inversionPresent)")
        drivers.append("humidityLayering=\(weatherFeatures.humidityLayering.rawValue)")
        drivers.append("windShearProxy=\(weatherFeatures.windShearProxy.rawValue)")
        
        if let maxWind = rule.constraints.maxWindKph as Double? {
            drivers.append("maxWindKph=\(Int(maxWind))")
        }
        
        return drivers
    }
    
    // MARK: - Confidence
    
    private func calculateConfidence(weatherFeatures: WeatherFeatures) -> Double {
        var confidence = 0.9
        
        if weatherFeatures.sourceMode == .demo {
            confidence -= 0.05
        }
        
        if weatherFeatures.windShearProxy == .high {
            confidence -= 0.1
        }
        
        if weatherFeatures.humidityLayering == .unknown {
            confidence -= 0.1
        }
        
        return max(0.5, confidence)
    }
    
    // MARK: - Helpers
    
    private func generateRecommendationId() -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd"
        let dateStr = dateFormatter.string(from: Date())
        let sequence = String(format: "%04d", Int.random(in: 1...9999))
        return "rec_\(dateStr)_\(sequence)"
    }
    
    private func formatISO8601(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withTimeZone]
        formatter.timeZone = TimeZone(identifier: "America/Los_Angeles")
        return formatter.string(from: date)
    }
}

enum RecommendationError: Error {
    case noMatchingRule
    case constraintViolation(String)
}
