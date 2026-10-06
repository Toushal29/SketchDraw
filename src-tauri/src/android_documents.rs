use serde::Serialize;
use tauri::{plugin::{Builder, TauriPlugin}, Manager, State};

#[cfg(target_os = "android")]
use serde::Deserialize;
#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

pub(crate) struct AndroidDocumentsHandle {
    #[cfg(target_os = "android")]
    plugin: PluginHandle<tauri::Wry>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateDocumentArgs {
    file_name: String,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct NativeDocumentResult {
    uri: Option<String>,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct NativeAllFilesAccessResult {
    available: bool,
    granted: bool,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct NativeEmptyResult {}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AllFilesAccessStatus {
    pub available: bool,
    pub granted: bool,
}

async fn run_picker(
    state: State<'_, AndroidDocumentsHandle>,
    command: &str,
    args: impl Serialize,
) -> Result<Option<String>, String> {
    #[cfg(target_os = "android")]
    {
        let result = state
            .plugin
            .run_mobile_plugin_async::<NativeDocumentResult>(command, args)
            .await
            .map_err(|error| error.to_string())?;
        Ok(result.uri)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (state, command, args);
        Err("Android document picker is only available on Android.".into())
    }
}

#[tauri::command]
pub(crate) async fn pick_sketch_document(
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<Option<String>, String> {
    run_picker(state, "pickSketchDocument", ()).await
}

#[tauri::command]
pub(crate) async fn create_sketch_document(
    file_name: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<Option<String>, String> {
    run_picker(state, "createSketchDocument", CreateDocumentArgs { file_name }).await
}

#[tauri::command]
pub(crate) async fn has_all_files_access(
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<AllFilesAccessStatus, String> {
    #[cfg(target_os = "android")]
    {
        let result = state.plugin
            .run_mobile_plugin_async::<NativeAllFilesAccessResult>("hasAllFilesAccess", ())
            .await
            .map_err(|error| error.to_string())?;
        Ok(AllFilesAccessStatus { available: result.available, granted: result.granted })
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = state;
        Ok(AllFilesAccessStatus { available: false, granted: false })
    }
}

#[tauri::command]
pub(crate) async fn open_all_files_access_settings(
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        state.plugin
            .run_mobile_plugin_async::<NativeEmptyResult>("openAllFilesAccessSettings", ())
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = state;
        Err("All files access settings are only available on Android 11 and later.".into())
    }
}

pub(crate) fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("android-documents")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let plugin = api.register_android_plugin(
                    "com.toush.sketchdraw",
                    "AndroidDocumentsPlugin",
                )?;
                app.manage(AndroidDocumentsHandle { plugin });
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = api;
                app.manage(AndroidDocumentsHandle {});
            }
            Ok(())
        })
        .build()
}
