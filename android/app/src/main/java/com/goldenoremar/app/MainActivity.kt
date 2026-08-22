package com.goldenoremar.app

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.getcapacitor.BridgeActivity
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallState
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NativeSpeechPlugin::class.java)
        registerPlugin(NativeAppUpdatePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}

@CapacitorPlugin(name = "NativeAppUpdate")
class NativeAppUpdatePlugin : Plugin() {
    private var updateManager: AppUpdateManager? = null
    private var installStateListener: InstallStateUpdatedListener? = null

    override fun load() {
        super.load()
        val manager = AppUpdateManagerFactory.create(context)
        updateManager = manager
        val listener = InstallStateUpdatedListener { state ->
            notifyListeners("state", installStatePayload(state), true)
        }
        installStateListener = listener
        manager.registerListener(listener)
    }

    @PluginMethod
    fun check(call: PluginCall) {
        val manager = updateManager ?: AppUpdateManagerFactory.create(context).also { updateManager = it }
        manager.appUpdateInfo
            .addOnSuccessListener { info -> call.resolve(updateInfoPayload(info)) }
            .addOnFailureListener { error ->
                val result = emptyUpdateState()
                result.put("reason", error.javaClass.simpleName.ifBlank { "play_update_unavailable" })
                call.resolve(result)
            }
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val manager = updateManager ?: AppUpdateManagerFactory.create(context).also { updateManager = it }
        val requestedMode = call.getString("mode")?.trim()?.lowercase().orEmpty()
        val requestedType = if (requestedMode == "immediate") AppUpdateType.IMMEDIATE else AppUpdateType.FLEXIBLE

        manager.appUpdateInfo
            .addOnSuccessListener { info ->
                val availability = info.updateAvailability()
                if (availability != UpdateAvailability.UPDATE_AVAILABLE && availability != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    call.reject("Google Play üzerinde yeni bir sürüm bulunamadı.", "update_not_available")
                    return@addOnSuccessListener
                }

                val resolvedType = when {
                    info.isUpdateTypeAllowed(requestedType) -> requestedType
                    requestedType != AppUpdateType.FLEXIBLE && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> AppUpdateType.FLEXIBLE
                    requestedType != AppUpdateType.IMMEDIATE && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> AppUpdateType.IMMEDIATE
                    else -> null
                }
                if (resolvedType == null) {
                    call.reject("Bu güncelleme şu anda cihazda başlatılamıyor.", "update_type_not_allowed")
                    return@addOnSuccessListener
                }

                try {
                    val started = manager.startUpdateFlowForResult(
                        info,
                        activity,
                        AppUpdateOptions.newBuilder(resolvedType).build(),
                        UPDATE_REQUEST_CODE,
                    )
                    val result = JSObject()
                    result.put("started", started)
                    result.put("mode", if (resolvedType == AppUpdateType.IMMEDIATE) "immediate" else "flexible")
                    call.resolve(result)
                } catch (error: Exception) {
                    call.reject("Güncelleme ekranı başlatılamadı.", "update_start_failed", error)
                }
            }
            .addOnFailureListener { error ->
                call.reject("Google Play güncelleme bilgisine ulaşılamadı.", "play_update_unavailable", error)
            }
    }

    @PluginMethod
    fun complete(call: PluginCall) {
        val manager = updateManager ?: AppUpdateManagerFactory.create(context).also { updateManager = it }
        manager.completeUpdate()
            .addOnSuccessListener { call.resolve() }
            .addOnFailureListener { error ->
                call.reject("İndirilen güncelleme kurulamadı.", "update_complete_failed", error)
            }
    }

    override fun handleOnDestroy() {
        installStateListener?.let { listener -> updateManager?.unregisterListener(listener) }
        installStateListener = null
        updateManager = null
        super.handleOnDestroy()
    }

    private fun updateInfoPayload(info: AppUpdateInfo): JSObject {
        val status = info.installStatus()
        val result = JSObject()
        result.put("supported", true)
        result.put("available", info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE)
        result.put("flexibleAllowed", info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE))
        result.put("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE))
        result.put("availableVersionCode", info.availableVersionCode())
        result.put("installStatus", installStatusLabel(status))
        result.put("downloaded", status == InstallStatus.DOWNLOADED)
        result.put("downloading", status == InstallStatus.DOWNLOADING)
        result.put("inProgress", info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS)
        result.put("priority", info.updatePriority())
        info.clientVersionStalenessDays()?.let { result.put("stalenessDays", it) }
        return result
    }

    private fun installStatePayload(state: InstallState): JSObject {
        val result = JSObject()
        val status = state.installStatus()
        result.put("installStatus", installStatusLabel(status))
        result.put("downloaded", status == InstallStatus.DOWNLOADED)
        result.put("downloading", status == InstallStatus.DOWNLOADING)
        result.put("bytesDownloaded", state.bytesDownloaded())
        result.put("totalBytes", state.totalBytesToDownload())
        return result
    }

