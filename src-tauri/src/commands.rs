//! Command Tauri yang diekspos ke frontend.
//!
//! Aturan: command hanya meneruskan ke `diagnostics`/`platform`. Pekerjaan yang
//! memblokir (menjalankan proses OS, membaca hardware) dijalankan di
//! `spawn_blocking` agar UI tidak membeku.

use crate::diagnostics::{
    self,
    device_profile::{self, DeviceProfile},
    types::{AppInfo, DiagnosticsReport},
};
use crate::media_gate::{GateStatus, MediaGate};
use crate::media_window::{
    self, MAIN_WINDOW_LABEL, MEDIA_WINDOW_LABEL, MediaKind, MediaPurpose, MediaTask, MediaWindow,
    SESSION_FINISHED_EVENT, SessionFinished,
};
use crate::platform::{Current, Platform};
use crate::selfcheck::{self, LaunchMode};
use crate::settings::{self, Settings};
use tauri::{Emitter, Manager};

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
        support: Current::support(),
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
        "[ipc] run_diagnostics selesai dalam {} ms: hardware={:?} ({}/{} terukur) | {}",
        report.duration_ms,
        report.hardware.status,
        report.hardware.measured,
        report.hardware.total,
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

/// Profil perangkat untuk tes interaktif (model + Touch Bar).
#[tauri::command]
pub async fn get_device_profile() -> Result<DeviceProfile, String> {
    trace("get_device_profile");
    let overview = tauri::async_runtime::spawn_blocking(Current::system_overview)
        .await
        .map_err(|e| e.to_string())?;
    Ok(device_profile::profile(overview.ok().and_then(|o| o.model)))
}

/// Layar penuh untuk Tes Layar. Hanya jendela aplikasi ini yang berubah;
/// tidak ada pengaturan tampilan sistem yang disentuh.
#[tauri::command]
pub fn set_window_fullscreen(window: tauri::Window, enabled: bool) -> Result<(), String> {
    let result = window
        .set_simple_fullscreen(enabled)
        .map_err(|e| e.to_string());
    // Fokus keyboard tetap di jendela ini agar Esc/Spasi/panah diterima setelah
    // berpindah mode layar (temuan uji native: jalur Esc belum terbukti).
    let focused = window.set_focus().is_ok();
    eprintln!(
        "[tes] layar penuh {} jendela '{}': {} (fokus {})",
        if enabled { "ON" } else { "OFF" },
        window.label(),
        if result.is_ok() { "berhasil" } else { "gagal" },
        if focused { "ok" } else { "gagal" }
    );
    result
}

/// Ringkasan hasil Tes Interaktif ke stderr untuk verifikasi di Mac asli.
/// Hanya id, status, ringkasan, dan teks bukti (mis. label tombol yang tidak
/// merespons) — tidak pernah teks yang diketik atau data perangkat.
#[tauri::command]
pub fn log_interactive_result(id: String, outcome: String, summary: String, evidence: Vec<String>) {
    eprintln!("[tes] {id}: {outcome} — {summary}");
    for line in evidence {
        eprintln!("[tes]   · {line}");
    }
}

/// Membuka gerbang izin media. Hanya dari jendela tes media, hanya untuk tugas
/// `Session`, dan hanya untuk jenis yang ditugaskan (lihat `media_window`).
#[tauri::command]
pub fn media_gate_open(
    webview: tauri::Webview,
    gate: tauri::State<'_, MediaGate>,
    window: tauri::State<'_, MediaWindow>,
    camera: bool,
    microphone: bool,
) -> Result<GateStatus, String> {
    if let Err(reason) =
        media_window::may_open_gate(webview.label(), window.task().as_ref(), camera, microphone)
    {
        eprintln!(
            "[izin] pembukaan gerbang dari '{}' ditolak: {reason}",
            webview.label()
        );
        return Err(reason.into());
    }
    gate.open(camera, microphone)?;
    Ok(gate.status())
}

