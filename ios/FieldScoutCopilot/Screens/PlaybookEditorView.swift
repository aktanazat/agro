import SwiftUI

struct PlaybookEditorView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var playbookVersion: Int = 3
    @State private var maxWindKph: Double = 12
    @State private var originalMaxWindKph: Double = 12
    @State private var patchReason: String = ""
    @State private var patchJustification: String = ""
    
    @State private var showPatchPreview = false
    @State private var isPatchApplied = false
    @State private var recomputedRecommendation: Recommendation?
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // Playbook header
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Playbook: pbk_yolo_grape")
                            .font(.headline)
                        Spacer()
                        Text("v\(playbookVersion)")
                            .font(.headline)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.blue.opacity(0.1))
                            .foregroundColor(.blue)
                            .cornerRadius(8)
                    }
                    
                    Text("Yolo County • Grape")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
                
                Divider()
                
                // Rule: Powdery Mildew Moderate
                VStack(alignment: .leading, spacing: 16) {
                    Text("Rule: rule_pm_moderate")
                        .font(.headline)
                    
                    Text("Powdery Mildew • Moderate Severity")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    
                    // Editable constraints
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Constraints (Editable)")
                            .font(.subheadline)
                            .fontWeight(.medium)
                        
                        // Max Wind KPH - editable
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Max Wind (kph)")
                                    .font(.subheadline)
                                Spacer()
                                Text("\(Int(maxWindKph))")
                                    .font(.headline)
                                    .foregroundColor(maxWindKph != originalMaxWindKph ? .orange : .primary)
                            }
                            
                            Slider(value: $maxWindKph, in: 5...20, step: 1)
                                .tint(.green)
                            
                            if maxWindKph != originalMaxWindKph {
                                Text("Changed from \(Int(originalMaxWindKph)) → \(Int(maxWindKph))")
                                    .font(.caption)
                                    .foregroundColor(.orange)
                            }
                        }
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                        
                        // Non-editable constraints
                        ConstraintRow(label: "Avoid Inversion", value: "true", editable: false)
                        ConstraintRow(label: "Max Relative Humidity", value: "85%", editable: false)
                        ConstraintRow(label: "Min Hours Without Rain", value: "4", editable: false)
                    }
                }
                
                // Patch form (only show if changed)
                if maxWindKph != originalMaxWindKph && !isPatchApplied {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Patch Details")
                            .font(.headline)
                        
                        TextField("Reason for change", text: $patchReason)
                            .textFieldStyle(.roundedBorder)
                        
                        TextField("Justification", text: $patchJustification)
                            .textFieldStyle(.roundedBorder)
                        
                        Button(action: { showPatchPreview = true }) {
                            SecondaryButton(title: "Preview Patch", icon: "doc.text.magnifyingglass")
                        }
                        
                        Button(action: applyPatch) {
                            PrimaryButton(title: "Apply Patch", icon: "checkmark.circle.fill")
                        }
                        .disabled(patchReason.isEmpty)
                    }
                    .padding()
                    .background(Color.orange.opacity(0.1))
                    .cornerRadius(12)
                }
                
                // Patch applied confirmation
                if isPatchApplied {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                            Text("Patch Applied Successfully")
                                .font(.headline)
                                .foregroundColor(.green)
                        }
                        
                        Text("Playbook version: \(playbookVersion - 1) → \(playbookVersion)")
                            .font(.subheadline)
                        
                        if let rec = recomputedRecommendation {
                            Divider()
                            
                            Text("Recomputed Recommendation")
                                .font(.headline)
                            
                            Text(rec.recommendationId)
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
                            
                            Text("Window tightened due to lower wind threshold")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(12)
                }
            }
            .padding()
        }
        .navigationTitle("Playbook Editor")
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showPatchPreview) {
            PatchPreviewSheet(
                patchId: "pch_20260211_0001",
                playbookId: "pbk_yolo_grape",
                baseVersion: playbookVersion,
                path: "/rules/rule_pm_moderate/constraints/maxWindKph",
                oldValue: Int(originalMaxWindKph),
                newValue: Int(maxWindKph),
                reason: patchReason,
                justification: patchJustification
            )
        }
        .onAppear {
            playbookVersion = appState.activePlaybookVersion
        }
    }
    
    private func applyPatch() {
        // Simulate patch apply
        playbookVersion += 1
        appState.activePlaybookVersion = playbookVersion
        originalMaxWindKph = maxWindKph
        isPatchApplied = true
        
        // Simulate recompute
        recomputedRecommendation = Recommendation(
            recommendationId: "rec_20260211_0002",
            observationId: "obs_20260211_0001",
            playbookId: "pbk_yolo_grape",
            playbookVersion: playbookVersion,
            weatherFeaturesId: "wxf_20260211_demo_01",
            generatedAt: ISO8601DateFormatter().string(from: Date()),
            issue: .powderyMildew,
            severity: .moderate,
            action: "Apply sulfur-based contact spray in affected block.",
            rationale: ["avoid_inversion", "high_humidity_persistence", "tighter_wind_constraint"],
            timingWindow: RecommendationTimingWindow(
                startAt: "2026-02-11T21:15:00-08:00",
                endAt: "2026-02-11T23:30:00-08:00",
                localTimezone: "America/Los_Angeles",
                confidence: 0.79,
                drivers: ["maxWindKph=10", "inversionPresent=false", "windShearProxy=moderate"]
            ),
            riskFlags: [],
            requiredConfirmation: true,
            status: .pendingConfirmation
        )
    }
    
    private func formatTime(_ isoString: String) -> String {
        if let range = isoString.range(of: "T") {
            let timepart = String(isoString[range.upperBound...])
            if let endRange = timepart.range(of: "-") {
                return String(timepart[..<endRange.lowerBound])
            }
        }
        return isoString
    }
}

struct ConstraintRow: View {
    let label: String
    let value: String
    let editable: Bool
    
    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
            Spacer()
            Text(value)
                .font(.subheadline)
                .fontWeight(.medium)
            if !editable {
                Image(systemName: "lock.fill")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(8)
    }
}

struct PatchPreviewSheet: View {
    let patchId: String
    let playbookId: String
    let baseVersion: Int
    let path: String
    let oldValue: Int
    let newValue: Int
    let reason: String
    let justification: String
    
    @Environment(\.dismiss) var dismiss
    
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Patch Preview")
                        .font(.title2)
                        .fontWeight(.bold)
                    
                    Text(patchJSON)
                        .font(.system(.caption, design: .monospaced))
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                }
                .padding()
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
    
    var patchJSON: String {
        """
        {
          "patchId": "\(patchId)",
          "playbookId": "\(playbookId)",
          "baseVersion": \(baseVersion),
          "requestedByDeviceId": "dev_ios_001",
          "requestedAt": "\(ISO8601DateFormatter().string(from: Date()))",
          "reason": "\(reason)",
          "operations": [
            {
              "op": "replace",
              "path": "\(path)",
              "value": \(newValue),
              "justification": "\(justification)"
            }
          ]
        }
        """
    }
}

#Preview {
    NavigationStack {
        PlaybookEditorView()
            .environmentObject(AppState())
    }
}