    private fun emptyUpdateState(): JSObject {
        val result = JSObject()
        result.put("supported", false)
        result.put("available", false)
        result.put("flexibleAllowed", false)
        result.put("immediateAllowed", false)
        result.put("downloaded", false)
        result.put("downloading", false)
        result.put("inProgress", false)
        return result
    }

    private fun installStatusLabel(status: Int): String = when (status) {
        InstallStatus.PENDING -> "pending"
        InstallStatus.DOWNLOADING -> "downloading"
        InstallStatus.DOWNLOADED -> "downloaded"
        InstallStatus.INSTALLING -> "installing"
        InstallStatus.INSTALLED -> "installed"
        InstallStatus.FAILED -> "failed"
        InstallStatus.CANCELED -> "canceled"
        else -> "unknown"
    }

    companion object {
        private const val UPDATE_REQUEST_CODE = 7814
    }
}

@CapacitorPlugin(
    name = "NativeSpeech",
    permissions = [Permission(alias = "microphone", strings = [Manifest.permission.RECORD_AUDIO])]
)
class NativeSpeechPlugin : Plugin(), RecognitionListener {
    private var recognizer: SpeechRecognizer? = null
    private var pendingCall: PluginCall? = null

    @PluginMethod
    fun available(call: PluginCall) {
        val result = JSObject()
        result.put("available", SpeechRecognizer.isRecognitionAvailable(context))
        call.resolve(result)
    }

    @PluginMethod
    fun start(call: PluginCall) {
        if (pendingCall != null) {
            call.reject("Sesli arama zaten dinliyor.", "speech_busy")
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            call.reject("Bu cihazda konuşma tanıma hizmeti kullanılamıyor.", "speech_unavailable")
            return
        }
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionCallback")
            return
        }
        beginListening(call)
    }

    @PermissionCallback
    private fun microphonePermissionCallback(call: PluginCall) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            call.reject("Mikrofon izni verilmedi.", "microphone_denied")
            return
        }
        beginListening(call)
    }

    private fun beginListening(call: PluginCall) {
        val language = call.getString("language")?.trim().orEmpty().ifEmpty { "tr-TR" }
        activity.runOnUiThread {
            try {
                recognizer?.destroy()
                recognizer = SpeechRecognizer.createSpeechRecognizer(context).also { it.setRecognitionListener(this) }
                pendingCall = call
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, language)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, language)
                    putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                }
                recognizer?.startListening(intent)
            } catch (error: Exception) {
                finishWithError("Sesli arama başlatılamadı.", "speech_start_failed", error)
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        activity.runOnUiThread {
            pendingCall?.reject("Sesli arama iptal edildi.", "speech_cancelled")
            pendingCall = null
            recognizer?.cancel()
            recognizer?.destroy()
            recognizer = null
            call.resolve()
        }
    }

    override fun onResults(results: Bundle?) {
        val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?.take(3)
            .orEmpty()
        val activeCall = pendingCall
        pendingCall = null
        recognizer?.destroy()
        recognizer = null
        if (activeCall == null) return
        if (matches.isEmpty()) {
            activeCall.reject("Konuşma anlaşılamadı. Tekrar deneyin.", "speech_no_match")
            return
        }
        val response = JSObject()
        response.put("text", matches.first())
        response.put("matches", matches)
        activeCall.resolve(response)
    }

    override fun onError(error: Int) {
        val code = when (error) {
            SpeechRecognizer.ERROR_AUDIO -> "speech_audio_error"
            SpeechRecognizer.ERROR_CLIENT -> "speech_client_error"
            SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "microphone_denied"
            SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "speech_network_error"
            SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "speech_no_match"
            SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "speech_busy"
            SpeechRecognizer.ERROR_SERVER, SpeechRecognizer.ERROR_SERVER_DISCONNECTED -> "speech_server_error"
            else -> "speech_failed"
        }
        val message = when (code) {
            "microphone_denied" -> "Mikrofon izni verilmedi."
            "speech_network_error" -> "Konuşma tanıma için ağ bağlantısı kurulamadı."
            "speech_no_match" -> "Konuşma anlaşılamadı. Tekrar deneyin."
            "speech_busy" -> "Konuşma tanıma hizmeti şu anda meşgul."
            else -> "Sesli arama tamamlanamadı."
        }
        finishWithError(message, code, null)
    }

    private fun finishWithError(message: String, code: String, error: Exception?) {
        val activeCall = pendingCall
        pendingCall = null
        recognizer?.destroy()
        recognizer = null
        if (activeCall != null) {
            if (error != null) activeCall.reject(message, code, error)
            else activeCall.reject(message, code)
        }
    }

    override fun onReadyForSpeech(params: Bundle?) = Unit
    override fun onBeginningOfSpeech() = Unit
    override fun onRmsChanged(rmsdB: Float) = Unit
    override fun onBufferReceived(buffer: ByteArray?) = Unit
    override fun onEndOfSpeech() = Unit
    override fun onPartialResults(partialResults: Bundle?) = Unit
    override fun onEvent(eventType: Int, params: Bundle?) = Unit
}
