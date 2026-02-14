import SwiftUI

struct GenerateRecommendationView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) var dismiss
    
    let rawNoteText: String
    let captureMode: CaptureMode
    let transcriptConfidence: Double
    
    // Processing states
    @State private var currentStep: ProcessingStep = .analyzing
    @State private var observation: Observation?
    @State private var recommendation: Recommendation?
    
    // Extracted fields
    @State private var extractedCrop: String = "Grape"
    @State private var extractedIssue: Issue = .powderyMildew
    @State private var extractedSeverity: Severity = .moderate
    @State private var extractedFieldBlock: String = ""
    @State private var extractedVariety: String?
    
    @State private var showRawDetails = false
    
    enum ProcessingStep {
        case analyzing
        case recommending
        case ready
        case confirmed
    }
    
    var body: some View {
        VStack(spacing: 0) {
            // Pinned progress stepper — stays above scroll content
            ProgressStepsView(currentStep: currentStep)
                .padding(.horizontal)
                .padding(.vertical, 8)
                .background(Color(.systemBackground))
            
            Divider()
            
            ScrollView {
                VStack(spacing: 20) {
                    // Original note (collapsible)
                    CollapsibleNoteCard(
                        text: rawNoteText,
                        captureMode: captureMode,
                        confidence: transcriptConfidence
                    )
                    .padding(.horizontal)
                    
                    // Main content
                    if currentStep == .analyzing {
                        AnalyzingOverlay()
                            .padding(.vertical, 40)
                    } else {
                        // Extracted Fields - Natural Sentence Card
                        ExtractionSummaryCard(
                            issue: extractedIssue,
                            severity: extractedSeverity,
                            fieldBlock: extractedFieldBlock,
                            crop: extractedCrop,
                            variety: extractedVariety
                        )
                        .padding(.horizontal)
                        
                        if currentStep == .recommending {
                            GeneratingOverlay()
                                .padding(.vertical, 20)
                        }
                        
                        if let rec = recommendation {
                            // Recommendation Card
                            RecommendationResultCard(
                                recommendation: rec,
                                showRawDetails: $showRawDetails
                            )
                            .padding(.horizontal)
                        }
                    }
                }
                .padding(.vertical)
            }
            
            // Pinned bottom actions — always visible, never scroll away
            if currentStep == .ready || currentStep == .confirmed {
                Divider()
                
                VStack(spacing: 12) {
                    if currentStep == .ready {
                        Button(action: confirmRecommendation) {
                            HStack {
                                Image(systemName: "checkmark.circle.fill")
                                Text("Confirm & Log")
                                    .fontWeight(.semibold)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                    } else if currentStep == .confirmed {
                        ConfirmedActionsView(
                            observation: observation,
                            recommendation: recommendation
                        )
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 12)
                .background(Color(.systemBackground))
            }
        }
        .navigationTitle(currentStep == .confirmed ? "Logged" : "Recommendation")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(.visible, for: .navigationBar)
        .onAppear {
            startProcessing()
        }
    }
    
    // MARK: - Processing
    
    private func startProcessing() {
        currentStep = .analyzing
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            performExtraction()
        }
    }
    
    private func performExtraction() {
        let lowercased = rawNoteText.lowercased()
        
        // Issue
        if lowercased.contains("mildew") || lowercased.contains("powder") || lowercased.contains("white") {
            extractedIssue = .powderyMildew
        } else if lowercased.contains("heat") || lowercased.contains("stress") || lowercased.contains("wilt") {
            extractedIssue = .heatStress
        } else {
            extractedIssue = .other
        }
        
        // Severity
        if lowercased.contains("severe") || lowercased.contains("heavy") || lowercased.contains("high") {
            extractedSeverity = .high
        } else if lowercased.contains("moderate") || lowercased.contains("medium") {
            extractedSeverity = .moderate
        } else {
            extractedSeverity = .low
        }
        
        // Field block
        if let range = rawNoteText.range(of: #"[Bb]lock\s+(\d+|[A-Z])"#, options: .regularExpression) {
            extractedFieldBlock = String(rawNoteText[range])
        } else {
            extractedFieldBlock = "Field Area"
        }
        
        // Variety
        let varieties = ["chardonnay", "cabernet", "merlot", "pinot", "zinfandel"]
        for v in varieties {
            if lowercased.contains(v) {
                extractedVariety = v.capitalized
                break
            }
        }
        
        // Build observation
        let now = ISO8601DateFormatter().string(from: Date())
        observation = Observation(
            observationId: "obs_20260211_0001",
            deviceId: appState.deviceId,
            createdAt: now,
            captureMode: captureMode,
            rawNoteText: rawNoteText,
            transcription: ObservationTranscription(
                text: rawNoteText,
                source: captureMode == .voice ? .onDeviceAsr : .manualTyped,
                confidence: transcriptConfidence
            ),
            extraction: ObservationExtraction(
                crop: .grape,
                variety: extractedVariety?.lowercased(),
                fieldBlock: extractedFieldBlock,
                issue: extractedIssue,
                severity: extractedSeverity,
                symptoms: extractSymptoms(from: rawNoteText),
                observationTime: now
            ),
            normalization: ObservationNormalization(
                temperatureC: nil,
                leafWetness: lowercased.contains("dry") ? .dry : .unknown,
                windEstimateKph: lowercased.contains("light") ? 8 : 12
            ),
            location: GeoPoint(lat: 38.5449, lon: -121.7405),
            status: .draft,
            schemaVersion: "1.0.0",
            deterministicChecksum: "sha256:A1B2C3D4E5F6"
        )
        appState.recordTraceStage(
            stage: "extracting",
            durationMs: 14000,
            relatedObservationId: observation?.observationId
        )
        
        currentStep = .recommending
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            generateRecommendation()
        }
    }
    
    private func extractSymptoms(from text: String) -> [String] {
        var symptoms: [String] = []
        let lowercased = text.lowercased()
        
        if lowercased.contains("powder") { symptoms.append("white powder on leaves") }
        if lowercased.contains("musty") { symptoms.append("musty odor") }
        if lowercased.contains("curl") { symptoms.append("leaf curling") }
        if lowercased.contains("wilt") { symptoms.append("wilting") }
        
        return symptoms.isEmpty ? ["visual symptoms observed"] : symptoms
    }
    
    private func generateRecommendation() {
        let action: String
        let startTime: String
        let endTime: String
        let rationale: [String]
        
        switch extractedIssue {
        case .powderyMildew:
            action = "Apply sulfur-based contact spray in affected block."
            startTime = "2026-02-11T21:00:00-08:00"
            endTime = "2026-02-12T00:30:00-08:00"
            rationale = ["avoid_inversion", "high_humidity_persistence"]
        case .heatStress:
            action = "Schedule short-cycle irrigation and canopy cooling check."
            startTime = "2026-02-12T04:30:00-08:00"
            endTime = "2026-02-12T07:00:00-08:00"
            rationale = ["optimal_irrigation_window", "low_evaporation"]
        case .other:
            action = "Monitor affected area and reassess in 24 hours."
            startTime = "2026-02-12T08:00:00-08:00"
            endTime = "2026-02-12T12:00:00-08:00"
            rationale = ["standard_monitoring_window"]
        }
        
        recommendation = Recommendation(
            recommendationId: "rec_20260211_0001",
            observationId: observation?.observationId ?? "obs_20260211_0001",
            playbookId: "pbk_yolo_grape",
            playbookVersion: appState.activePlaybookVersion,
            weatherFeaturesId: "wxf_20260211_demo_01",
            generatedAt: ISO8601DateFormatter().string(from: Date()),
            issue: extractedIssue,
            severity: extractedSeverity,
            action: action,
            rationale: rationale,
            timingWindow: RecommendationTimingWindow(
                startAt: startTime,
                endAt: endTime,
                localTimezone: "America/Los_Angeles",
                confidence: 0.82,
                drivers: ["inversionPresent=false", "humidityLayering=uniform_humid", "windShearProxy=moderate"]
            ),
            riskFlags: [],
            requiredConfirmation: true,
            status: .pendingConfirmation
        )
        
        currentStep = .ready
        if let observation, let recommendation {
            appState.stageRecommendation(observation: observation, recommendation: recommendation)
            appState.recordTraceStage(
                stage: "recommending",
                durationMs: 6000,
                relatedObservationId: observation.observationId,
                relatedRecommendationId: recommendation.recommendationId
            )
        }
    }
    
    private func confirmRecommendation() {
        guard let observation, let recommendation else { return }
        let confirmedRecommendation = recommendationWithStatus(recommendation, status: .confirmed)
        self.recommendation = confirmedRecommendation
        currentStep = .confirmed
        appState.observationFlowState = .confirmed
        appState.recordTraceStage(
            stage: "confirmation",
            durationMs: 14000,
            relatedObservationId: observation.observationId,
            relatedRecommendationId: confirmedRecommendation.recommendationId
        )
        appState.confirmAndLog(observation: observation, recommendation: confirmedRecommendation)
    }

    private func recommendationWithStatus(
        _ recommendation: Recommendation,
        status: RecommendationStatus
    ) -> Recommendation {
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

// MARK: - Progress Steps (Informative Only)

struct ProgressStepsView: View {
    let currentStep: GenerateRecommendationView.ProcessingStep
    
    var body: some View {
        HStack(spacing: 4) {
            StepDot(label: "Note", isComplete: true, isActive: false)
            StepLine(isComplete: currentStep != .analyzing)
            StepDot(label: "Analyze", isComplete: currentStep != .analyzing, isActive: currentStep == .analyzing)
            StepLine(isComplete: currentStep == .ready || currentStep == .confirmed)
            StepDot(label: "Recommend", isComplete: currentStep == .confirmed, isActive: currentStep == .ready || currentStep == .recommending)
        }
        .padding(.vertical, 8)
    }
}

struct StepDot: View {
    let label: String
    let isComplete: Bool
    let isActive: Bool
    
    var body: some View {
        VStack(spacing: 4) {
            ZStack {
                Circle()
                    .fill(isComplete ? Color.green : (isActive ? Color.green.opacity(0.3) : Color(.systemGray4)))
                    .frame(width: 24, height: 24)
                
                if isComplete {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(.white)
                } else if isActive {
                    Circle()
                        .fill(Color.green)
                        .frame(width: 8, height: 8)
                }
            }
            
            Text(label)
                .font(.caption2)
                .foregroundColor(isActive || isComplete ? .primary : .secondary)
        }
    }
}

struct StepLine: View {
    let isComplete: Bool
    
    var body: some View {
        Rectangle()
            .fill(isComplete ? Color.green : Color(.systemGray4))
            .frame(height: 2)
            .frame(maxWidth: 40)
            .padding(.bottom, 16)
    }
}

// MARK: - Collapsible Note

struct CollapsibleNoteCard: View {
    let text: String
    let captureMode: CaptureMode
    let confidence: Double
    @State private var isExpanded = false
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Button(action: { withAnimation { isExpanded.toggle() } }) {
                HStack {
                    Image(systemName: captureMode == .voice ? "mic.fill" : "keyboard")
                        .foregroundColor(.green)
                        .font(.caption)
                    Text("Your observation")
                        .font(.subheadline)
                        .foregroundColor(.primary)
                    Spacer()
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if isExpanded {
                Text(text)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(10)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
            }
        }
        .padding(12)
        .background(Color(.systemBackground))
        .cornerRadius(10)
        .shadow(color: .black.opacity(0.03), radius: 2, y: 1)
    }
}

// MARK: - Extraction Summary Card (Natural Sentence)

struct ExtractionSummaryCard: View {
    let issue: Issue
    let severity: Severity
    let fieldBlock: String
    let crop: String
    let variety: String?
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "leaf.fill")
                .foregroundColor(.green)
                .font(.title3)
                .padding(.top, 2)
            
            VStack(alignment: .leading, spacing: 4) {
                // Line 1: Issue (bold) + severity
                HStack(spacing: 0) {
                    Text(issueText)
                        .font(.body)
                        .fontWeight(.bold)
                    Text(" (\(severity.rawValue))")
                        .font(.body)
                        .foregroundColor(.secondary)
                }
                
                // Line 2: Location · Crop
                HStack(spacing: 0) {
                    Text(fieldBlock)
                    Text(" · ")
                    if let variety = variety {
                        Text("\(crop) (\(variety))")
                    } else {
                        Text(crop)
                    }
                }
                .font(.subheadline)
                .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding(16)
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
    
    var issueText: String {
        switch issue {
        case .powderyMildew: return "Powdery Mildew"
        case .heatStress: return "Heat Stress"
        case .other: return "Other"
        }
    }
}

// MARK: - Loading Overlays

struct AnalyzingOverlay: View {
    var body: some View {
        VStack(spacing: 12) {
            ProgressView()
                .scaleEffect(1.3)
            Text("Analyzing observation...")
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }
}

struct GeneratingOverlay: View {
    var body: some View {
        VStack(spacing: 8) {
            ProgressView()
            Text("Generating recommendation...")
                .font(.caption)
                .foregroundColor(.secondary)
        }
    }
}

// MARK: - Recommendation Card

struct RecommendationResultCard: View {
    let recommendation: Recommendation
    @Binding var showRawDetails: Bool
    
    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Action
            VStack(alignment: .leading, spacing: 6) {
                Text("Recommended Action")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                Text(recommendation.action)
                    .font(.body)
                    .fontWeight(.medium)
            }
            
            Divider()
            
            // Timing Window - Human Readable
            VStack(alignment: .leading, spacing: 8) {
                Text("Timing Window")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                HStack(alignment: .center) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(formatTimeHuman(recommendation.timingWindow.startAt))
                            .font(.title2)
                            .fontWeight(.semibold)
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.right")
                                .font(.caption)
                            Text(formatTimeHuman(recommendation.timingWindow.endAt))
                                .font(.title3)
                        }
                        .foregroundColor(.secondary)
                        
                        Text(getRelativeDay(recommendation.timingWindow.startAt))
                            .font(.caption)
                            .foregroundColor(.green)
                            .padding(.top, 2)
                    }
                    
                    Spacer()
                    
                    // Confidence
                    VStack(spacing: 2) {
                        Text("\(Int(recommendation.timingWindow.confidence * 100))%")
                            .font(.title)
                            .fontWeight(.bold)
                            .foregroundColor(.green)
                        Text("confidence")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                .padding()
                .background(Color.green.opacity(0.08))
                .cornerRadius(10)
            }
            
            Divider()
            
            // Weather Conditions - Human Readable
            VStack(alignment: .leading, spacing: 8) {
                Text("Weather Conditions")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                
                FlowLayout(spacing: 8) {
                    ForEach(Array(humanReadableDrivers.enumerated()), id: \.offset) { _, driver in
                        HStack(spacing: 4) {
                            Image(systemName: driver.icon)
                                .font(.caption2)
                            Text(driver.text)
                                .font(.caption)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Color.blue.opacity(0.1))
                        .foregroundColor(.blue)
                        .cornerRadius(6)
                    }
                }
                
                // Raw details disclosure
                Button(action: { withAnimation { showRawDetails.toggle() } }) {
                    HStack {
                        Text("Technical details")
                            .font(.caption)
                        Image(systemName: showRawDetails ? "chevron.up" : "chevron.down")
                            .font(.caption2)
                    }
                    .foregroundColor(.secondary)
                }
                .padding(.top, 4)
                
                if showRawDetails {
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(recommendation.timingWindow.drivers, id: \.self) { driver in
                            Text(driver)
                                .font(.caption2)
                                .fontDesign(.monospaced)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(8)
                    .background(Color(.systemGray6))
                    .cornerRadius(6)
                }
            }
        }
        .padding(16)
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 6, y: 3)
    }
    
    // Human readable drivers
    var humanReadableDrivers: [(text: String, icon: String)] {
        var result: [(String, String)] = []
        
        for driver in recommendation.timingWindow.drivers {
            if driver.contains("inversionPresent=false") {
                result.append(("No inversion risk", "checkmark.circle"))
            } else if driver.contains("inversionPresent=true") {
                result.append(("Inversion present", "exclamationmark.triangle"))
            } else if driver.contains("humidityLayering=uniform_humid") {
                result.append(("Humidity: uniform", "humidity"))
            } else if driver.contains("windShearProxy=moderate") {
                result.append(("Wind shear: moderate", "wind"))
            } else if driver.contains("windShearProxy=low") {
                result.append(("Wind shear: low", "wind"))
            } else if driver.contains("windShearProxy=high") {
                result.append(("High wind shear", "wind"))
            }
        }
        
        if result.isEmpty {
            result.append(("Conditions favorable", "checkmark.circle"))
        }
        
        return result
    }
    
    func formatTimeHuman(_ isoString: String) -> String {
        // Parse time and format as "9:00 PM"
        if let tIndex = isoString.firstIndex(of: "T"),
           let dashIndex = isoString.lastIndex(of: "-") {
            let timeStart = isoString.index(after: tIndex)
            let timeString = String(isoString[timeStart..<dashIndex])
            let components = timeString.split(separator: ":")
            if components.count >= 2, let hour = Int(components[0]) {
                let minute = String(components[1])
                let ampm = hour >= 12 ? "PM" : "AM"
                let hour12 = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour)
                return "\(hour12):\(minute) \(ampm)"
            }
        }
        return isoString
    }
    
    func getRelativeDay(_ isoString: String) -> String {
        // Simple relative day logic
        if isoString.contains("2026-02-11") {
            return "Tonight • Local time"
        } else if isoString.contains("2026-02-12") {
            if isoString.contains("T04:") || isoString.contains("T05:") || isoString.contains("T06:") || isoString.contains("T07:") {
                return "Tomorrow morning • Local time"
            }
            return "Tomorrow • Local time"
        }
        return "Local time"
    }
}

