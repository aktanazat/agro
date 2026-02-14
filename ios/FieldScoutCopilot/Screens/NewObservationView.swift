import SwiftUI
import AVFoundation

struct NewObservationView: View {
    @EnvironmentObject var appState: AppState
    @State private var isRecording = false
    @State private var showTypedInput = false
    @State private var typedNote = ""
    @State private var transcript = ""
    @State private var transcriptConfidence: Double = 0.0
    
    var body: some View {
        VStack(spacing: 24) {
            // Header with offline badge
            HStack {
                Text("New Observation")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                OfflineBadge(isOffline: appState.isOfflineMode)
            }
            .padding(.horizontal)
            
            Spacer()
            
            if showTypedInput {
                // Typed input mode
                TypedInputView(
                    typedNote: $typedNote,
                    onSubmit: { submitTypedNote() },
                    onSwitchToVoice: { showTypedInput = false }
                )
            } else {
                // Voice input mode
                VoiceInputView(
                    isRecording: $isRecording,
                    transcript: $transcript,
                    confidence: $transcriptConfidence,
                    onStartRecording: { startRecording() },
                    onStopRecording: { stopRecording() },
                    onSwitchToTyped: { showTypedInput = true }
                )
            }
            
            Spacer()
            
            // Continue button (enabled when we have content)
            if !transcript.isEmpty || !typedNote.isEmpty {
                NavigationLink(destination: ReviewEditView(
                    rawNoteText: showTypedInput ? typedNote : transcript,
                    captureMode: showTypedInput ? .typed : .voice,
                    transcriptConfidence: showTypedInput ? 1.0 : transcriptConfidence
                )) {
                    PrimaryButton(title: "Structure Note", icon: "arrow.right.circle.fill")
                }
                .padding(.horizontal, 32)
            }
        }
        .padding(.vertical)
        .navigationBarTitleDisplayMode(.inline)
    }
    
    private func startRecording() {
        appState.observationFlowState = .recording
        isRecording = true
        // TODO: Implement actual audio recording
    }
    
    private func stopRecording() {
        isRecording = false
        appState.observationFlowState = .transcribing
        // TODO: Implement actual transcription
        // For now, simulate with demo transcript
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            transcript = "Block 7 Chardonnay. I see white powder on upper leaf surfaces, moderate spread after two warm days. Leaves are dry right now, slight musty odor, wind feels light. Log this and give me a spray window tonight."
            transcriptConfidence = 0.93
            appState.observationFlowState = .extracting
        }
    }
    
    private func submitTypedNote() {
        appState.observationFlowState = .extracting
    }
}

struct VoiceInputView: View {
    @Binding var isRecording: Bool
    @Binding var transcript: String
    @Binding var confidence: Double
    let onStartRecording: () -> Void
    let onStopRecording: () -> Void
    let onSwitchToTyped: () -> Void
    
    var body: some View {
        VStack(spacing: 24) {
            // Waveform / recording indicator
            ZStack {
                Circle()
                    .fill(isRecording ? Color.red.opacity(0.2) : Color.gray.opacity(0.1))
                    .frame(width: 200, height: 200)
                
                if isRecording {
                    // Animated recording indicator
                    Circle()
                        .stroke(Color.red, lineWidth: 4)
                        .frame(width: 200, height: 200)
                        .scaleEffect(isRecording ? 1.1 : 1.0)
                        .animation(.easeInOut(duration: 0.5).repeatForever(), value: isRecording)
                }
                
                Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                    .font(.system(size: 60))
                    .foregroundColor(isRecording ? .red : .green)
            }
            
            // Record button
            Button(action: {
                if isRecording {
                    onStopRecording()
                } else {
                    onStartRecording()
                }
            }) {
                Text(isRecording ? "Stop Recording" : "Hold to Record")
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding(.horizontal, 32)
                    .padding(.vertical, 16)
                    .background(isRecording ? Color.red : Color.green)
                    .cornerRadius(25)
            }
            
            // Transcript display
            if !transcript.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Transcript")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        Text("Confidence: \(Int(confidence * 100))%")
                            .font(.caption)
                            .foregroundColor(confidence >= 0.85 ? .green : .orange)
                    }
                    
                    Text(transcript)
                        .font(.body)
                        .padding()
                        .background(Color(.systemGray6))
                        .cornerRadius(8)
                }
                .padding(.horizontal)
            }
            
            // Switch to typed
            Button(action: onSwitchToTyped) {
                Text("Switch to Typed Input")
                    .font(.subheadline)
                    .foregroundColor(.blue)
            }
        }
    }
}

struct TypedInputView: View {
    @Binding var typedNote: String
    let onSubmit: () -> Void
    let onSwitchToVoice: () -> Void
    
    var body: some View {
        VStack(spacing: 24) {
            Text("Type your observation")
                .font(.headline)
            
            TextEditor(text: $typedNote)
                .frame(height: 200)
                .padding(8)
                .background(Color(.systemGray6))
                .cornerRadius(8)
                .padding(.horizontal)
            
            Button(action: onSwitchToVoice) {
                Text("Switch to Voice Input")
                    .font(.subheadline)
                    .foregroundColor(.blue)
            }
        }
    }
}

#Preview {
    NavigationStack {
        NewObservationView()
            .environmentObject(AppState())
    }
}
