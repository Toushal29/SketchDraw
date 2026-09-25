use std::sync::Mutex;
use tauri_plugin_fs::FsExt;

struct StartupFiles(Mutex<Vec<String>>);

#[tauri::command]
fn take_startup_files(files: tauri::State<'_, StartupFiles>) -> Vec<String> {
    files
        .0
        .lock()
        .map(|mut paths| std::mem::take(&mut *paths))
        .unwrap_or_default()
}

#[tauri::command]
fn authorize_sketch_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let candidate = std::path::PathBuf::from(path);
    let is_sketch = candidate
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("sketch"));
    if !is_sketch {
        return Err("Only .sketch documents can be opened from Recent sketches.".into());
    }

    let canonical = candidate
        .canonicalize()
        .map_err(|error| format!("Could not access the selected sketch: {error}"))?;
    if !canonical.is_file() {
        return Err("The selected sketch is not a file.".into());
    }

    app.fs_scope()
        .allow_file(&canonical)
        .map_err(|error| format!("Could not grant access to the selected sketch: {error}"))?;
    canonical
        .into_os_string()
        .into_string()
        .map_err(|_| "The selected sketch path is not valid Unicode.".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(StartupFiles(Mutex::new(
            std::env::args()
                .skip(1)
                .filter(|argument| argument.to_lowercase().ends_with(".sketch"))
                .collect(),
        )))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            take_startup_files,
            authorize_sketch_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
