import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        NavigationStack {
            HomeView()
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}
