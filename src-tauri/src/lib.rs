use std::io::Write;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

static SAVE_SEQUENCE: AtomicU64 = AtomicU64::new(0);
const CURRENT_SKETCH_FORMAT_VERSION: u64 = 10;
const SKETCH_EXTENSION: &str = "sketchdraw";

fn validate_sketch_document(contents: &str) -> Result<(), String> {
    let document: serde_json::Value = serde_json::from_str(contents).map_err(|e| e.to_string())?;
    if document.get("format").and_then(serde_json::Value::as_str) != Some("SketchDraw")
        || document.get("version").and_then(serde_json::Value::as_u64)
            != Some(CURRENT_SKETCH_FORMAT_VERSION)
    {
        return Err(format!("Only SketchDraw format v{CURRENT_SKETCH_FORMAT_VERSION} can be saved."));
    }
    let object = document.as_object().ok_or("The SketchDraw document root must be an object.")?;
    if ["sections", "project", "library", "retiredLibraryArchive"]
        .iter()
        .any(|field| object.contains_key(*field))
    {
        return Err("Only canvas data is supported in SketchDraw v10.".into());
    }
    Ok(())
}

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
        || !target.extension().is_some_and(|ext| ext.eq_ignore_ascii_case(SKETCH_EXTENSION))
        || !app.fs_scope().is_allowed(&target)
    {
        return Err("The selected .sketchdraw path is not authorized. Use Save As to select it.".into());
    }
    validate_sketch_document(&contents)?;
    let parent = target.parent().ok_or("The destination has no parent folder.")?;
    let sequence = SAVE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temporary = parent.join(format!(".sketchdraw-{}-{sequence}.tmp", std::process::id()));
    let mut created_temporary = false;
    let result = (|| -> Result<(), String> {
        let mut file = std::fs::OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|e| e.to_string())?;
        created_temporary = true;
        file.write_all(contents.as_bytes()).map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        if let Some(baseline) = expected {
            let current = std::fs::read_to_string(&target).map_err(|e| format!("Could not check the destination: {e}"))?;
            if current != baseline {
                return Err("CONFLICT: The sketch changed on disk. Reload it or save a separate copy.".into());
            }
        }
        std::fs::rename(&temporary, &target).map_err(|e| format!("Could not replace the sketch: {e}"))?;
        #[cfg(unix)]
        std::fs::File::open(parent).and_then(|directory| directory.sync_all()).map_err(|e| e.to_string())?;
        Ok(())
    })();
    if created_temporary { let _ = std::fs::remove_file(&temporary); }
    result
}

struct StartupFiles(Mutex<Vec<String>>);

#[tauri::command]
fn take_startup_files(files: tauri::State<'_, StartupFiles>) -> Vec<String> {
    files.0.lock().map(|mut paths| std::mem::take(&mut *paths)).unwrap_or_default()
}

#[tauri::command]
fn authorize_sketch_file(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let candidate = std::path::PathBuf::from(path);
    if !candidate.extension().is_some_and(|ext| ext.eq_ignore_ascii_case(SKETCH_EXTENSION)) {
        return Err("Only .sketchdraw canvas documents can be opened from Recent sketches.".into());
    }
    let canonical = candidate.canonicalize().map_err(|error| format!("Could not access the selected sketch: {error}"))?;
    if !canonical.is_file() { return Err("The selected sketch is not a file.".into()); }
    app.fs_scope().allow_file(&canonical).map_err(|error| format!("Could not grant access to the selected sketch: {error}"))?;
    canonical.into_os_string().into_string().map_err(|_| "The selected sketch path is not valid Unicode.".into())
}

