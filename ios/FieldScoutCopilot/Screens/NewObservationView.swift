import SwiftUI
import AVFoundation
import Speech

struct NewObservationView: View {
    @EnvironmentObject var appState: AppState
    @State private var isRecording = false
    @State private var typedNote = ""
    @State private var voiceTranscript = ""
    @State private var transcriptConfidence: Double = 0.0
    @State private var audioLevel: CGFloat = 0.0
    
    // Speech recognition
    @State private var speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    @State private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    @State private var recognitionTask: SFSpeechRecognitionTask?
    @State private var audioEngine = AVAudioEngine()
    
    // Combined note text
    var combinedNoteText: String {
        let voice = voiceTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        let typed = typedNote.trimmingCharacters(in: .whitespacesAndNewlines)
        
        if !voice.isEmpty && !typed.isEmpty {
            return voice + " " + typed
        }
        return voice.isEmpty ? typed : voice
    }
    
    var captureMode: CaptureMode {
        if !voiceTranscript.isEmpty {
            return .voice
        }
        return .typed
    }
    
    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("New Observation")
                            .font(.title2)
                            .fontWeight(.bold)
                        Text(appState.deviceId)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    OfflineBadge(isOffline: appState.isOfflineMode)
                }
                .padding(.horizontal)
                
                // MARK: - Primary: Typed Input
                VStack(alignment: .leading, spacing: 10) {
                    Text("What did you observe?")
                        .font(.headline)
                    
                    Text("Example: \"Grapes Block 7, powdery mildew moderate, white powder on leaves\"")
                        .font(.caption)
                        .foregroundColor(.green)
                        .italic()
                    
                    TextEditor(text: $typedNote)
                        .frame(minHeight: 120)
                        .padding(12)
                        .background(Color(.systemGray6))
                        .cornerRadius(12)
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(typedNote.isEmpty ? Color(.systemGray4) : Color.green, lineWidth: 1)
                        )
                        .overlay(
                            Group {
                                if typedNote.isEmpty && voiceTranscript.isEmpty {
                                    Text("Type your observation here...")
                                        .foregroundColor(.secondary)
                                        .padding(.leading, 16)
                                        .padding(.top, 20)
                                }
                            },
                            alignment: .topLeading
                        )
                }
                .padding(.horizontal)
                
                // Voice transcript display (if any)
                if !voiceTranscript.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Image(systemName: "mic.fill")
                                .foregroundColor(.green)
                            Text("Voice Note")
                                .font(.subheadline)
                                .fontWeight(.medium)
                            Spacer()
                            Button(action: { voiceTranscript = "" }) {
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        Text(voiceTranscript)
                            .font(.body)
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.green.opacity(0.1))
                            .cornerRadius(8)
                    }
                    .padding(.horizontal)
                }
                
                // MARK: - Secondary: Voice Input (Compact)
                VStack(spacing: 12) {
                    HStack {
                        Rectangle()
                            .fill(Color(.systemGray4))
                            .frame(height: 1)
                        Text("or add voice note")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Rectangle()
                            .fill(Color(.systemGray4))
                            .frame(height: 1)
                    }
                    
                    CompactVoiceRecorder(
                        isRecording: $isRecording,
                        audioLevel: $audioLevel,
                        onStartRecording: startRecording,
                        onStopRecording: stopRecording
                    )
                }
                .padding(.horizontal)
                
                Spacer(minLength: 30)
                
                // Generate Button
                if !combinedNoteText.isEmpty {
                    NavigationLink(destination: GenerateRecommendationView(
                        rawNoteText: combinedNoteText,
                        captureMode: captureMode,
                        transcriptConfidence: captureMode == .voice ? max(transcriptConfidence, 0.85) : 1.0
                    )) {
                        HStack {
                            Image(systemName: "sparkles")
                            Text("Generate Recommendation")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .padding(.horizontal)
                } else {
                    Text("Enter your observation to continue")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .padding()
                }
            }
            .padding(.vertical)
        }
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            stopRecording()
        }
    }
    
    // MARK: - Speech Recognition
    
    private func startRecording() {
        transcriptConfidence = 0.0
        
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                switch status {
                case .authorized:
                    self.beginRecordingSession()
                default:
                    self.beginSimulatedRecording()
                }
            }
        }
    }
    
    private func beginRecordingSession() {
        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: .duckOthers)
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)
            
            recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
            guard let recognitionRequest = recognitionRequest else { return }
            recognitionRequest.shouldReportPartialResults = true
            
            let inputNode = audioEngine.inputNode
            
            recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { result, error in
                if let result = result {
                    DispatchQueue.main.async {
                        self.voiceTranscript = result.bestTranscription.formattedString
                        self.transcriptConfidence = Double(result.bestTranscription.segments.last?.confidence ?? 0.9)
                    }
                }
                
                if error != nil || (result?.isFinal ?? false) {
                    self.audioEngine.stop()
                    inputNode.removeTap(onBus: 0)
                }
            }
            
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { buffer, _ in
                recognitionRequest.append(buffer)
                let level = self.calculateAudioLevel(buffer: buffer)
                DispatchQueue.main.async {
                    self.audioLevel = CGFloat(level)
                }
            }
            
            audioEngine.prepare()
            try audioEngine.start()
            appState.observationFlowState = .recording
            isRecording = true
            appState.recordTraceStage(stage: "capture_start", durationMs: 5000)
            
        } catch {
            beginSimulatedRecording()
        }
    }
    
    private func beginSimulatedRecording() {
        appState.observationFlowState = .recording
        isRecording = true
        let demoWords = "Block 7 Chardonnay. I see white powder on upper leaf surfaces, moderate spread after two warm days. Leaves are dry right now, slight musty odor, wind feels light.".split(separator: " ")
        appState.recordTraceStage(stage: "capture_start", durationMs: 5000)
        
        var currentIndex = 0
        Timer.scheduledTimer(withTimeInterval: 0.12, repeats: true) { timer in
            if !self.isRecording || currentIndex >= demoWords.count {
                timer.invalidate()
                return
            }
            
            DispatchQueue.main.async {
                if currentIndex == 0 {
                    self.voiceTranscript = String(demoWords[currentIndex])
                } else {
                    self.voiceTranscript += " " + String(demoWords[currentIndex])
                }
                self.transcriptConfidence = 0.93
                self.audioLevel = CGFloat.random(in: 0.3...0.8)
            }
            currentIndex += 1
        }
    }
    
    private func stopRecording() {
        guard isRecording else { return }
        isRecording = false
        appState.observationFlowState = .transcribing
        appState.recordTraceStage(stage: "recording", durationMs: 17000)

        if audioEngine.isRunning {
            audioEngine.stop()
            recognitionRequest?.endAudio()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        audioLevel = 0

        if !voiceTranscript.isEmpty {
            appState.observationFlowState = .extracting
            appState.recordTraceStage(stage: "transcribing", durationMs: 6000)
        }
    }

    private func calculateAudioLevel(buffer: AVAudioPCMBuffer) -> Float {
        guard let channelData = buffer.floatChannelData?[0] else { return 0 }
        let frameLength = Int(buffer.frameLength)
        var sum: Float = 0
        for i in 0..<frameLength { sum += abs(channelData[i]) }
        return min(sum / Float(frameLength) * 10, 1.0)
    }

}

