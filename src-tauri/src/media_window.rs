//! Jendela tes media terpisah (Fase 3.0, perbaikan setelah Tes A).
//!
//! Temuan Tes A (19 Nov 2026): WebKit mengingat izin kamera yang sudah
//! diberikan selama halaman masih terbuka; permintaan berikutnya dari halaman
//! yang sama diizinkan TANPA menanyakan handler izin aplikasi. Gerbang internal
//! saja tidak cukup.
//!
//! Aturan modul ini:
//! - Jendela utama (`main`) SELALU ditolak untuk kamera/mikrofon.
//! - Hanya jendela [`MEDIA_WINDOW_LABEL`] yang boleh membuka gerbang, hanya
//!   untuk jenis yang ditugaskan, dan hanya untuk tugas `Session`.
//! - Jendela media dibuat per sesi dan dihancurkan setelah selesai, sehingga
//!   izin yang diingat WebKit ikut hilang bersama halamannya.

use std::sync::Mutex;

use serde::{Deserialize, Serialize};

use crate::media_gate::RequestKind;

pub const MAIN_WINDOW_LABEL: &str = "main";
pub const MEDIA_WINDOW_LABEL: &str = "media-test";
pub const SESSION_FINISHED_EVENT: &str = "media-session-finished";
/// Batas waktu otomatis sesi jendela media (pengaman tambahan selain tombol).
pub const MAX_HOLD_MS: u32 = 10_000;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MediaKind {
    Camera,
    Microphone,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum MediaPurpose {
    /// Sesi tes: gerbang boleh dibuka untuk `kind`.
    Session,
    /// Pemeriksaan: meminta akses dengan gerbang TERTUTUP (harus ditolak).
    RetryClosed,
    /// Latihan tanpa media: jendela, tombol "Hentikan sekarang", dan batas
    /// waktu diuji tanpa pernah meminta kamera/mikrofon.
    DryRun,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaTask {
    pub kind: MediaKind,
    pub purpose: MediaPurpose,
    /// Batas waktu otomatis (ms), sudah dibatasi ke [`MAX_HOLD_MS`].
    pub hold_ms: u32,
}

impl MediaTask {
    pub fn new(kind: MediaKind, purpose: MediaPurpose, hold_ms: u32) -> Self {
        Self {
            kind,
            purpose,
            hold_ms: hold_ms.clamp(1_000, MAX_HOLD_MS),
        }
    }
}

/// Apakah webview dengan `label` boleh dipertimbangkan gerbang untuk `kind`?
/// Jendela selain jendela media selalu ditolak.
pub fn webview_may_use_media(label: &str, kind: RequestKind) -> bool {
    label == MEDIA_WINDOW_LABEL && kind != RequestKind::Other
}

/// Validasi permintaan membuka gerbang.
pub fn may_open_gate(
    caller: &str,
    task: Option<&MediaTask>,
    camera: bool,
    microphone: bool,
) -> Result<(), &'static str> {
    if caller != MEDIA_WINDOW_LABEL {
        return Err("Gerbang izin hanya bisa dibuka dari jendela tes media.");
    }
    let Some(task) = task else {
        return Err("Tidak ada tugas tes media yang aktif.");
    };
    if task.purpose != MediaPurpose::Session {
        return Err("Tugas ini tidak boleh membuka gerbang izin.");
    }
    let expected = match task.kind {
        MediaKind::Camera => (true, false),
        MediaKind::Microphone => (false, true),
    };
    if (camera, microphone) != expected {
        return Err("Jenis akses tidak sesuai dengan tugas tes media.");
    }
    Ok(())
}

/// State aplikasi: tugas jendela media yang sedang berjalan (paling banyak satu).
#[derive(Debug, Default)]
pub struct MediaWindow {
    task: Mutex<Option<MediaTask>>,
}

impl MediaWindow {
    pub fn task(&self) -> Option<MediaTask> {
        *self.lock()
    }

    pub fn set(&self, task: MediaTask) {
        *self.lock() = Some(task);
    }

    pub fn take(&self) -> Option<MediaTask> {
        self.lock().take()
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Option<MediaTask>> {
        self.task.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// Isi event `media-session-finished` ke jendela utama.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionFinished {
    pub task: Option<MediaTask>,
    pub report: serde_json::Value,
    /// Jendela ditutup pengguna (tombol merah) sebelum sesi melapor.
    pub closed_by_user: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    const CAMERA_SESSION: MediaTask = MediaTask {
        kind: MediaKind::Camera,
        purpose: MediaPurpose::Session,
        hold_ms: MAX_HOLD_MS,
    };

    #[test]
    fn main_window_never_uses_media() {
        assert!(!webview_may_use_media(
            MAIN_WINDOW_LABEL,
            RequestKind::Camera
        ));
        assert!(!webview_may_use_media(
            MAIN_WINDOW_LABEL,
            RequestKind::Microphone
        ));
        assert!(!webview_may_use_media("lain", RequestKind::Camera));
        assert!(webview_may_use_media(
            MEDIA_WINDOW_LABEL,
            RequestKind::Camera
        ));
        assert!(!webview_may_use_media(
            MEDIA_WINDOW_LABEL,
            RequestKind::Other
        ));
    }

    #[test]
    fn only_media_window_with_session_task_opens_gate() {
        assert!(may_open_gate(MAIN_WINDOW_LABEL, Some(&CAMERA_SESSION), true, false).is_err());
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, None, true, false).is_err());
        let retry = MediaTask::new(MediaKind::Camera, MediaPurpose::RetryClosed, 5_000);
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, Some(&retry), true, false).is_err());
        let dry = MediaTask::new(MediaKind::Camera, MediaPurpose::DryRun, 5_000);
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, Some(&dry), true, false).is_err());
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, Some(&CAMERA_SESSION), true, false).is_ok());
    }

    #[test]
    fn gate_kind_must_match_task() {
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, Some(&CAMERA_SESSION), false, true).is_err());
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, Some(&CAMERA_SESSION), true, true).is_err());
        let mic = MediaTask::new(MediaKind::Microphone, MediaPurpose::Session, 10_000);
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, Some(&mic), false, true).is_ok());
        assert!(may_open_gate(MEDIA_WINDOW_LABEL, Some(&mic), true, false).is_err());
    }

    #[test]
    fn task_state_set_and_take() {
        let w = MediaWindow::default();
        assert_eq!(w.task(), None);
        w.set(CAMERA_SESSION);
        assert_eq!(w.task(), Some(CAMERA_SESSION));
        assert_eq!(w.take(), Some(CAMERA_SESSION));
        assert_eq!(w.take(), None);
    }

    #[test]
    fn ipc_shapes_are_camel_case() {
        let json = serde_json::to_string(&SessionFinished {
            task: Some(MediaTask::new(
                MediaKind::Microphone,
                MediaPurpose::RetryClosed,
                3_000,
            )),
            report: serde_json::Value::Null,
            closed_by_user: true,
        })
        .unwrap();
        assert!(json.contains("\"closedByUser\":true"));
        assert!(json.contains("\"kind\":\"microphone\""));
        assert!(json.contains("\"purpose\":\"retryClosed\""));
        assert!(json.contains("\"holdMs\":3000"));
    }

    #[test]
    fn hold_time_is_clamped_to_safety_limit() {
        assert_eq!(
            MediaTask::new(MediaKind::Camera, MediaPurpose::Session, 60_000).hold_ms,
            MAX_HOLD_MS
        );
        assert_eq!(
            MediaTask::new(MediaKind::Camera, MediaPurpose::Session, 0).hold_ms,
            1_000
        );
    }
}
