//! Command Tauri yang diekspos ke frontend.
//!
//! Aturan: command hanya meneruskan ke `diagnostics`/`platform`. Pekerjaan yang
//! memblokir (menjalankan proses OS, membaca hardware) dijalankan di
//! `spawn_blocking` agar UI tidak membeku.

use crate::diagnostics::{
    self,
    types::{AppInfo, DiagnosticsReport},
};
use crate::platform::{Current, Platform};

/// Log ringan khusus build debug untuk memverifikasi jalur IPC.
/// Hanya nama command yang dicatat — tidak pernah datanya.
fn trace(_command: &str) {
    #[cfg(debug_assertions)]
    eprintln!("[ipc] {_command}");
}

#[tauri::command]
pub fn get_app_info(app: tauri::AppHandle) -> AppInfo {
    trace("get_app_info");
    let info = app.package_info();
    AppInfo {
        name: info.name.clone(),
        version: info.version.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[tauri::command]
pub async fn run_diagnostics() -> Result<DiagnosticsReport, String> {
    trace("run_diagnostics");
    let report = tauri::async_runtime::spawn_blocking(diagnostics::run_all::<Current>)
        .await
        .map_err(|e| e.to_string())?;
    #[cfg(debug_assertions)]
    eprintln!(
        "[ipc] run_diagnostics selesai dalam {} ms: {}",
        report.duration_ms,
        report
            .checks
            .iter()
            .map(|c| format!("{:?}={:?}", c.id, c.status))
            .collect::<Vec<_>>()
            .join(", ")
    );
    Ok(report)
}

/// Nomor seri hanya dibaca saat pengguna memilih "Tampilkan" (privasi).
/// Nilainya tidak disimpan di backend dan tidak dicatat di log.
#[tauri::command]
pub async fn get_serial_number() -> Result<Option<String>, String> {
    trace("get_serial_number");
    tauri::async_runtime::spawn_blocking(Current::serial_number)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}
