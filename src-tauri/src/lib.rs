use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

static SAVE_SEQUENCE: AtomicU64 = AtomicU64::new(0);
const CURRENT_SKETCH_FORMAT_VERSION: u64 = 7;

fn validate_sketch_document(contents: &str) -> Result<(), String> {
    let document: serde_json::Value = serde_json::from_str(contents).map_err(|e| e.to_string())?;
    if document.get("format").and_then(serde_json::Value::as_str) != Some("SketchDraw")
        || document
            .get("version")
            .and_then(serde_json::Value::as_u64)
            != Some(CURRENT_SKETCH_FORMAT_VERSION)
    {
        return Err(format!(
            "Only SketchDraw format v{CURRENT_SKETCH_FORMAT_VERSION} can be saved."
        ));
    }
    Ok(())
}

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
    validate_sketch_document(&contents)?;
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

fn is_recent_sketch_path(path: &str) -> bool {
    if path.len() > 4096 || !path.to_lowercase().ends_with(".sketch") {
        return false;
    }
    if path.starts_with("content://") {
        return true;
    }
    let candidate = std::path::PathBuf::from(path);
    candidate.is_absolute()
        && candidate
            .extension()
            .is_some_and(|extension| extension.eq_ignore_ascii_case("sketch"))
}

#[tauri::command]
fn load_recent_sketches(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not find app storage: {error}"))?
        .join("recent-sketches.json");
    let contents = match std::fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Could not read recent sketches: {error}")),
    };
    let paths: Vec<String> = serde_json::from_str(&contents).unwrap_or_default();
    let mut recent = Vec::new();
    for path in paths.into_iter().filter(|path| is_recent_sketch_path(path)) {
        if !recent.contains(&path) {
            recent.push(path);
        }
        if recent.len() == 8 {
            break;
        }
    }
    Ok(recent)
}

#[tauri::command]
fn save_recent_sketches(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("Could not find app storage: {error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create app storage: {error}"))?;
    let mut recent = Vec::new();
    for path in paths.into_iter().filter(|path| is_recent_sketch_path(path)) {
        if !recent.contains(&path) {
            recent.push(path);
        }
        if recent.len() == 8 {
            break;
        }
    }
    let contents = serde_json::to_vec(&recent).map_err(|error| error.to_string())?;
    std::fs::write(directory.join("recent-sketches.json"), contents)
        .map_err(|error| format!("Could not save recent sketches: {error}"))
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
            atomic_save_sketch,
            load_recent_sketches,
            save_recent_sketches
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::validate_sketch_document;

    #[test]
    fn accepts_current_sketch_format() {
        assert!(validate_sketch_document(r#"{"format":"SketchDraw","version":7}"#).is_ok());
    }

    #[test]
    fn rejects_older_sketch_format_with_current_version_hint() {
        let error = validate_sketch_document(r#"{"format":"SketchDraw","version":6}"#)
            .unwrap_err();
        assert_eq!(error, "Only SketchDraw format v7 can be saved.");
    }
}