#[tauri::command]
fn rename_sketch_file(app: tauri::AppHandle, path: String, file_name: String) -> Result<String, String> {
    let source = std::path::PathBuf::from(path);
    if !source.is_absolute()
        || !source.extension().is_some_and(|ext| ext.eq_ignore_ascii_case(SKETCH_EXTENSION))
        || !app.fs_scope().is_allowed(&source)
    {
        return Err("The selected .sketchdraw file is not authorized for renaming.".into());
    }
    let source = source.canonicalize().map_err(|error| format!("Could not access the selected sketch: {error}"))?;
    let mut name = file_name.trim().to_owned();
    if name.is_empty() || name.len() > 180 || name.chars().any(|character| character.is_control() || "<>:\"/\\|?*".contains(character)) {
        return Err("Enter a valid file name without path separators or reserved characters.".into());
    }
    name = name.trim_end_matches([' ', '.']).to_owned();
    if name.is_empty() || name == "." || name == ".." { return Err("Enter a valid file name.".into()); }
    let stem = if name.to_lowercase().ends_with(".sketchdraw") { &name[..name.len() - SKETCH_EXTENSION.len() - 1] } else { &name };
    if stem.is_empty() || ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"].iter().any(|reserved| stem.eq_ignore_ascii_case(reserved)) {
        return Err("That name is reserved by Windows. Choose another name.".into());
    }
    if !name.to_lowercase().ends_with(".sketchdraw") { name.push_str(".sketchdraw"); }
    let parent = source.parent().ok_or("The sketch has no parent folder.")?;
    let destination = parent.join(name);
    if destination == source { return source.into_os_string().into_string().map_err(|_| "The sketch path is not valid Unicode.".to_owned()); }
    if destination.exists() { return Err("A file with that name already exists in this folder.".into()); }
    app.fs_scope().allow_file(&destination).map_err(|error| format!("Could not authorize the renamed sketch: {error}"))?;
    std::fs::rename(&source, &destination).map_err(|error| format!("Could not rename the sketch: {error}"))?;
    destination.into_os_string().into_string().map_err(|_| "The renamed sketch path is not valid Unicode.".into())
}

fn is_recent_sketch_path(path: &str) -> bool {
    let candidate = std::path::PathBuf::from(path);
    path.len() <= 4096 && candidate.is_absolute()
        && candidate.extension().is_some_and(|ext| ext.eq_ignore_ascii_case(SKETCH_EXTENSION))
}

#[tauri::command]
fn load_recent_sketches(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = app.path().app_data_dir().map_err(|error| format!("Could not find app storage: {error}"))?.join("recent-sketches.json");
    let contents = match std::fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Could not read recent sketches: {error}")),
    };
    let paths: Vec<String> = serde_json::from_str(&contents).unwrap_or_default();
    let mut recent = Vec::new();
    for path in paths.into_iter().filter(|path| is_recent_sketch_path(path)) {
        let candidate = std::path::PathBuf::from(&path);
        if candidate.is_file() {
            let _ = app.fs_scope().allow_file(candidate);
            if !recent.contains(&path) { recent.push(path); }
        }
        if recent.len() == 8 { break; }
    }
    Ok(recent)
}

#[tauri::command]
fn save_recent_sketches(app: tauri::AppHandle, paths: Vec<String>) -> Result<(), String> {
    let directory = app.path().app_data_dir().map_err(|error| format!("Could not find app storage: {error}"))?;
    std::fs::create_dir_all(&directory).map_err(|error| format!("Could not create app storage: {error}"))?;
    let mut recent = Vec::new();
    for path in paths.into_iter().filter(|path| is_recent_sketch_path(path)) {
        if !recent.contains(&path) { recent.push(path); }
        if recent.len() == 8 { break; }
    }
    let contents = serde_json::to_vec(&recent).map_err(|error| error.to_string())?;
    std::fs::write(directory.join("recent-sketches.json"), contents).map_err(|error| format!("Could not save recent sketches: {error}"))
}

pub fn run() {
    tauri::Builder::default()
        .manage(StartupFiles(Mutex::new(std::env::args().skip(1).filter(|argument| argument.to_lowercase().ends_with(".sketchdraw")).collect())))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![take_startup_files, authorize_sketch_file, rename_sketch_file, atomic_save_sketch, load_recent_sketches, save_recent_sketches])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
