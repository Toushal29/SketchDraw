use serde::{Deserialize, Serialize};
use tauri::{plugin::{Builder, TauriPlugin}, Manager, State};

#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;

#[cfg(target_os = "android")]
pub(crate) struct AndroidStylusHandle {
    plugin: PluginHandle<tauri::Wry>,
}

#[cfg(not(target_os = "android"))]
pub(crate) struct AndroidStylusHandle;

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StylusPreviewConfig {
    pub enabled: bool,
    pub canvas_left: f32,
    pub canvas_top: f32,
    pub canvas_width: f32,
    pub canvas_height: f32,
    pub color: String,
    pub thickness: f32,
    pub opacity: f32,
    pub zoom: f32,
    pub brush_mode: String,
    pub pressure_enabled: bool,
    pub tilt_enabled: bool,
}

#[cfg(target_os = "android")]
#[derive(Deserialize)]
struct NativeEmptyResult {}

#[tauri::command]
pub(crate) async fn set_android_stylus_preview(
    config: StylusPreviewConfig,
    state: State<'_, AndroidStylusHandle>,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        state
            .plugin
            .run_mobile_plugin_async::<NativeEmptyResult>("setStylusPreviewConfig", config)
            .await
            .map_err(|error| error.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "android"))]
    {
        let _ = (config, state);
        Ok(())
    }
}

pub(crate) fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("android-stylus")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let plugin = api.register_android_plugin("com.toush.sketchdraw", "AndroidStylusPlugin")?;
                app.manage(AndroidStylusHandle { plugin });
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = api;
                app.manage(AndroidStylusHandle);
            }
            Ok(())
        })
        .build()
}
