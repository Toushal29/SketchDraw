package com.toush.sketchdraw

import android.app.Activity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
internal class StylusPreviewConfigArgs {
  var enabled: Boolean = false
  var canvasLeft: Float = 0f
  var canvasTop: Float = 0f
  var canvasWidth: Float = 0f
  var canvasHeight: Float = 0f
  var color: String? = null
  var thickness: Float = 1f
  var opacity: Float = 1f
  var zoom: Float = 1f
  var brushMode: String? = null
  var pressureEnabled: Boolean = true
  var tiltEnabled: Boolean = true
}

@TauriPlugin
class AndroidStylusPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun setStylusPreviewConfig(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(StylusPreviewConfigArgs::class.java)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Could not read Android stylus settings.")
      return
    }
    val mainActivity = activity as? MainActivity
    if (mainActivity == null) {
      invoke.reject("The Android stylus preview requires the main activity.")
      return
    }
    activity.runOnUiThread {
      AndroidStylusInkController.configure(mainActivity, args)
      invoke.resolve(JSObject())
    }
  }
}
