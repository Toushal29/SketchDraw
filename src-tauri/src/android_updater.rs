use serde::{Deserialize, Serialize};
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, State,
};

#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

pub(crate) struct AndroidUpdaterHandle {
    #[cfg(target_os = "android")]
    plugin: PluginHandle<tauri::Wry>,
}

#[cfg(target_os = "android")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallReleaseApkArgs {
    download_url: String,
}

#[derive(Deserialize, Serialize)]
pub(crate) struct AndroidInstallResult {
    status: String,
}

#[tauri::command]
pub(crate) async fn install_android_release_apk(
    download_url: String,
    state: State<'_, AndroidUpdaterHandle>,
) -> Result<AndroidInstallResult, String> {
    #[cfg(target_os = "android")]
    {
        state
            .plugin
            .run_mobile_plugin_async::<AndroidInstallResult>(
                "installReleaseApk",
                InstallReleaseApkArgs { download_url },
            )
            .await
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (download_url, state);
        Err("In-app APK installation is only available on Android.".into())
    }
}

pub(crate) fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("android-updater")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let plugin =
                    api.register_android_plugin("com.toush.sketchdraw", "AndroidUpdaterPlugin")?;
                app.manage(AndroidUpdaterHandle { plugin });
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = api;
                app.manage(AndroidUpdaterHandle {});
            }
            Ok(())
        })
        .build()
}