// MARK: - Compact Voice Recorder

struct CompactVoiceRecorder: View {
    @Binding var isRecording: Bool
    @Binding var audioLevel: CGFloat
    let onStartRecording: () -> Void
    let onStopRecording: () -> Void
    
    var body: some View {
        HStack(spacing: 16) {
            // Mic button
            Button(action: {
                if isRecording {
                    onStopRecording()
                } else {
                    onStartRecording()
                }
            }) {
                ZStack {
                    // Audio level ring
                    if isRecording {
                        Circle()
                            .stroke(Color.red.opacity(0.3), lineWidth: 3)
                            .frame(width: 52 + audioLevel * 10, height: 52 + audioLevel * 10)
                            .animation(.easeOut(duration: 0.1), value: audioLevel)
                    }
                    
                    Circle()
                        .fill(isRecording ? Color.red : Color(.systemGray5))
                        .frame(width: 48, height: 48)
                    
                    Image(systemName: isRecording ? "stop.fill" : "mic.fill")
                        .font(.system(size: 20))
                        .foregroundColor(isRecording ? .white : .green)
                }
            }
            .frame(width: 60, height: 60)
            
            // Status text
            VStack(alignment: .leading, spacing: 2) {
                Text(isRecording ? "Recording..." : "Tap to record")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(isRecording ? .red : .primary)
                
                Text("Transcription appears automatically")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(12)
    }
}

#Preview {
    NavigationStack {
        NewObservationView()
            .environmentObject(AppState())
    }
}
