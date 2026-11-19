//! Ekspor laporan pemeriksaan.
//!
//! - JSON: pengguna memilih lokasi lewat dialog Simpan macOS (`NSSavePanel`); aplikasi
//!   tidak pernah menulis ke lokasi yang tidak dipilih pengguna dan tidak menerima path
//!   dari frontend.
//! - PDF: dialog cetak macOS untuk webview utama (pengguna memilih "Simpan sebagai PDF").
//!
//! Isi laporan dibuat frontend dalam bahasa aktif; nomor seri hanya ikut bila pengguna
//! memilihnya saat ekspor. Path file tidak dicatat di log (bisa memuat nama pengguna).

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::media_window::MAIN_WINDOW_LABEL;

/// Batas ukuran laporan JSON (laporan normal < 100 KB).
pub const MAX_REPORT_BYTES: usize = 5 * 1024 * 1024;
const FALLBACK_FILE_NAME: &str = "laporan-laptop-health-check.json";
const MAX_FILE_NAME_CHARS: usize = 100;

/// Isi harus objek JSON yang valid dan tidak terlalu besar.
pub fn validate_json(contents: &str) -> Result<(), String> {
    if contents.len() > MAX_REPORT_BYTES {
        return Err(format!(
            "Laporan terlalu besar ({} byte, maksimal {}).",
            contents.len(),
            MAX_REPORT_BYTES
        ));
    }
    match serde_json::from_str::<serde_json::Value>(contents) {
        Ok(serde_json::Value::Object(_)) => Ok(()),
        Ok(_) => Err("Laporan harus berupa objek JSON.".into()),
        Err(e) => Err(format!("Laporan bukan JSON yang valid: {e}")),
    }
}

/// Nama file usulan yang aman: hanya huruf/angka/`-`/`_`/`.`, berakhiran `.json`.
pub fn sanitize_file_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        .take(MAX_FILE_NAME_CHARS)
        .collect();
    let cleaned = cleaned.trim_matches('.').to_string();
    if cleaned.is_empty() {
        return FALLBACK_FILE_NAME.to_string();
    }
    if cleaned.to_ascii_lowercase().ends_with(".json") {
        cleaned
    } else {
        format!("{cleaned}.json")
    }
}

/// Tulis atomik: file sementara di folder yang sama lalu `rename`.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> io::Result<()> {
    let file_name = path
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "path tanpa nama file"))?;
    let tmp = path.with_file_name(format!(".{}.lhc-tmp", file_name.to_string_lossy()));
    fs::write(&tmp, bytes)?;
    fs::rename(&tmp, path).inspect_err(|_| {
        let _ = fs::remove_file(&tmp);
    })
}

fn ensure_main(label: &str) -> Result<(), String> {
    if label == MAIN_WINDOW_LABEL {
        Ok(())
    } else {
        Err("Ekspor laporan hanya dari jendela utama.".into())
    }
}

/// Simpan laporan JSON ke lokasi pilihan pengguna. `Ok(None)` = pengguna membatalkan.
#[tauri::command]
pub async fn export_report_json(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    contents: String,
    file_name: String,
) -> Result<Option<String>, String> {
    ensure_main(webview.label())?;
    validate_json(&contents)?;
    let name = sanitize_file_name(&file_name);
    let Some(path) = choose_save_path(&app, name).await? else {
        eprintln!("[laporan] ekspor JSON dibatalkan pengguna");
        return Ok(None);
    };
    let bytes = contents.len();
    let saved = tauri::async_runtime::spawn_blocking(move || {
        write_atomic(&path, contents.as_bytes()).map(|_| path)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("Gagal menyimpan laporan: {e}"))?;
    eprintln!("[laporan] JSON disimpan ({bytes} byte) di lokasi pilihan pengguna");
    Ok(Some(saved.to_string_lossy().into_owned()))
}

/// Buka dialog cetak macOS untuk webview utama (Simpan sebagai PDF).
#[tauri::command]
pub fn print_report(webview: tauri::Webview) -> Result<(), String> {
    ensure_main(webview.label())?;
    eprintln!("[laporan] dialog cetak/PDF dibuka");
    webview.print().map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
async fn choose_save_path(app: &tauri::AppHandle, name: String) -> Result<Option<PathBuf>, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    // AppKit hanya boleh dipakai di main thread.
    app.run_on_main_thread(move || {
        let _ = tx.send(save_panel(&name));
    })
    .map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || rx.recv().map_err(|e| e.to_string()))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(target_os = "macos")]
fn save_panel(name: &str) -> Option<PathBuf> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSModalResponseOK, NSSavePanel};
    use objc2_foundation::NSString;

    let mtm = MainThreadMarker::new()?;
    let panel = NSSavePanel::savePanel(mtm);
    panel.setNameFieldStringValue(&NSString::from_str(name));
    panel.setCanCreateDirectories(true);
    if panel.runModal() != NSModalResponseOK {
        return None;
    }
    let path = panel.URL()?.path()?;
    Some(PathBuf::from(path.to_string()))
}

#[cfg(not(target_os = "macos"))]
async fn choose_save_path(
    _app: &tauri::AppHandle,
    _name: String,
) -> Result<Option<PathBuf>, String> {
    Err("Ekspor laporan hanya didukung di macOS.".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_report_json() {
        assert!(validate_json(r#"{"schemaVersion":1}"#).is_ok());
        assert!(validate_json("[1,2]").is_err(), "harus objek");
        assert!(validate_json("bukan json").is_err());
        let big = format!(r#"{{"x":"{}"}}"#, "a".repeat(MAX_REPORT_BYTES));
        assert!(validate_json(&big).is_err(), "terlalu besar");
    }

    #[test]
    fn sanitizes_suggested_file_name() {
        assert_eq!(
            sanitize_file_name("LaptopHealthCheck-Laporan-2026-11-19.json"),
            "LaptopHealthCheck-Laporan-2026-11-19.json"
        );
        assert_eq!(sanitize_file_name("../../etc/passwd"), "etcpasswd.json");
        assert_eq!(sanitize_file_name("laporan saya"), "laporansaya.json");
        assert_eq!(sanitize_file_name("REPORT.JSON"), "REPORT.JSON");
        assert_eq!(sanitize_file_name("///"), FALLBACK_FILE_NAME);
        assert_eq!(sanitize_file_name(""), FALLBACK_FILE_NAME);
        assert!(sanitize_file_name(&"a".repeat(500)).len() <= MAX_FILE_NAME_CHARS + 5);
    }

    #[test]
    fn writes_atomically_without_leftover_temp_file() {
        let dir = std::env::temp_dir().join(format!("lhc-report-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("laporan.json");
        write_atomic(&path, br#"{"a":1}"#).unwrap();
        write_atomic(&path, br#"{"a":2}"#).unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), r#"{"a":2}"#);
        let leftovers = fs::read_dir(&dir)
            .unwrap()
            .filter(|e| {
                e.as_ref()
                    .unwrap()
                    .file_name()
                    .to_string_lossy()
                    .contains("lhc-tmp")
            })
            .count();
        assert_eq!(leftovers, 0);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn only_main_window_may_export() {
        assert!(ensure_main(MAIN_WINDOW_LABEL).is_ok());
        assert!(ensure_main("media-test").is_err());
    }
}
