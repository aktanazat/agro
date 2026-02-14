import SwiftUI

struct RecommendationView: View {
    @EnvironmentObject var appState: AppState
    
    let observation: Observation
    
    @State private var recommendation: Recommendation?
    @State private var isGenerating = true
    @State private var isConfirmed = false
    @State private var generatedRecommendationId = RecommendationView.generateRecommendationId()
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if isGenerating {
                    // Generating recommendation
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text("Generating recommendation...")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 60)
                } else if let rec = recommendation {
                    // Recommendation card
                    VStack(alignment: .leading, spacing: 16) {
                        // Header
                        HStack {
                            VStack(alignment: .leading) {
                                Text("Recommendation")
                                    .font(.headline)
                                Text(rec.recommendationId)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            StatusBadge(status: rec.status)
                        }
                        
                        Divider()
                        
                        // Action
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Action")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(rec.action)
                                .font(.body)
                                .fontWeight(.medium)
                        }
                        
                        // Timing window
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Timing Window")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            HStack {
                                Image(systemName: "clock.fill")
                                    .foregroundColor(.green)
                                VStack(alignment: .leading) {
                                    Text(formatTime(rec.timingWindow.startAt))
                                        .font(.body)
                                        .fontWeight(.medium)
                                    Text("to \(formatTime(rec.timingWindow.endAt))")
                                        .font(.body)
                                }
                            }
                            .padding()
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(8)
                            
                            Text("Confidence: \(Int(rec.timingWindow.confidence * 100))%")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        
                        // Weather drivers
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Weather Drivers")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            FlowLayout(spacing: 8) {
                                ForEach(rec.timingWindow.drivers, id: \.self) { driver in
                                    Text(driver)
                                        .font(.caption)
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 6)
                                        .background(Color.blue.opacity(0.1))
                                        .foregroundColor(.blue)
                                        .cornerRadius(4)
                                }
                            }
                        }
                        
                        // Rationale
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Rationale")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            ForEach(rec.rationale, id: \.self) { reason in
                                HStack(alignment: .top) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(.green)
                                        .font(.caption)
                                    Text(reason.replacingOccurrences(of: "_", with: " "))
                                        .font(.body)
                                }
                            }
                        }
                        
                        // Playbook info
                        HStack {
                            Text("Playbook: \(rec.playbookId)")
                            Spacer()
                            Text("v\(rec.playbookVersion)")
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color(.systemBackground))
                    .cornerRadius(12)
                    .shadow(color: .black.opacity(0.1), radius: 4, y: 2)
                    
                    // Confirm button
                    if !isConfirmed {
                        Button(action: confirmRecommendation) {
                            PrimaryButton(title: "Confirm & Log", icon: "checkmark.circle.fill")
                        }
                    } else {
                        NavigationLink(destination: ShareView(
                            observation: observation,
                            recommendation: rec
                        )) {
                            PrimaryButton(title: "Share", icon: "square.and.arrow.up")
                        }
                        
                        Text("Recommendation confirmed and logged")
                            .font(.caption)
                            .foregroundColor(.green)
                            .frame(maxWidth: .infinity)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Recommendation")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            generateRecommendation()
        }
    }
    
    private func generateRecommendation() {
        appState.observationFlowState = .recommending
        
        // Simulate recommendation generation
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
            let generatedRecommendation = Recommendation(
                recommendationId: generatedRecommendationId,
                observationId: observation.observationId,
                playbookId: "pbk_yolo_grape",
                playbookVersion: appState.activePlaybookVersion,
                weatherFeaturesId: "wxf_20260211_demo_01",
                generatedAt: ISO8601DateFormatter().string(from: Date()),
                issue: observation.extraction.issue,
                severity: observation.extraction.severity,
                action: "Apply sulfur-based contact spray in affected block.",
                rationale: ["avoid_inversion", "high_humidity_persistence"],
                timingWindow: RecommendationTimingWindow(
                    startAt: "2026-02-11T21:00:00-08:00",
                    endAt: "2026-02-12T00:30:00-08:00",
                    localTimezone: "America/Los_Angeles",
                    confidence: 0.82,
                    drivers: ["inversionPresent=false", "humidityLayering=uniform_humid", "windShearProxy=moderate"]
                ),
                riskFlags: [],
                requiredConfirmation: true,
                status: .pendingConfirmation
            )
            recommendation = generatedRecommendation
            isGenerating = false
            appState.observationFlowState = .recommendationReady
            appState.stageRecommendation(observation: observation, recommendation: generatedRecommendation)
            appState.recordTraceStage(
                stage: "recommending",
                durationMs: 6000,
                relatedObservationId: observation.observationId,
                relatedRecommendationId: generatedRecommendation.recommendationId
            )
        }
    }
    
    private func confirmRecommendation() {
        guard let recommendation else { return }
        let confirmedRecommendation = recommendationWithStatus(recommendation, status: .confirmed)
        self.recommendation = confirmedRecommendation
        isConfirmed = true
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
    
    private func formatTime(_ isoString: String) -> String {
        // Simple formatting for demo
        if let range = isoString.range(of: "T") {
            let timepart = String(isoString[range.upperBound...])
            if let endRange = timepart.range(of: "-") {
                return String(timepart[..<endRange.lowerBound])
            }
        }
        return isoString
    }

    private static func generateRecommendationId() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd"
        let date = formatter.string(from: Date())
        let suffix = String(format: "%04d", Int.random(in: 0...9999))
        return "rec_\(date)_\(suffix)"
    }
}

struct StatusBadge: View {
    let status: RecommendationStatus
    
    var body: some View {
        Text(statusText)
            .font(.caption)
            .fontWeight(.medium)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(statusColor.opacity(0.2))
            .foregroundColor(statusColor)
            .cornerRadius(4)
    }
    
    var statusText: String {
        switch status {
        case .pendingConfirmation: return "Pending"
        case .confirmed: return "Confirmed"
        case .rejected: return "Rejected"
        }
    }
    
    var statusColor: Color {
        switch status {
        case .pendingConfirmation: return .orange
        case .confirmed: return .green
        case .rejected: return .red
        }
    }
}

// Simple flow layout for tags
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                      y: bounds.minY + result.positions[index].y),
                         proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []
        
        init(in width: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var rowHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                if x + size.width > width && x > 0 {
                    x = 0
                    y += rowHeight + spacing
                    rowHeight = 0
                }
                positions.append(CGPoint(x: x, y: y))
                rowHeight = max(rowHeight, size.height)
                x += size.width + spacing
            }
            
            self.size = CGSize(width: width, height: y + rowHeight)
        }
    }
}

#Preview {
    NavigationStack {
        RecommendationView(
            observation: Observation(
                observationId: "obs_20260211_0001",
                deviceId: "dev_ios_001",
                createdAt: "2026-02-11T18:20:35Z",
                captureMode: .voice,
                rawNoteText: "Block 7 Chardonnay...",
                transcription: ObservationTranscription(text: "Block 7 Chardonnay...", source: .onDeviceAsr, confidence: 0.93),
                extraction: ObservationExtraction(crop: .grape, variety: "chardonnay", fieldBlock: "Block 7", issue: .powderyMildew, severity: .moderate, symptoms: ["white powder"], observationTime: "2026-02-11T18:20:30Z"),
                normalization: ObservationNormalization(temperatureC: nil, leafWetness: .dry, windEstimateKph: 8),
                location: GeoPoint(lat: 38.5449, lon: -121.7405),
                status: .confirmed,
                schemaVersion: "1.0.0",
                deterministicChecksum: "sha256:A1B2C3D4E5F6"
            )
        )
        .environmentObject(AppState())
    }
}
