package com.toush.sketchdraw

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.provider.DocumentsContract
import androidx.activity.result.ActivityResult
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONObject

@InvokeArg
internal class CreateSketchDocumentArgs {
  var fileName: String? = null
}

@InvokeArg
internal class RenameSketchDocumentArgs {
  var uri: String? = null
  var fileName: String? = null
}

@TauriPlugin
class AndroidDocumentsPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun hasAllFilesAccess(invoke: Invoke) {
    val result = JSObject()
    val available = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
    result.put("available", available)
    result.put("granted", available && Environment.isExternalStorageManager())
    invoke.resolve(result)
  }

  @Command
  fun openAllFilesAccessSettings(invoke: Invoke) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      invoke.reject("All files access is available on Android 11 and later.")
      return
    }
    val appSettings = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
      data = Uri.parse("package:${activity.packageName}")
    }
    try {
      activity.startActivity(appSettings)
      invoke.resolve(JSObject())
    } catch (_: Exception) {
      try {
        activity.startActivity(Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION))
        invoke.resolve(JSObject())
      } catch (error: Exception) {
        invoke.reject(error.message ?: "Could not open Android storage access settings.")
      }
    }
  }

  @Command
  fun pickSketchDocument(invoke: Invoke) {
    val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "*/*"
      putExtra(
        Intent.EXTRA_MIME_TYPES,
        arrayOf("application/vnd.sketch+json", "application/json", "text/plain", "application/octet-stream"),
      )
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
      )
    }
    startActivityForResult(invoke, intent, "pickSketchDocumentResult")
  }

  @ActivityCallback
  fun pickSketchDocumentResult(invoke: Invoke, result: ActivityResult) {
    if (result.resultCode != Activity.RESULT_OK) {
      resolveUri(invoke, null)
      return
    }
    persistDocumentPermission(invoke, result.data)
  }

  @Command
  fun createSketchDocument(invoke: Invoke) {
    val args = invoke.parseArgs(CreateSketchDocumentArgs::class.java)
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/vnd.sketch+json"
      putExtra(Intent.EXTRA_TITLE, args.fileName ?: "Untitled.sketch")
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
      )
    }
    startActivityForResult(invoke, intent, "createSketchDocumentResult")
  }

  @Command
  fun renameSketchDocument(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(RenameSketchDocumentArgs::class.java)
      val uri = Uri.parse(args.uri ?: throw IllegalArgumentException("The sketch path is missing."))
      val requestedName = args.fileName?.trim() ?: ""
      if (uri.scheme != "content" || requestedName.isBlank() || requestedName.length > 180 || requestedName.any { it.isISOControl() || it in "<>:\"/\\|?*" } || requestedName.endsWith('.') || requestedName.endsWith(' ')) {
        throw IllegalArgumentException("Enter a valid sketch file name.")
      }
      val fileName = if (requestedName.endsWith(".sketch", ignoreCase = true)) requestedName else "$requestedName.sketch"
      val renamed = DocumentsContract.renameDocument(activity.contentResolver, uri, fileName)
        ?: throw IllegalStateException("The document provider did not rename this file.")
      try {
        activity.contentResolver.takePersistableUriPermission(
          renamed,
          Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
        )
      } catch (_: SecurityException) {
        // The original persisted grant can remain valid when a provider reuses its document URI.
      }
      resolveUri(invoke, renamed.toString())
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Could not rename this sketch.")
    }
  }

  @ActivityCallback
  fun createSketchDocumentResult(invoke: Invoke, result: ActivityResult) {
    if (result.resultCode != Activity.RESULT_OK) {
      resolveUri(invoke, null)
      return
    }
    persistDocumentPermission(invoke, result.data)
  }

  private fun persistDocumentPermission(invoke: Invoke, data: Intent?) {
    try {
      val uri: Uri = data?.data ?: throw IllegalStateException("The document picker returned no file.")
      val granted = data.flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
      if (granted == 0) throw SecurityException("The document provider did not grant file access.")
      activity.contentResolver.takePersistableUriPermission(uri, granted)
      resolveUri(invoke, uri.toString())
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Could not keep access to the selected document.")
    }
  }

  private fun resolveUri(invoke: Invoke, uri: String?) {
    val result = JSObject()
    result.put("uri", uri ?: JSONObject.NULL)
    invoke.resolve(result)
  }
}
