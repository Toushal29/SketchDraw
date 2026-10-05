#[cfg(target_os = "android")]
use serde::Serialize;
#[cfg(target_os = "android")]
use tauri::plugin::PluginHandle;
use tauri::{plugin::{Builder, TauriPlugin}, Manager, State};

#[cfg(target_os = "android")]
pub struct OrientationHandle(PluginHandle<tauri::Wry>);
#[cfg(not(target_os = "android"))]
pub struct OrientationHandle;

#[cfg(target_os = "android")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OrientationArgs {
    orientation: String,
}

#[tauri::command]
pub async fn set_mobile_orientation(
    orientation: String,
    handle: State<'_, OrientationHandle>,
) -> Result<(), String> {
    if orientation != "landscape" && orientation != "portrait" {
        return Err("Choose portrait or landscape orientation.".into());
    }

    #[cfg(target_os = "android")]
    {
        handle
            .0
            .run_mobile_plugin_async::<()>("setOrientation", OrientationArgs { orientation })
            .await
            .map_err(|error| error.to_string())
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (orientation, handle);
        Err("Native orientation control is only available on Android.".into())
    }
}

pub fn init() -> TauriPlugin<tauri::Wry> {
    Builder::new("orientation")
        .setup(|app, api| {
            #[cfg(target_os = "android")]
            {
                let handle = api.register_android_plugin("com.toush.sketchdraw", "OrientationPlugin")?;
                app.manage(OrientationHandle(handle));
            }
            #[cfg(not(target_os = "android"))]
            {
                let _ = api;
                app.manage(OrientationHandle);
            }
            Ok(())
        })
        .build()
}
