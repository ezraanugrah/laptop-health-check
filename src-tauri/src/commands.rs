//! Command Tauri yang diekspos ke frontend.
//!
//! Aturan: command hanya meneruskan ke `diagnostics`/`platform`. Pekerjaan yang
//! memblokir (menjalankan proses OS, membaca hardware) dijalankan di
//! `spawn_blocking` agar UI tidak membeku.

use crate::diagnostics::{
    self,
    types::{AppInfo, DiagnosticsReport, SystemOverview},
};
use crate::platform::{Current, Platform};

/// Log ringan khusus build debug untuk memverifikasi jalur IPC.
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
pub async fn get_system_overview() -> Result<SystemOverview, String> {
    trace("get_system_overview");
    tauri::async_runtime::spawn_blocking(Current::system_overview)
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_diagnostics() -> Result<DiagnosticsReport, String> {
    trace("run_diagnostics");
    tauri::async_runtime::spawn_blocking(diagnostics::run_all::<Current>)
        .await
        .map_err(|e| e.to_string())
}
