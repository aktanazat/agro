import SwiftUI

struct HistoryView: View {
    @EnvironmentObject var appState: AppState
    
    // Demo history items
    @State private var historyItems: [HistoryItem] = []
    
    var body: some View {
        List {
            if historyItems.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "clock.badge.questionmark")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("No observations yet")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Text("Create your first observation to see it here")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 60)
                .listRowBackground(Color.clear)
            } else {
                ForEach(historyItems) { item in
                    HistoryRow(item: item)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            loadHistory()
        }
    }
    
    private func loadHistory() {
        let store = appState.localStore
        let observations = store.listRecentObservations(deviceId: appState.deviceId, limit: 50)
        
        historyItems = observations.compactMap { obs in
            let recs = store.listRecommendationsForObservation(observationId: obs.observationId)
            let latestRec = recs.first
            
            return HistoryItem(
                observationId: obs.observationId,
                recommendationId: latestRec?.recommendationId ?? "—",
                issue: obs.extraction.issue,
                severity: obs.extraction.severity,
                fieldBlock: obs.extraction.fieldBlock,
                status: latestRec?.status ?? .pendingConfirmation,
                createdAt: obs.createdAt
            )
        }
    }
}

struct HistoryItem: Identifiable {
    let id = UUID()
    let observationId: String
    let recommendationId: String
    let issue: Issue
    let severity: Severity
    let fieldBlock: String
    let status: RecommendationStatus
    let createdAt: String
}

struct HistoryRow: View {
    let item: HistoryItem
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(item.fieldBlock)
                    .font(.headline)
                Spacer()
                StatusBadge(status: item.status)
            }
            
            HStack {
                IssueTag(issue: item.issue)
                SeverityTag(severity: item.severity)
            }
            
            HStack {
                Text(item.observationId)
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text(formatDate(item.createdAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
    
    private func formatDate(_ isoString: String) -> String {
        // Simple date formatting for demo
        if let range = isoString.range(of: "T") {
            return String(isoString[..<range.lowerBound])
        }
        return isoString
    }
}

struct IssueTag: View {
    let issue: Issue
    
    var body: some View {
        Text(issueText)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.purple.opacity(0.1))
            .foregroundColor(.purple)
            .cornerRadius(4)
    }
    
    var issueText: String {
        switch issue {
        case .powderyMildew: return "Powdery Mildew"
        case .heatStress: return "Heat Stress"
        case .other: return "Other"
        }
    }
}

struct SeverityTag: View {
    let severity: Severity
    
    var body: some View {
        Text(severity.rawValue.capitalized)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(severityColor.opacity(0.1))
            .foregroundColor(severityColor)
            .cornerRadius(4)
    }
    
    var severityColor: Color {
        switch severity {
        case .low: return .green
        case .moderate: return .orange
        case .high: return .red
        }
    }
}

#Preview {
    NavigationStack {
        HistoryView()
            .environmentObject(AppState())
    }
}
