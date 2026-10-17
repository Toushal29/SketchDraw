use serde::Serialize;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, State,
};
#[cfg(target_os = "android")]
use tauri_plugin_fs::FsExt;

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
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WriteDocumentArgs {
    uri: String,
    contents: String,
}

#[cfg(target_os = "android")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RenameDocumentArgs {
    uri: String,
    file_name: String,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct NativeDocumentResult {
    uri: Option<String>,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct NativeDisplayNameResult {
    name: String,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct NativeSketchDocumentWriteAccess {
    writable: bool,
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
    run_picker(
        state,
        "createSketchDocument",
        CreateDocumentArgs { file_name },
    )
    .await
}

#[tauri::command]
pub(crate) async fn pick_planning_document(
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<Option<String>, String> {
    run_picker(state, "pickPlanningDocument", ()).await
}

#[tauri::command]
pub(crate) async fn create_planning_document(
    file_name: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<Option<String>, String> {
    run_picker(state, "createPlanningDocument", CreateDocumentArgs { file_name }).await
}

#[tauri::command]
pub(crate) async fn create_planning_export(
    file_name: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<Option<String>, String> {
    run_picker(state, "createPlanningExport", CreateDocumentArgs { file_name }).await
}

#[tauri::command]
pub(crate) async fn create_text_export(
    file_name: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<Option<String>, String> {
    run_picker(state, "createTextExport", CreateDocumentArgs { file_name }).await
}

#[tauri::command]
pub(crate) async fn create_legacy_library_archive(
    file_name: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<Option<String>, String> {
    run_picker(
        state,
        "createLegacyLibraryArchive",
        CreateDocumentArgs { file_name },
    )
    .await
}

#[tauri::command]
pub(crate) async fn write_sketch_document(
    uri: String,
    contents: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        state
            .plugin
            .run_mobile_plugin_async::<serde_json::Value>(
                "writeSketchDocument",
                WriteDocumentArgs { uri, contents },
            )
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (uri, contents, state);
        Err("Selected-document writes are only available on Android.".into())
    }
}

#[tauri::command]
pub(crate) async fn rename_sketch_document(
    app: tauri::AppHandle,
    uri: String,
    file_name: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let result = state
            .plugin
            .run_mobile_plugin_async::<NativeDocumentResult>(
                "renameSketchDocument",
                RenameDocumentArgs { uri, file_name },
            )
            .await
            .map_err(|error| error.to_string())?;
        let path = result
            .uri
            .ok_or_else(|| "Android did not return the renamed sketch path.".to_owned())?;
        app.fs_scope()
            .allow_file(std::path::PathBuf::from(&path))
            .map_err(|error| format!("Could not authorize the renamed sketch: {error}"))?;
        Ok(path)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, uri, file_name, state);
        Err("Document-provider rename is only available on Android.".into())
    }
}

#[tauri::command]
pub(crate) async fn has_sketch_document_write_access(
    uri: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<bool, String> {
    #[cfg(target_os = "android")]
    {
        let result = state
            .plugin
            .run_mobile_plugin_async::<NativeSketchDocumentWriteAccess>(
                "hasSketchDocumentWriteAccess",
                serde_json::json!({ "uri": uri }),
            )
            .await
            .map_err(|error| error.to_string())?;
        Ok(result.writable)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (uri, state);
        Err("Document-provider permissions are only available on Android.".into())
    }
}

#[tauri::command]
pub(crate) async fn get_sketch_document_display_name(
    uri: String,
    state: State<'_, AndroidDocumentsHandle>,
) -> Result<String, String> {
    #[cfg(target_os = "android")]
    {
        let result = state
            .plugin
            .run_mobile_plugin_async::<NativeDisplayNameResult>(
                "getSketchDocumentDisplayName",
                serde_json::json!({ "uri": uri }),
            )
            .await
            .map_err(|error| error.to_string())?;
        Ok(result.name)
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (uri, state);
        Err("Document display names are only available on Android.".into())
    }
}

pub(crate) fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("android-documents")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let plugin =
                    api.register_android_plugin("com.toush.sketchdraw", "AndroidDocumentsPlugin")?;
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
