import SwiftUI

struct ShareView: View {
    @EnvironmentObject var appState: AppState
    
    let observation: Observation
    let recommendation: Recommendation
    
    @State private var showShareSheet = false
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("Share Payload Preview")
                    .font(.headline)
                
                // JSON preview
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Payload")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Button(action: copyToClipboard) {
                            Label("Copy", systemImage: "doc.on.doc")
                                .font(.caption)
                        }
                    }
                    
                    ScrollView(.horizontal, showsIndicators: false) {
                        Text(generatePayloadJSON())
                            .font(.system(.caption, design: .monospaced))
                            .padding()
                    }
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
                }
                
                // Summary
                VStack(alignment: .leading, spacing: 12) {
                    Text("Summary")
                        .font(.headline)
                    
                    SummaryRow(label: "Observation ID", value: observation.observationId)
                    SummaryRow(label: "Recommendation ID", value: recommendation.recommendationId)
                    SummaryRow(label: "Playbook Version", value: "v\(recommendation.playbookVersion)")
                    SummaryRow(label: "Weather Features", value: recommendation.weatherFeaturesId)
                    SummaryRow(label: "Status", value: recommendation.status.rawValue)
                }
                
                // Share button
                Button(action: { showShareSheet = true }) {
                    PrimaryButton(title: "Share", icon: "square.and.arrow.up")
                }
            }
            .padding()
        }
        .navigationTitle("Share")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showShareSheet) {
            ShareSheet(items: [generatePayloadJSON()])
        }
    }
    
    private func generatePayloadJSON() -> String {
        """
        {
          "observation": {
            "observationId": "\(observation.observationId)",
            "deviceId": "\(observation.deviceId)",
            "createdAt": "\(observation.createdAt)",
            "captureMode": "\(observation.captureMode.rawValue)",
            "extraction": {
              "crop": "\(observation.extraction.crop.rawValue)",
              "fieldBlock": "\(observation.extraction.fieldBlock)",
              "issue": "\(observation.extraction.issue.rawValue)",
              "severity": "\(observation.extraction.severity.rawValue)"
            },
            "status": "\(observation.status.rawValue)"
          },
          "recommendation": {
            "recommendationId": "\(recommendation.recommendationId)",
            "playbookId": "\(recommendation.playbookId)",
            "playbookVersion": \(recommendation.playbookVersion),
            "weatherFeaturesId": "\(recommendation.weatherFeaturesId)",
            "action": "\(recommendation.action)",
            "timingWindow": {
              "startAt": "\(recommendation.timingWindow.startAt)",
              "endAt": "\(recommendation.timingWindow.endAt)",
              "confidence": \(recommendation.timingWindow.confidence)
            },
            "status": "\(recommendation.status.rawValue)"
          }
        }
        """
    }
    
    private func copyToClipboard() {
        UIPasteboard.general.string = generatePayloadJSON()
    }
}

struct SummaryRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
        }
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]
    
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    
    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

#Preview {
    NavigationStack {
        ShareView(
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
            ),
            recommendation: Recommendation(
                recommendationId: "rec_20260211_0001",
                observationId: "obs_20260211_0001",
                playbookId: "pbk_yolo_grape",
                playbookVersion: 3,
                weatherFeaturesId: "wxf_20260211_demo_01",
                generatedAt: "2026-02-11T18:20:52Z",
                issue: .powderyMildew,
                severity: .moderate,
                action: "Apply sulfur-based contact spray in affected block.",
                rationale: ["avoid_inversion", "high_humidity_persistence"],
                timingWindow: RecommendationTimingWindow(startAt: "2026-02-11T21:00:00-08:00", endAt: "2026-02-12T00:30:00-08:00", localTimezone: "America/Los_Angeles", confidence: 0.82, drivers: ["inversionPresent=false"]),
                riskFlags: [],
                requiredConfirmation: true,
                status: .confirmed
            )
        )
        .environmentObject(AppState())
    }
}
