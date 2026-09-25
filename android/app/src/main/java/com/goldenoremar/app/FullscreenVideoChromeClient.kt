package com.goldenoremar.app

import android.content.pm.ActivityInfo
import android.graphics.Color
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.getcapacitor.Bridge
import com.getcapacitor.BridgeWebChromeClient

/**
 * Lets web video - including embedded YouTube - go genuinely full screen
 * inside the Android app.
 *
 * Capacitor's BridgeWebChromeClient rejects full screen outright: its
 * onShowCustomView calls callback.onCustomViewHidden() before anything else,
 * so pressing the full-screen button in an embedded player does nothing. On the
 * web the same button works, which makes this easy to miss in testing.
 *
 * This subclasses BridgeWebChromeClient rather than replacing it. That class
 * also owns the file chooser (the camera and gallery upload in the admin and
 * producer panels), runtime permission prompts and geolocation. Extending it
 * keeps all of that intact; only the two full-screen callbacks change.
 *
 * Construct it from Activity.onCreate. BridgeWebChromeClient's constructor
 * registers ActivityResult launchers, and Android only allows that before the
 * activity reaches STARTED. Creating it any later throws.
 *
 * Behaviour while full screen:
 *   - the video view is laid over the whole window on a black background
 *   - system bars are hidden, and reappear transiently on a swipe
 *   - orientation follows the device and the user's rotation lock rather than
 *     being forced to landscape, because YouTube Shorts are vertical and a
 *     forced landscape would squash them
 *   - the back gesture leaves full screen instead of leaving the screen
 */
class FullscreenVideoChromeClient(
    private val activity: ComponentActivity,
    bridge: Bridge,
) : BridgeWebChromeClient(bridge) {

    private var customView: View? = null
    private var customViewCallback: WebChromeClient.CustomViewCallback? = null
    private var orientationBeforeFullscreen: Int = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED

    // Enabled only while a video is full screen, so it never intercepts the
    // back gesture the rest of the app relies on.
    private val exitOnBack = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            onHideCustomView()
        }
    }

    init {
        activity.onBackPressedDispatcher.addCallback(activity, exitOnBack)
    }

    override fun onShowCustomView(view: View?, callback: WebChromeClient.CustomViewCallback?) {
        if (view == null) {
            callback?.onCustomViewHidden()
            return
        }
        if (customView != null) {
            // Already full screen: decline the second request cleanly.
            callback?.onCustomViewHidden()
            return
        }
        val decor = activity.window.decorView as? ViewGroup
        if (decor == null) {
            callback?.onCustomViewHidden()
            return
        }

        customView = view
        customViewCallback = callback
        orientationBeforeFullscreen = activity.requestedOrientation

        view.setBackgroundColor(Color.BLACK)
        decor.addView(
            view,
            ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT),
        )

        val insets = WindowCompat.getInsetsController(activity.window, decor)
        insets.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        insets.hide(WindowInsetsCompat.Type.systemBars())

        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_USER
        exitOnBack.isEnabled = true
    }

    override fun onHideCustomView() {
        val view = customView ?: return
        val decor = activity.window.decorView as? ViewGroup

        decor?.removeView(view)
        customView = null
        exitOnBack.isEnabled = false

        if (decor != null) {
            WindowCompat.getInsetsController(activity.window, decor).show(WindowInsetsCompat.Type.systemBars())
        }
        activity.requestedOrientation = orientationBeforeFullscreen

        // Tell the page the video left full screen, so the player's own
        // controls return to the inline state.
        customViewCallback?.onCustomViewHidden()
        customViewCallback = null
    }
}
