import Foundation
import Cactus

enum CactusModelState: Equatable {
    case idle
    case loading
    case ready
    case failed(String)
}

/// Manages lifecycle of the on-device Cactus language model.
actor CactusModelManager {
    private var languageModel: CactusLanguageModel?
    private(set) var state: CactusModelState = .idle

    /// Loads the language model from CactusModelsDirectory.
    /// Call this once at app launch (via .task modifier).
    func loadModels() async {
        state = .loading
        do {
            let modelURL = try await CactusModelsDirectory.shared.modelURL(for: "qwen3-0.6b")
            languageModel = try CactusLanguageModel(from: modelURL)
            state = .ready
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    /// Returns the loaded language model, or nil if not yet ready.
    func getLanguageModel() -> CactusLanguageModel? {
        languageModel
    }

    var isReady: Bool {
        state == .ready
    }
}
