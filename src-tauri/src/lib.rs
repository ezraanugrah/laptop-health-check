//! Laptop Health Check — backend Tauri.
//!
//! Lapisan:
//! - [`commands`]    : command Tauri (IPC) yang dipanggil frontend. Tipis, tanpa logika.
//! - [`diagnostics`] : logika penilaian lintas platform (data mentah -> `CheckResult`).
//! - [`platform`]    : pembacaan data mentah spesifik OS (macOS, Windows).

mod commands;
mod diagnostics;
mod platform;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::run_diagnostics,
            commands::get_serial_number,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
