package com.toush.sketchdraw

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

@InvokeArg
internal class InstallReleaseApkArgs {
  var downloadUrl: String? = null
}

@TauriPlugin
class AndroidUpdaterPlugin(private val activity: Activity) : Plugin(activity) {
  private val installInProgress = AtomicBoolean(false)

  @Command
  fun installReleaseApk(invoke: Invoke) {
    val args = try {
      invoke.parseArgs(InstallReleaseApkArgs::class.java)
    } catch (error: Exception) {
      invoke.reject(error.message ?: "The Android update request is invalid.")
      return
    }
    val downloadUrl = args.downloadUrl?.trim().orEmpty()
    if (!isSketchDrawReleaseUrl(downloadUrl)) {
      invoke.reject("The update link is not a SketchDraw Android release APK.")
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !activity.packageManager.canRequestPackageInstalls()) {
      try {
        val settingsIntent = Intent(
          Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
          Uri.parse("package:${activity.packageName}"),
        )
        activity.startActivity(settingsIntent)
        resolveStatus(invoke, "permission_required")
      } catch (error: Exception) {
        invoke.reject(error.message ?: "Could not open Android's install-permission settings.")
      }
      return
    }

    if (!installInProgress.compareAndSet(false, true)) {
      invoke.reject("An Android update is already being prepared.")
      return
    }

    Thread({
      var downloadedApk: File? = null
      try {
        downloadedApk = downloadReleaseApk(downloadUrl)
        verifyUpdatePackage(downloadedApk)
        val apkUri = FileProvider.getUriForFile(
          activity,
          "${activity.packageName}.fileprovider",
          downloadedApk,
        )
        @Suppress("DEPRECATION")
        val installIntent = Intent(Intent.ACTION_INSTALL_PACKAGE).apply {
          setDataAndType(apkUri, "application/vnd.android.package-archive")
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        activity.runOnUiThread {
          try {
            if (activity.isFinishing || activity.isDestroyed) throw IllegalStateException("SketchDraw closed before Android could open the installer.")
            activity.startActivity(installIntent)
            resolveStatus(invoke, "installer_opened")
          } catch (error: Exception) {
            invoke.reject(error.message ?: "Android could not open the package installer.")
          } finally {
            installInProgress.set(false)
          }
        }
      } catch (error: Exception) {
        downloadedApk?.delete()
        activity.runOnUiThread {
          invoke.reject(error.message ?: "Could not prepare the Android update.")
          installInProgress.set(false)
        }
      }
    }, "sketchdraw-apk-update").start()
  }

  private fun isSketchDrawReleaseUrl(value: String): Boolean {
    return try {
      val uri = Uri.parse(value)
      uri.scheme == "https" &&
        uri.host == "github.com" &&
        uri.path.orEmpty().startsWith("/Toushal29/SketchDraw/releases/download/") &&
        uri.path.orEmpty().endsWith(".apk", ignoreCase = true)
    } catch (_: Exception) {
      false
    }
  }

  private fun downloadReleaseApk(downloadUrl: String): File {
    val partialFile = File(activity.cacheDir, "sketchdraw-release-update.apk.part")
    val apkFile = File(activity.cacheDir, "sketchdraw-release-update.apk")
    partialFile.delete()
    apkFile.delete()

    val connection = URL(downloadUrl).openConnection() as? HttpURLConnection
      ?: throw IllegalStateException("GitHub did not provide a downloadable APK.")
    try {
      connection.connectTimeout = 20_000
      connection.readTimeout = 60_000
      connection.instanceFollowRedirects = true
      connection.setRequestProperty("Accept", "application/octet-stream")
      connection.setRequestProperty("User-Agent", "SketchDraw-Android-Updater")
      connection.connect()

      val finalUri = Uri.parse(connection.url.toString())
      val allowedRedirectHosts = setOf("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com")
      if (finalUri.scheme != "https" || finalUri.host !in allowedRedirectHosts) {
        throw SecurityException("The GitHub APK download redirected to an unexpected host.")
      }
      if (connection.responseCode !in 200..299) {
        throw IllegalStateException("GitHub could not download the APK (HTTP ${connection.responseCode}).")
      }

      val maximumBytes = 300L * 1024 * 1024
      if (connection.contentLengthLong > maximumBytes) throw IllegalStateException("The Android update is larger than expected.")
      var bytesWritten = 0L
      connection.inputStream.use { input ->
        partialFile.outputStream().use { output ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            bytesWritten += count
            if (bytesWritten > maximumBytes) throw IllegalStateException("The Android update is larger than expected.")
            output.write(buffer, 0, count)
          }
        }
      }
      if (bytesWritten == 0L || !partialFile.renameTo(apkFile)) {
        throw IllegalStateException("The Android update download was incomplete.")
      }
      return apkFile
    } catch (error: Exception) {
      partialFile.delete()
      apkFile.delete()
      throw error
    } finally {
      connection.disconnect()
    }
  }

  @Suppress("DEPRECATION")
  private fun verifyUpdatePackage(apkFile: File) {
    val packageManager = activity.packageManager
    val signingFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      PackageManager.GET_SIGNING_CERTIFICATES
    } else {
      @Suppress("DEPRECATION")
      PackageManager.GET_SIGNATURES
    }
    val installed = packageManager.getPackageInfo(activity.packageName, signingFlag)
    val update = packageManager.getPackageArchiveInfo(apkFile.absolutePath, signingFlag)
      ?: throw IllegalStateException("Android could not read the downloaded APK.")
    if (update.packageName != activity.packageName) {
      throw SecurityException("The downloaded APK is for a different Android app.")
    }

    val installedVersion = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) installed.longVersionCode else installed.versionCode.toLong()
    val updateVersion = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) update.longVersionCode else update.versionCode.toLong()
    if (updateVersion <= installedVersion) {
      throw IllegalStateException("This APK is not newer than the installed version. Android version codes must increase for every release.")
    }

    val installedSigners = activeSigners(installed)
    val updateSignerHistory = signerHistory(update)
    if (installedSigners.isEmpty() || updateSignerHistory.isEmpty() || !updateSignerHistory.containsAll(installedSigners)) {
      throw SecurityException("This APK was not signed with the installed SketchDraw release key.")
    }
  }

  @Suppress("DEPRECATION")
  private fun activeSigners(packageInfo: PackageInfo): Set<String> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      packageInfo.signingInfo?.apkContentsSigners?.map { it.toCharsString() }?.toSet().orEmpty()
    } else {
      packageInfo.signatures?.map { it.toCharsString() }?.toSet().orEmpty()
    }
  }

  @Suppress("DEPRECATION")
  private fun signerHistory(packageInfo: PackageInfo): Set<String> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      packageInfo.signingInfo?.signingCertificateHistory?.map { it.toCharsString() }?.toSet().orEmpty()
    } else {
      packageInfo.signatures?.map { it.toCharsString() }?.toSet().orEmpty()
    }
  }

  private fun resolveStatus(invoke: Invoke, status: String) {
    val result = JSObject()
    result.put("status", status)
    invoke.resolve(result)
  }
}
