//! Laptop Health Check — backend Tauri.
//!
//! Lapisan:
//! - [`commands`]     : command Tauri (IPC) yang dipanggil frontend. Tipis, tanpa logika.
//! - [`diagnostics`]  : logika penilaian (data mentah -> `CheckResult`), tanpa API OS.
//! - [`platform`]     : pembacaan data mentah read-only dari macOS.
//! - [`media_gate`]   : kebijakan izin kamera/mikrofon WebView (tolak secara default).
//! - [`media_window`] : jendela tes media terpisah, satu per sesi.
//! - [`selfcheck`]    : mode verifikasi izin media (hanya lewat variabel lingkungan).
//! - [`settings`]     : preferensi tema/bahasa, disimpan lokal.

mod commands;
mod diagnostics;
mod media_gate;
mod media_window;
mod platform;
mod selfcheck;
mod settings;

use media_gate::{Decision, MediaGate, RequestKind};
use media_window::{MEDIA_WINDOW_LABEL, MediaWindow};
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(MediaGate::default())
        .manage(MediaWindow::default())
        // Semua permintaan izin WebView lewat sini. Jendela utama SELALU ditolak;
        // hanya jendela tes media yang dipertimbangkan gerbang (jenis + waktu).
        .on_permission_request(|webview, kind| {
            let kind = RequestKind::from_tauri(kind);
            let gate = webview.state::<MediaGate>();
            if !media_window::webview_may_use_media(webview.label(), kind) {
                eprintln!(
                    "[izin] permintaan dari jendela '{}' ditolak (bukan jendela tes media)",
                    webview.label()
                );
                return media_gate::to_response(Decision::Deny);
            }
            media_gate::to_response(gate.decide(kind))
        })
        // Muat ulang halaman = sesi tes berakhir; gerbang ditutup.
        .on_page_load(|webview, payload| {
            if payload.event() == PageLoadEvent::Started {
                webview.state::<MediaGate>().close("halaman mulai dimuat");
            }
        })
        // Jendela tes media hilang (selesai atau ditutup pengguna): gerbang ditutup
        // dan jendela utama diberi tahu bila sesi belum sempat melapor.
        .on_window_event(|window, event| {
            if window.label() == MEDIA_WINDOW_LABEL && matches!(event, WindowEvent::Destroyed) {
                commands::media_window_destroyed(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_app_info,
            commands::run_diagnostics,
            commands::get_serial_number,
            commands::get_device_profile,
            commands::set_window_fullscreen,
            commands::log_interactive_result,
            commands::media_gate_open,
            commands::media_gate_close,
            commands::media_gate_status,
            commands::open_media_window,
            commands::get_media_task,
            commands::focus_media_window,
            commands::finish_media_session,
            commands::cancel_media_window,
            commands::media_window_open,
            commands::get_settings,
            commands::save_settings,
            commands::get_launch_mode,
            commands::report_selfcheck,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
