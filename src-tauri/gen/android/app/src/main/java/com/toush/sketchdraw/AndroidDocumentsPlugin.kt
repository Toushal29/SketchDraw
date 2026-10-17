package com.toush.sketchdraw

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Process
import android.provider.DocumentsContract
import android.provider.OpenableColumns
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

@InvokeArg
internal class SketchDocumentPermissionArgs {
  var uri: String? = null
}

@InvokeArg
internal class WriteSketchDocumentArgs {
  var uri: String? = null
  var contents: String? = null
}

@TauriPlugin
class AndroidDocumentsPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun getSketchDocumentDisplayName(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(SketchDocumentPermissionArgs::class.java)
      val uri = Uri.parse(args.uri ?: throw IllegalArgumentException("The sketch path is missing."))
      if (uri.scheme != "content") throw IllegalArgumentException("The selected document URI is invalid.")
      val name = activity.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) cursor.getString(cursor.getColumnIndexOrThrow(OpenableColumns.DISPLAY_NAME)) else null
      }?.takeIf { it.isNotBlank() } ?: throw IllegalStateException("The document provider did not return a file name.")
      val result = JSObject()
      result.put("name", name)
      invoke.resolve(result)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Could not read the selected document's file name.")
    }
  }

  @Command
  fun hasSketchDocumentWriteAccess(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(SketchDocumentPermissionArgs::class.java)
      val uri = Uri.parse(args.uri ?: throw IllegalArgumentException("The sketch path is missing."))
      val writable = uri.scheme == "content" && activity.checkUriPermission(
        uri,
        Process.myPid(),
        Process.myUid(),
        Intent.FLAG_GRANT_WRITE_URI_PERMISSION,
      ) == PackageManager.PERMISSION_GRANTED
      val result = JSObject()
      result.put("writable", writable)
      invoke.resolve(result)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Could not check write access to this sketch.")
    }
  }

  @Command
  fun writeSketchDocument(invoke: Invoke) {
    try {
      val args = invoke.parseArgs(WriteSketchDocumentArgs::class.java)
      val uri = Uri.parse(args.uri ?: throw IllegalArgumentException("The sketch path is missing."))
      val contents = args.contents ?: throw IllegalArgumentException("The sketch content is missing.")
      if (uri.scheme != "content") throw IllegalArgumentException("The selected document URI is invalid.")
      activity.contentResolver.openOutputStream(uri, "wt")?.use { stream ->
        stream.write(contents.toByteArray(Charsets.UTF_8))
        stream.flush()
      } ?: throw IllegalStateException("The document provider could not open this sketch for writing.")
      invoke.resolve()
    } catch (error: Exception) {
      invoke.reject(error.message ?: "Could not save the selected sketch.")
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
  fun createLegacyLibraryArchive(invoke: Invoke) {
    val args = invoke.parseArgs(CreateSketchDocumentArgs::class.java)
    val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "application/json"
      putExtra(Intent.EXTRA_TITLE, args.fileName ?: "SketchDraw-Library-Archive.json")
      addFlags(
        Intent.FLAG_GRANT_READ_URI_PERMISSION or
          Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
          Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
      )
    }
    startActivityForResult(invoke, intent, "createLegacyLibraryArchiveResult")
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

  @ActivityCallback
  fun createLegacyLibraryArchiveResult(invoke: Invoke, result: ActivityResult) {
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
