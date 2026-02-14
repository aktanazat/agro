import SwiftUI

@main
struct FieldScoutCopilotApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

@MainActor
class AppState: ObservableObject {
    @Published var isOfflineMode: Bool = true
    @Published var deviceId: String = "dev_ios_001"
    @Published var activePlaybookVersion: Int = 3
    
    // Current observation in progress
    @Published var currentObservation: Observation?
    @Published var currentRecommendation: Recommendation?
    
    // Navigation state
    @Published var observationFlowState: ObservationFlowState = .idle
}

enum ObservationFlowState {
    case idle
    case recording
    case transcribing
    case extracting
    case extracted
    case recommending
    case recommendationReady
    case confirmed
    case logged
}
