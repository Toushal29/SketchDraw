use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri_plugin_fs::FsExt;

static SAVE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

// Write next to the destination: rename must stay on the same filesystem.
// The dialog or authorize_sketch_file must grant access before this command runs.
#[tauri::command]
async fn atomic_save_sketch(
    app: tauri::AppHandle,
    path: String,
    contents: String,
    expected: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || save_sketch_atomic(app, path, contents, expected))
        .await
        .map_err(|error| format!("Save worker failed: {error}"))?
}

fn save_sketch_atomic(
    app: tauri::AppHandle,
    path: String,
    contents: String,
    expected: Option<String>,
) -> Result<(), String> {
    let target = std::path::PathBuf::from(&path);
    if !target.is_absolute()
        || !target
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("sketch"))
        || !app.fs_scope().is_allowed(&target)
    {
        return Err(
            "The selected .sketch path is not authorized. Use Save As to select it.".into(),
        );
    }
    let document: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
    if document["format"] != "SketchDraw" || document["version"] != 5 {
        return Err("Only SketchDraw format v5 can be saved.".into());
    }
    let parent = target
        .parent()
        .ok_or("The destination has no parent folder.")?;
    let sequence = SAVE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary = parent.join(format!(
        ".sketchdraw-{}-{}.tmp",
        std::process::id(),
        sequence
    ));
    let mut created_temporary = false;
    let result = (|| -> Result<(), String> {
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|e| e.to_string())?;
        created_temporary = true;
        file.write_all(contents.as_bytes())
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        // Check immediately before replacement, after the temporary file is flushed.
        if let Some(baseline) = expected {
            let current = std::fs::read_to_string(&target)
                .map_err(|e| format!("Could not check the destination: {e}"))?;
            if current != baseline {
                return Err(
                    "CONFLICT: The sketch changed on disk. Reload it or save a separate copy."
                        .into(),
                );
            }
        }
        // Rust uses replacement semantics on Windows (MoveFileExW) and rename on Unix.
        std::fs::rename(&temporary, &target)
            .map_err(|e| format!("Could not replace the sketch: {e}"))?;
        #[cfg(unix)]
        std::fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|e| e.to_string())?;
        Ok(())
    })();
    if created_temporary {
        let _ = std::fs::remove_file(&temporary);
    }
    result
}

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
            authorize_sketch_file,
            atomic_save_sketch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