/// Membuat jendela tes media untuk SATU sesi. Hanya bisa dipanggil dari jendela
/// utama setelah tindakan pengguna. WebView-nya *incognito* (data store baru,
/// tidak persisten), sehingga tidak berbagi penyimpanan dengan jendela lain.
#[tauri::command]
pub async fn open_media_window(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    kind: MediaKind,
    purpose: MediaPurpose,
    hold_ms: u32,
) -> Result<MediaTask, String> {
    if webview.label() != MAIN_WINDOW_LABEL {
        return Err("Jendela tes media hanya bisa dibuka dari jendela utama.".into());
    }
    if app.get_webview_window(MEDIA_WINDOW_LABEL).is_some() {
        return Err("Jendela tes media sudah terbuka.".into());
    }
    let task = MediaTask::new(kind, purpose, hold_ms);
    app.state::<MediaWindow>().set(task);
    let title = match kind {
        MediaKind::Camera => "Tes kamera — Laptop Health Check",
        MediaKind::Microphone => "Tes mikrofon — Laptop Health Check",
    };
    let built = tauri::WebviewWindowBuilder::new(
        &app,
        MEDIA_WINDOW_LABEL,
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title(title)
    .inner_size(480.0, 360.0)
    .resizable(false)
    .center()
    .focused(true)
    .incognito(true)
    .accept_first_mouse(true)
    .build();
    if let Err(e) = built {
        app.state::<MediaWindow>().take();
        return Err(e.to_string());
    }
    eprintln!("[media] jendela tes media dibuat: {task:?}");
    Ok(task)
}

/// Tugas untuk webview pemanggil: hanya jendela tes media yang punya tugas.
#[tauri::command]
pub fn get_media_task(
    webview: tauri::Webview,
    window: tauri::State<'_, MediaWindow>,
) -> Option<MediaTask> {
    (webview.label() == MEDIA_WINDOW_LABEL)
        .then(|| window.task())
        .flatten()
}

/// Memfokuskan jendela tes media (setelah dialog izin macOS mengambil fokus),
/// agar klik pertama pada "Hentikan sekarang" langsung diterima.
#[tauri::command]
pub fn focus_media_window(webview: tauri::Webview) -> Result<(), String> {
    if webview.label() != MEDIA_WINDOW_LABEL {
        return Err("Bukan jendela tes media.".into());
    }
    webview.window().set_focus().map_err(|e| e.to_string())
}

/// Laporan sesi dari jendela tes media: gerbang ditutup, laporan diteruskan ke
/// jendela utama, lalu jendela media DIHANCURKAN.
#[tauri::command]
pub fn finish_media_session(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    report: serde_json::Value,
) -> Result<(), String> {
    if webview.label() != MEDIA_WINDOW_LABEL {
        return Err("Bukan jendela tes media.".into());
    }
    app.state::<MediaGate>().close("sesi media selesai");
    let task = app.state::<MediaWindow>().take();
    let payload = SessionFinished {
        task,
        report,
        closed_by_user: false,
    };
    app.emit_to(MAIN_WINDOW_LABEL, SESSION_FINISHED_EVENT, payload)
        .map_err(|e| e.to_string())?;
    webview.window().destroy().map_err(|e| e.to_string())?;
    eprintln!("[media] sesi selesai, jendela tes media dihancurkan");
    Ok(())
}

/// Membatalkan sesi dari jendela utama: jendela tes media dihancurkan (sama
/// seperti pengguna menutupnya). Track media ikut berhenti bersama halamannya.
#[tauri::command]
pub fn cancel_media_window(app: tauri::AppHandle, webview: tauri::Webview) -> Result<bool, String> {
    if webview.label() != MAIN_WINDOW_LABEL {
        return Err("Hanya jendela utama yang bisa membatalkan sesi media.".into());
    }
    match app.get_webview_window(MEDIA_WINDOW_LABEL) {
        Some(w) => {
            w.destroy().map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

/// Apakah jendela tes media masih ada?
#[tauri::command]
pub fn media_window_open(app: tauri::AppHandle) -> bool {
    app.get_webview_window(MEDIA_WINDOW_LABEL).is_some()
}

/// Dipanggil saat jendela tes media hancur (oleh `finish_media_session` atau
/// karena ditutup pengguna). Bila sesi belum melapor, itu berarti dibatalkan.
pub fn media_window_destroyed(app: &tauri::AppHandle) {
    app.state::<MediaGate>().close("jendela tes media ditutup");
    if let Some(task) = app.state::<MediaWindow>().take() {
        eprintln!("[media] jendela tes media ditutup sebelum sesi melapor (dibatalkan)");
        let _ = app.emit_to(
            MAIN_WINDOW_LABEL,
            SESSION_FINISHED_EVENT,
            SessionFinished {
                task: Some(task),
                report: serde_json::Value::Null,
                closed_by_user: true,
            },
        );
    }
}

#[tauri::command]
pub fn media_gate_close(gate: tauri::State<'_, MediaGate>) -> GateStatus {
    gate.close("diminta frontend");
    gate.status()
}

#[tauri::command]
pub fn media_gate_status(gate: tauri::State<'_, MediaGate>) -> GateStatus {
    gate.status()
}

/// Mode peluncuran: normal, atau mode pemeriksaan izin media (`LHC_SELFCHECK`).
#[tauri::command]
pub fn get_launch_mode() -> LaunchMode {
    selfcheck::current()
}

/// Mencetak hasil pemeriksaan izin media lalu menutup aplikasi.
/// Ditolak bila aplikasi tidak berjalan dalam mode pemeriksaan.
#[tauri::command]
pub fn report_selfcheck(
    app: tauri::AppHandle,
    gate: tauri::State<'_, MediaGate>,
    report: serde_json::Value,
) -> Result<(), String> {
    if selfcheck::current() == LaunchMode::Normal {
        return Err("Aplikasi tidak berjalan dalam mode pemeriksaan.".into());
    }
    gate.close("pemeriksaan selesai");
    println!("[selfcheck] {report}");
    app.exit(0);
    Ok(())
}

/// Folder konfigurasi aplikasi (lokal), tempat `settings.json`.
fn settings_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

/// Preferensi tema/bahasa. Default (Gelap, Bahasa Indonesia) bila belum ada.
#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Settings {
    let dir = settings_dir(&app).ok();
    let from_file = dir
        .as_ref()
        .is_some_and(|d| d.join(settings::FILE_NAME).exists());
    let settings = dir.map(|d| settings::load(&d)).unwrap_or_default();
    eprintln!(
        "[pengaturan] dibaca: tema={:?}, bahasa={:?} (sumber: {})",
        settings.theme,
        settings.language,
        if from_file { "file" } else { "default" }
    );
    settings
}

/// Menyimpan preferensi secara lokal (tidak pernah dikirim ke mana pun).
#[tauri::command]
pub fn save_settings(app: tauri::AppHandle, settings: Settings) -> Result<Settings, String> {
    let dir = settings_dir(&app)?;
    settings::save(&dir, &settings).map_err(|e| e.to_string())?;
    eprintln!(
        "[pengaturan] disimpan: tema={:?}, bahasa={:?}",
        settings.theme, settings.language
    );
    Ok(settings)
}
