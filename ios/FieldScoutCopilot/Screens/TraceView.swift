import SwiftUI

struct TraceView: View {
    @EnvironmentObject var appState: AppState
    
    @State private var traceEvents: [TraceEvent] = []
    @State private var totalDurationMs: Int = 0
    
    var body: some View {
        List {
            // Summary section
            Section("Summary") {
                HStack {
                    Text("Trace ID")
                    Spacer()
                    Text("trace_20260211_demo_01")
                        .font(.system(.body, design: .monospaced))
                        .foregroundColor(.secondary)
                }
                
                HStack {
                    Text("Total Duration")
                    Spacer()
                    Text("\(totalDurationMs) ms")
                        .font(.headline)
                        .foregroundColor(totalDurationMs <= 90000 ? .green : .red)
                }
                
                HStack {
                    Text("Status")
                    Spacer()
                    if totalDurationMs <= 90000 {
                        Label("Pass", systemImage: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    } else {
                        Label("Fail", systemImage: "xmark.circle.fill")
                            .foregroundColor(.red)
                    }
                }
            }
            
            // Stage breakdown
            Section("Stage Breakdown") {
                ForEach(traceEvents) { event in
                    TraceEventRow(event: event)
                }
            }
            
            // Performance thresholds
            Section("Thresholds") {
                ThresholdRow(stage: "Record → Transcript", threshold: "≤ 8s", actual: findDuration(for: "transcribing"))
                ThresholdRow(stage: "Transcript → Observation", threshold: "≤ 15s", actual: findDuration(for: "extracting"))
                ThresholdRow(stage: "Recommendation", threshold: "≤ 5s", actual: findDuration(for: "recommending"))
                ThresholdRow(stage: "Patch + Recompute", threshold: "≤ 4s", actual: findDuration(for: "patch_apply"))
                ThresholdRow(stage: "Full Loop", threshold: "≤ 90s", actual: totalDurationMs)
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Trace")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(action: refreshTrace) {
                    Image(systemName: "arrow.clockwise")
                }
            }
        }
        .onAppear {
            loadDemoTrace()
        }
    }
    
    private func loadDemoTrace() {
        // Demo trace data matching the 90-second script
        let baseTime = Date()
        
        traceEvents = [
            TraceEvent(stage: "capture_start", startedAt: baseTime, endedAt: baseTime.addingTimeInterval(5), status: .completed),
            TraceEvent(stage: "recording", startedAt: baseTime.addingTimeInterval(5), endedAt: baseTime.addingTimeInterval(22), status: .completed),
            TraceEvent(stage: "transcribing", startedAt: baseTime.addingTimeInterval(22), endedAt: baseTime.addingTimeInterval(28), status: .completed),
            TraceEvent(stage: "extracting", startedAt: baseTime.addingTimeInterval(28), endedAt: baseTime.addingTimeInterval(42), status: .completed),
            TraceEvent(stage: "recommending", startedAt: baseTime.addingTimeInterval(42), endedAt: baseTime.addingTimeInterval(48), status: .completed),
            TraceEvent(stage: "confirmation", startedAt: baseTime.addingTimeInterval(48), endedAt: baseTime.addingTimeInterval(62), status: .completed),
            TraceEvent(stage: "logged", startedAt: baseTime.addingTimeInterval(62), endedAt: baseTime.addingTimeInterval(70), status: .completed),
            TraceEvent(stage: "patch_apply", startedAt: baseTime.addingTimeInterval(70), endedAt: baseTime.addingTimeInterval(74), status: .completed),
            TraceEvent(stage: "recompute", startedAt: baseTime.addingTimeInterval(74), endedAt: baseTime.addingTimeInterval(78), status: .completed),
        ]
        
        totalDurationMs = 78000 // 78 seconds total
    }
    
    private func refreshTrace() {
        loadDemoTrace()
    }
    
    private func findDuration(for stage: String) -> Int {
        if let event = traceEvents.first(where: { $0.stage == stage }) {
            return event.durationMs
        }
        return 0
    }
}

struct TraceEvent: Identifiable {
    let id = UUID()
    let stage: String
    let startedAt: Date
    let endedAt: Date
    let status: TraceStatus
    
    var durationMs: Int {
        Int(endedAt.timeIntervalSince(startedAt) * 1000)
    }
}

enum TraceStatus {
    case pending
    case inProgress
    case completed
    case failed
}

struct TraceEventRow: View {
    let event: TraceEvent
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(event.stage)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                Text("\(event.durationMs) ms")
                    .font(.system(.subheadline, design: .monospaced))
                    .foregroundColor(.secondary)
            }
            
            HStack {
                statusIcon
                Text(formatTime(event.startedAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text("→")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Text(formatTime(event.endedAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    var statusIcon: some View {
        Group {
            switch event.status {
            case .pending:
                Image(systemName: "circle")
                    .foregroundColor(.gray)
            case .inProgress:
                Image(systemName: "circle.fill")
                    .foregroundColor(.blue)
            case .completed:
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
            case .failed:
                Image(systemName: "xmark.circle.fill")
                    .foregroundColor(.red)
            }
        }
        .font(.caption)
    }
    
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        return formatter.string(from: date)
    }
}

struct ThresholdRow: View {
    let stage: String
    let threshold: String
    let actual: Int
    
    var body: some View {
        HStack {
            VStack(alignment: .leading) {
                Text(stage)
                    .font(.subheadline)
                Text(threshold)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Text("\(actual) ms")
                .font(.system(.subheadline, design: .monospaced))
                .foregroundColor(isPassing ? .green : .red)
            
            Image(systemName: isPassing ? "checkmark.circle.fill" : "xmark.circle.fill")
                .foregroundColor(isPassing ? .green : .red)
        }
    }
    
    var isPassing: Bool {
        // Parse threshold and compare
        switch stage {
        case "Record → Transcript": return actual <= 8000
        case "Transcript → Observation": return actual <= 15000
        case "Recommendation": return actual <= 5000
        case "Patch + Recompute": return actual <= 4000
        case "Full Loop": return actual <= 90000
        default: return true
        }
    }
}

#Preview {
    NavigationStack {
        TraceView()
            .environmentObject(AppState())
    }
}
