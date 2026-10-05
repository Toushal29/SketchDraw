package com.toush.sketchdraw

import android.app.Activity
import android.content.pm.ActivityInfo
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
internal class OrientationArgs {
  lateinit var orientation: String
}

@TauriPlugin
class OrientationPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun setOrientation(invoke: Invoke) {
    val args = invoke.parseArgs(OrientationArgs::class.java)
    val requestedOrientation = when (args.orientation) {
      "landscape" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
      "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
      else -> {
        invoke.reject("Choose portrait or landscape orientation.")
        return
      }
    }

    activity.requestedOrientation = requestedOrientation
    invoke.resolve()
  }
}
