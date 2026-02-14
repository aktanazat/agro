import SwiftUI

struct ReviewEditView: View {
    @EnvironmentObject var appState: AppState
    
    let rawNoteText: String
    let captureMode: CaptureMode
    let transcriptConfidence: Double
    
    // Extracted fields (editable)
    @State private var crop: Crop = .grape
    @State private var variety: String = "chardonnay"
    @State private var fieldBlock: String = "Block 7"
    @State private var issue: Issue = .powderyMildew
    @State private var severity: Severity = .moderate
    @State private var symptoms: [String] = ["white powder on upper leaf surfaces", "slight musty odor"]
    @State private var leafWetness: LeafWetness = .dry
    @State private var windEstimate: Double = 8.0

    @State private var isExtracting = true
    @State private var extractionError: String?
    @State private var generatedObservationId = ReviewEditView.generateObservationId()
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Original note
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Original Note")
                            .font(.headline)
                        Spacer()
                        Text(captureMode == .voice ? "Voice" : "Typed")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Color.blue.opacity(0.2))
                            .cornerRadius(4)
                    }
                    
                    Text(rawNoteText)
                        .font(.body)
                        .foregroundColor(.secondary)
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                }
                
                if isExtracting {
                    // Extraction in progress
                    VStack(spacing: 16) {
                        ProgressView()
                            .scaleEffect(1.5)
                        Text("Extracting structured fields...")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                } else {
                    // Extracted fields
                    VStack(alignment: .leading, spacing: 16) {
                        Text("Extracted Fields")
                            .font(.headline)
                        
                        FormField(label: "Crop", value: crop.rawValue)
                        FormField(label: "Variety", value: variety)
                        FormField(label: "Field Block", value: fieldBlock)
                        
                        // Issue picker
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Issue")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Picker("Issue", selection: $issue) {
                                Text("Powdery Mildew").tag(Issue.powderyMildew)
                                Text("Heat Stress").tag(Issue.heatStress)
                                Text("Other").tag(Issue.other)
                            }
                            .pickerStyle(.segmented)
                        }
                        
                        // Severity picker
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Severity")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Picker("Severity", selection: $severity) {
                                Text("Low").tag(Severity.low)
                                Text("Moderate").tag(Severity.moderate)
                                Text("High").tag(Severity.high)
                            }
                            .pickerStyle(.segmented)
                        }
                        
                        // Symptoms
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Symptoms")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            ForEach(symptoms, id: \.self) { symptom in
                                Text("• \(symptom)")
                                    .font(.body)
                            }
                        }
                        
                        Divider()
                        
                        Text("Normalization")
                            .font(.headline)
                        
                        FormField(label: "Leaf Wetness", value: leafWetness.rawValue)
                        FormField(label: "Wind Estimate", value: "\(Int(windEstimate)) kph")
                    }
                    
                    // Generate Recommendation button
                    NavigationLink(destination: RecommendationView(
                        observation: buildObservation()
                    )) {
                        PrimaryButton(title: "Generate Recommendation", icon: "sparkles")
                    }
                    .padding(.top, 16)
                }
            }
            .padding()
        }
        .navigationTitle("Review & Edit")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            simulateExtraction()
        }
    }
    
    private func simulateExtraction() {
        // Simulate extraction delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            isExtracting = false
            appState.observationFlowState = .extracted
            appState.recordTraceStage(stage: "extracting", durationMs: 14000)
        }
    }
    
    private func buildObservation() -> Observation {
        let now = ISO8601DateFormatter().string(from: Date())
        
        return Observation(
            observationId: generatedObservationId,
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
                crop: crop,
                variety: variety,
                fieldBlock: fieldBlock,
                issue: issue,
                severity: severity,
                symptoms: symptoms,
                observationTime: now
            ),
            normalization: ObservationNormalization(
                temperatureC: nil,
                leafWetness: leafWetness,
                windEstimateKph: windEstimate
            ),
            location: GeoPoint(lat: 38.5449, lon: -121.7405),
            status: .confirmed,
            schemaVersion: "1.0.0",
            deterministicChecksum: "sha256:A1B2C3D4E5F6"
        )
    }

    private static func generateObservationId() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd"
        let date = formatter.string(from: Date())
        let suffix = String(format: "%04d", Int.random(in: 0...9999))
        return "obs_\(date)_\(suffix)"
    }
}

struct FormField: View {
    let label: String
    let value: String
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.body)
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.systemGray6))
                .cornerRadius(8)
        }
    }
}

#Preview {
    NavigationStack {
        ReviewEditView(
            rawNoteText: "Block 7 Chardonnay. I see white powder on upper leaf surfaces, moderate spread after two warm days.",
            captureMode: .voice,
            transcriptConfidence: 0.93
        )
        .environmentObject(AppState())
    }
}
