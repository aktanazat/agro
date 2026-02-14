import SwiftUI

@main
struct FieldScoutCopilotApp: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .task {
                    await appState.loadCactusModel()
                }
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

    // Model status
    @Published var isModelLoaded: Bool = false
    @Published var modelStatusMessage: String = "Loading AI model..."

    // MARK: - Services

    let cactusModelManager: CactusModelManager
    let extractionService: ExtractionServiceImpl
    let recommendationEngine: RecommendationEngine
    let weatherService: WeatherServiceImpl
    let playbookService: PlaybookServiceImpl
    let localStore: LocalStore

    init() {
        let modelManager = CactusModelManager()
        let adapter = CactusAdapterImpl(modelManager: modelManager)

        self.cactusModelManager = modelManager
        self.extractionService = ExtractionServiceImpl(cactusAdapter: adapter)
        self.recommendationEngine = RecommendationEngine(cactusAdapter: adapter)
        self.weatherService = WeatherServiceImpl()
        self.playbookService = PlaybookServiceImpl()
        self.localStore = LocalStore.shared
    }

    /// Kicks off model loading and updates published state when done.
    func loadCactusModel() async {
        await cactusModelManager.loadModels()
        let state = await cactusModelManager.state
        switch state {
        case .ready:
            isModelLoaded = true
            modelStatusMessage = "AI model ready"
        case .failed(let message):
            isModelLoaded = false
            modelStatusMessage = "Model failed: \(message)"
        default:
            break
        }
    }
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