// MARK: - Confirmed Actions

struct ConfirmedActionsView: View {
    let observation: Observation?
    let recommendation: Recommendation?
    
    var body: some View {
        VStack(spacing: 12) {
            // Success message
            HStack(spacing: 8) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text("Confirmed and logged")
                    .fontWeight(.medium)
            }
            .padding()
            .frame(maxWidth: .infinity)
            .background(Color.green.opacity(0.1))
            .cornerRadius(10)
            
            // Action buttons
            HStack(spacing: 12) {
                if let obs = observation, let rec = recommendation {
                    NavigationLink(destination: ShareView(observation: obs, recommendation: rec)) {
                        HStack {
                            Image(systemName: "square.and.arrow.up")
                            Text("Share")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(.systemGray6))
                        .foregroundColor(.primary)
                        .cornerRadius(10)
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .stroke(Color(.systemGray4), lineWidth: 1)
                        )
                    }
                }
                
                NavigationLink(destination: HomeView()) {
                    HStack {
                        Image(systemName: "checkmark")
                        Text("Done")
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.green)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        GenerateRecommendationView(
            rawNoteText: "Block 7 Chardonnay. I see white powder on upper leaf surfaces, moderate spread.",
            captureMode: .voice,
            transcriptConfidence: 0.93
        )
        .environmentObject(AppState())
    }
}
