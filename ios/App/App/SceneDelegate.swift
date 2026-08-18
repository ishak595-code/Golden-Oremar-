import UIKit
import Capacitor
import Speech
import AVFoundation

@objc(NativeSpeechPlugin)
final class NativeSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "NativeSpeechPlugin"
    let jsName = "NativeSpeech"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var activeCall: CAPPluginCall?
    private var tapInstalled = false

    @objc func available(_ call: CAPPluginCall) {
        let language = normalizedLanguage(call.getString("language"))
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language))
        call.resolve(["available": recognizer?.isAvailable == true])
    }

    @objc func start(_ call: CAPPluginCall) {
        guard activeCall == nil else {
            call.reject("Sesli arama zaten dinliyor.", "speech_busy")
            return
        }
        let language = normalizedLanguage(call.getString("language"))
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: language)), recognizer.isAvailable else {
            call.reject("Bu cihazda konuşma tanıma hizmeti kullanılamıyor.", "speech_unavailable")
            return
        }

        SFSpeechRecognizer.requestAuthorization { [weak self] speechStatus in
            guard let self else { return }
            guard speechStatus == .authorized else {
                call.reject("Konuşma tanıma izni verilmedi.", "speech_permission_denied")
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
                guard let self else { return }
                guard granted else {
                    call.reject("Mikrofon izni verilmedi.", "microphone_denied")
                    return
                }
                DispatchQueue.main.async {
                    self.beginListening(call: call, recognizer: recognizer)
                }
            }
        }
    }

    private func beginListening(call: CAPPluginCall, recognizer: SFSpeechRecognizer) {
        do {
            cleanupAudio()
            activeCall = call
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = false
            recognitionRequest = request

            let inputNode = audioEngine.inputNode
            let recordingFormat = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak request] buffer, _ in
                request?.append(buffer)
            }
            tapInstalled = true
            audioEngine.prepare()
            try audioEngine.start()

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                guard let self else { return }
                if let result, result.isFinal {
                    let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                    if text.isEmpty {
                        self.finishError("Konuşma anlaşılamadı. Tekrar deneyin.", code: "speech_no_match")
                    } else {
                        self.finishSuccess(text)
                    }
                    return
                }
                if error != nil {
                    self.finishError("Sesli arama tamamlanamadı.", code: "speech_failed")
                }
            }
        } catch {
            cleanupAudio()
            activeCall = nil
            call.reject("Sesli arama başlatılamadı.", "speech_start_failed", error)
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        if let activeCall {
            activeCall.reject("Sesli arama iptal edildi.", "speech_cancelled")
        }
        activeCall = nil
        cleanupAudio()
        call.resolve()
    }

    private func finishSuccess(_ text: String) {
        let call = activeCall
        activeCall = nil
        cleanupAudio()
        call?.resolve(["text": text, "matches": [text]])
    }

    private func finishError(_ message: String, code: String) {
        let call = activeCall
        activeCall = nil
        cleanupAudio()
        call?.reject(message, code)
    }

    private func cleanupAudio() {
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func normalizedLanguage(_ value: String?) -> String {
        let language = value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if language.range(of: #"^[A-Za-z]{2,3}(?:-[A-Za-z]{2})?$"#, options: .regularExpression) != nil {
            return language
        }
        return "tr-TR"
    }
}

final class GoldenOremarBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeSpeechPlugin())
    }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = GoldenOremarBridgeViewController()
        window?.makeKeyAndVisible()
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
