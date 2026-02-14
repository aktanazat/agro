import Foundation

/// Playbook service for loading and patching playbooks
class PlaybookServiceImpl: PlaybookService {
    
    private var activePlaybooks: [String: Playbook] = [:]
    private var patchHistory: [PlaybookPatch] = []
    
    init() {
        // Load default playbook
        loadDefaultPlaybook()
    }
    
    func fetchActivePlaybook(playbookId: String) throws -> Playbook {
        guard let playbook = activePlaybooks[playbookId] else {
            throw PlaybookError.notFound(playbookId)
        }
        return playbook
    }
    
    func applyPatch(_ patch: PlaybookPatch, to playbook: Playbook, appliedAt: String) throws -> PatchApplyResult {
        // Validate base version
        guard patch.baseVersion == playbook.version else {
            return PatchApplyResult(
                patchId: patch.patchId,
                playbookId: playbook.playbookId,
                oldVersion: playbook.version,
                newVersion: playbook.version,
                status: .rejected,
                validationErrors: ["Base version mismatch: expected \(playbook.version), got \(patch.baseVersion)"],
                recomputedRecommendationId: nil,
                appliedAt: appliedAt
            )
        }
        
        // Validate operations
        var validationErrors: [String] = []
        for operation in patch.operations {
            if !isPathAllowed(operation.path, in: playbook) {
                validationErrors.append("Path not allowed: \(operation.path)")
            }
        }
        
        if !validationErrors.isEmpty {
            return PatchApplyResult(
                patchId: patch.patchId,
                playbookId: playbook.playbookId,
                oldVersion: playbook.version,
                newVersion: playbook.version,
                status: .rejected,
                validationErrors: validationErrors,
                recomputedRecommendationId: nil,
                appliedAt: appliedAt
            )
        }
        
        // Apply patch
        var updatedPlaybook = playbook
        for operation in patch.operations {
            updatedPlaybook = try applyOperation(operation, to: updatedPlaybook)
        }
        
        // Bump version
        let newVersion = playbook.version + 1
        updatedPlaybook = Playbook(
            playbookId: updatedPlaybook.playbookId,
            crop: updatedPlaybook.crop,
            region: updatedPlaybook.region,
            version: newVersion,
            updatedAt: appliedAt,
            rules: updatedPlaybook.rules
        )
        
        // Store updated playbook
        activePlaybooks[updatedPlaybook.playbookId] = updatedPlaybook
        
        // Store patch in history
        patchHistory.append(patch)
        
        // Generate recomputed recommendation ID
        let recomputedId = generateRecommendationId()
        
        return PatchApplyResult(
            patchId: patch.patchId,
            playbookId: playbook.playbookId,
            oldVersion: playbook.version,
            newVersion: newVersion,
            status: .applied,
            validationErrors: [],
            recomputedRecommendationId: recomputedId,
            appliedAt: appliedAt
        )
    }
    
    // MARK: - Path Validation
    
    private func isPathAllowed(_ path: String, in playbook: Playbook) -> Bool {
        // Only allow paths under /rules/*/constraints, /rules/*/action, /rules/*/timing
        let allowedPatterns = [
            "/rules/rule_pm_moderate/constraints/",
            "/rules/rule_pm_moderate/action/",
            "/rules/rule_pm_moderate/timing/",
            "/rules/rule_heat_moderate/constraints/",
            "/rules/rule_heat_moderate/action/",
            "/rules/rule_heat_moderate/timing/"
        ]
        
        return allowedPatterns.contains { path.hasPrefix($0) }
    }
    
    // MARK: - Operation Application
    
    private func applyOperation(_ operation: PlaybookPatchOperation, to playbook: Playbook) throws -> Playbook {
        // Parse path and apply value
        // For MVP, support specific constraint paths
        
        if operation.path == "/rules/rule_pm_moderate/constraints/maxWindKph" {
            guard case .number(let value) = operation.value else {
                throw PlaybookError.invalidValue
            }
            
            var rules = playbook.rules
            var pmRule = rules.rulePmModerate
            var constraints = pmRule.constraints
            constraints.maxWindKph = value
            
            pmRule = PlaybookRule(
                ruleId: pmRule.ruleId,
                issue: pmRule.issue,
                severity: pmRule.severity,
                constraints: constraints,
                action: pmRule.action,
                timing: pmRule.timing,
                editablePaths: pmRule.editablePaths
            )
            
            rules = PlaybookRules(
                rulePmModerate: pmRule,
                ruleHeatModerate: rules.ruleHeatModerate
            )
            
            return Playbook(
                playbookId: playbook.playbookId,
                crop: playbook.crop,
                region: playbook.region,
                version: playbook.version,
                updatedAt: playbook.updatedAt,
                rules: rules
            )
        }
        
        throw PlaybookError.unsupportedPath(operation.path)
    }
    
