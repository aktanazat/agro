import SwiftUI

struct HomeView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        VStack(spacing: 24) {
            // Offline badge
            HStack {
                Spacer()
                OfflineBadge(isOffline: appState.isOfflineMode)
            }
            .padding(.horizontal)
            
            Spacer()
            
            // App title
            VStack(spacing: 8) {
                Image(systemName: "leaf.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.green)
                
                Text("FieldScout Copilot")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                Text("Device: \(appState.deviceId)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            // Main actions
            VStack(spacing: 16) {
                NavigationLink(destination: NewObservationView()) {
                    PrimaryButton(title: "New Observation", icon: "plus.circle.fill")
                }
                
                NavigationLink(destination: HistoryView()) {
                    SecondaryButton(title: "History", icon: "clock.fill")
                }
                
                NavigationLink(destination: PlaybookEditorView()) {
                    SecondaryButton(title: "Playbook Editor", icon: "book.fill")
                }
                
                NavigationLink(destination: TraceView()) {
                    SecondaryButton(title: "Trace", icon: "chart.bar.fill")
                }
            }
            .padding(.horizontal, 32)
            
            Spacer()
        }
        .navigationBarHidden(true)
    }
}

struct OfflineBadge: View {
    let isOffline: Bool
    
    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isOffline ? Color.orange : Color.green)
                .frame(width: 8, height: 8)
            Text(isOffline ? "Offline" : "Online")
                .font(.caption)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(.systemGray6))
        .cornerRadius(16)
    }
}

struct PrimaryButton: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
            Text(title)
                .fontWeight(.semibold)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.green)
        .foregroundColor(.white)
        .cornerRadius(12)
    }
}

struct SecondaryButton: View {
    let title: String
    let icon: String
    
    var body: some View {
        HStack {
            Image(systemName: icon)
            Text(title)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemGray6))
        .foregroundColor(.primary)
        .cornerRadius(12)
    }
}

#Preview {
    NavigationStack {
        HomeView()
            .environmentObject(AppState())
    }
}