    // MARK: - Default Playbook
    
    private func loadDefaultPlaybook() {
        let pmRule = PlaybookRule(
            ruleId: "rule_pm_moderate",
            issue: .powderyMildew,
            severity: .moderate,
            constraints: RuleConstraints(
                maxWindKph: 12,
                avoidInversion: true,
                maxRelativeHumidityPct: 85,
                minHoursWithoutRain: 4,
                maxTemperatureC: nil,
                irrigationWindowLocal: nil
            ),
            action: RuleAction(
                type: .spray,
                instructions: "Apply sulfur-based contact spray in affected block."
            ),
            timing: RuleTiming(
                baseWindowHours: BaseWindowHours(startOffsetHours: 2, endOffsetHours: 6),
                weatherAdjustments: [
                    RuleWeatherAdjustment(feature: .inversionPresent, condition: "true", shiftStartMinutes: 120, shiftEndMinutes: -60, rationaleTag: "avoid_inversion"),
                    RuleWeatherAdjustment(feature: .humidityLayering, condition: "uniform_humid", shiftStartMinutes: 0, shiftEndMinutes: -90, rationaleTag: "high_humidity_persistence"),
                    RuleWeatherAdjustment(feature: .windShearProxy, condition: "high", shiftStartMinutes: 0, shiftEndMinutes: -60, rationaleTag: "spray_drift_risk")
                ]
            ),
            editablePaths: [
                "/rules/rule_pm_moderate/constraints/maxWindKph",
                "/rules/rule_pm_moderate/action/instructions",
                "/rules/rule_pm_moderate/timing/baseWindowHours"
            ]
        )
        
        let heatRule = PlaybookRule(
            ruleId: "rule_heat_moderate",
            issue: .heatStress,
            severity: .moderate,
            constraints: RuleConstraints(
                maxWindKph: 15,
                avoidInversion: nil,
                maxRelativeHumidityPct: nil,
                minHoursWithoutRain: nil,
                maxTemperatureC: 35,
                irrigationWindowLocal: "04:30-07:00"
            ),
            action: RuleAction(
                type: .irrigate,
                instructions: "Schedule short-cycle irrigation and canopy cooling check."
            ),
            timing: RuleTiming(
                baseWindowHours: BaseWindowHours(startOffsetHours: 10, endOffsetHours: 14),
                weatherAdjustments: [
                    RuleWeatherAdjustment(feature: .heatStressScore, condition: "> 0.7", shiftStartMinutes: -60, shiftEndMinutes: 0, rationaleTag: "high_heat_stress")
                ]
            ),
            editablePaths: [
                "/rules/rule_heat_moderate/constraints/maxWindKph",
                "/rules/rule_heat_moderate/constraints/maxTemperatureC",
                "/rules/rule_heat_moderate/action/instructions"
            ]
        )
        
        let playbook = Playbook(
            playbookId: "pbk_yolo_grape",
            crop: .grape,
            region: .yoloCountyCa,
            version: 3,
            updatedAt: ISO8601DateFormatter().string(from: Date()),
            rules: PlaybookRules(rulePmModerate: pmRule, ruleHeatModerate: heatRule)
        )
        
        activePlaybooks[playbook.playbookId] = playbook
    }
    
    // MARK: - Helpers
    
    private func generateRecommendationId() -> String {
        let dateFormatter = DateFormatter()
        dateFormatter.dateFormat = "yyyyMMdd"
        let dateStr = dateFormatter.string(from: Date())
        let sequence = String(format: "%04d", Int.random(in: 1...9999))
        return "rec_\(dateStr)_\(sequence)"
    }
}

enum PlaybookError: Error {
    case notFound(String)
    case invalidValue
    case unsupportedPath(String)
    case versionMismatch
}
