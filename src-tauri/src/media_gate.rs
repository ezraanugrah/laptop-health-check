//! Gerbang izin kamera/mikrofon untuk WebView (Fase 3.0).
//!
//! Latar belakang: bila tidak ada handler, wry 0.57 di macOS **mengizinkan
//! semua** permintaan `getUserMedia` dari halaman (`WKPermissionDecisionGrant`).
//! Modul ini memasang kebijakan *tolak secara default*:
//!
//! - Semua jenis izin WebView selain kamera/mikrofon **selalu ditolak**.
//! - Kamera/mikrofon hanya diizinkan saat gerbang dibuka secara eksplisit oleh
//!   tes yang dimulai pengguna, hanya untuk jenis yang diminta, dan paling lama
//!   [`MAX_OPEN_SECS`] detik (gerbang menutup sendiri walau frontend lupa).
//! - Gerbang ditutup lagi saat halaman dimuat ulang.
//! - Handler tidak pernah mengembalikan `Default`, karena di macOS `Default`
//!   berarti WebKit menampilkan dialog izin sendiri.
//!
//! Izin sistem macOS (TCC) tetap berlaku di atas gerbang ini. Gerbang hanya
//! membatasi kapan WebView boleh *meminta*; pengguna tetap memutuskan lewat
//! dialog macOS, dan aplikasi tidak pernah mengubah pengaturan privasi.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

/// Batas maksimum gerbang terbuka. Tes kamera/mikrofon jauh lebih singkat;
/// ini hanya jaring pengaman bila frontend gagal menutup gerbang.
pub const MAX_OPEN_SECS: u64 = 300;

/// Jenis permintaan izin dari WebView, disederhanakan dari `PermissionKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RequestKind {
    Camera,
    Microphone,
    /// Lokasi, notifikasi, clipboard, tangkapan layar, MIDI, sensor, dll.
    Other,
}

impl RequestKind {
    pub fn from_tauri(kind: tauri::webview::PermissionKind) -> Self {
        use tauri::webview::PermissionKind as K;
        match kind {
            K::Camera => Self::Camera,
            K::Microphone => Self::Microphone,
            _ => Self::Other,
        }
    }

    fn label(self) -> &'static str {
        match self {
            Self::Camera => "kamera",
            Self::Microphone => "mikrofon",
            Self::Other => "lainnya",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Decision {
    Allow,
    Deny,
}

/// Keadaan gerbang saat terbuka.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OpenGate {
    pub camera: bool,
    pub microphone: bool,
    pub opened_at: Instant,
}

/// Keputusan murni (tanpa efek samping) untuk satu permintaan izin.
pub fn decide(kind: RequestKind, gate: Option<&OpenGate>, now: Instant) -> Decision {
    let Some(gate) = gate else {
        return Decision::Deny;
    };
    if now.saturating_duration_since(gate.opened_at) >= Duration::from_secs(MAX_OPEN_SECS) {
        return Decision::Deny;
    }
    let allowed = match kind {
        RequestKind::Camera => gate.camera,
        RequestKind::Microphone => gate.microphone,
        RequestKind::Other => false,
    };
    if allowed {
        Decision::Allow
    } else {
        Decision::Deny
    }
}

/// Status gerbang untuk frontend (IPC, camelCase).
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GateStatus {
    pub open: bool,
    pub camera: bool,
    pub microphone: bool,
    /// Sisa detik sebelum gerbang menutup sendiri (0 bila tertutup).
    pub remaining_secs: u64,
}

/// State aplikasi (`tauri::State`) yang menyimpan gerbang.
#[derive(Debug, Default)]
pub struct MediaGate {
    state: Mutex<Option<OpenGate>>,
}

impl MediaGate {
    pub fn open(&self, camera: bool, microphone: bool) -> Result<(), String> {
        if !camera && !microphone {
            return Err("Pilih kamera dan/atau mikrofon.".into());
        }
        *self.lock() = Some(OpenGate {
            camera,
            microphone,
            opened_at: Instant::now(),
        });
        eprintln!("[izin] gerbang media dibuka: kamera={camera}, mikrofon={microphone}");
        Ok(())
    }

    pub fn close(&self, reason: &str) {
        let mut state = self.lock();
        if state.take().is_some() {
            eprintln!("[izin] gerbang media ditutup ({reason})");
        }
    }

    pub fn status(&self) -> GateStatus {
        status_at(self.lock().as_ref(), Instant::now())
    }

    /// Dipanggil oleh handler izin WebView untuk setiap permintaan.
    pub fn decide(&self, kind: RequestKind) -> Decision {
        let now = Instant::now();
        let mut state = self.lock();
        let decision = decide(kind, state.as_ref(), now);
        // Gerbang kedaluwarsa dibersihkan agar status yang dilaporkan jujur.
        if state.is_some() && status_at(state.as_ref(), now).remaining_secs == 0 {
            *state = None;
            eprintln!("[izin] gerbang media kedaluwarsa dan ditutup");
        }
        let verdict = match decision {
            Decision::Allow => "diizinkan (gerbang terbuka)",
            Decision::Deny => "ditolak",
        };
        eprintln!("[izin] permintaan {} {verdict}", kind.label());
        decision
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, Option<OpenGate>> {
        // Mutex hanya berisi data sederhana; bila pernah "poisoned", isinya
        // tetap aman dipakai (kebijakan tetap tolak bila tidak terbuka).
        self.state.lock().unwrap_or_else(|e| e.into_inner())
    }
}

fn status_at(gate: Option<&OpenGate>, now: Instant) -> GateStatus {
    match gate {
        Some(g) => {
            let elapsed = now.saturating_duration_since(g.opened_at).as_secs();
            let remaining = MAX_OPEN_SECS.saturating_sub(elapsed);
            GateStatus {
                open: remaining > 0,
                camera: g.camera && remaining > 0,
                microphone: g.microphone && remaining > 0,
                remaining_secs: remaining,
            }
        }
        None => GateStatus {
            open: false,
            camera: false,
            microphone: false,
            remaining_secs: 0,
        },
    }
}

/// Mengubah keputusan menjadi respons Tauri. Tidak pernah `Default`.
pub fn to_response(decision: Decision) -> tauri::webview::PermissionResponse {
    match decision {
        Decision::Allow => tauri::webview::PermissionResponse::Allow,
        Decision::Deny => tauri::webview::PermissionResponse::Deny,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn gate(camera: bool, microphone: bool, opened_at: Instant) -> OpenGate {
        OpenGate {
            camera,
            microphone,
            opened_at,
        }
    }

    #[test]
    fn closed_gate_denies_everything() {
        let now = Instant::now();
        for kind in [
            RequestKind::Camera,
            RequestKind::Microphone,
            RequestKind::Other,
        ] {
            assert_eq!(decide(kind, None, now), Decision::Deny);
        }
    }

    #[test]
    fn open_gate_allows_only_requested_kinds() {
        let t0 = Instant::now();
        let camera_only = gate(true, false, t0);
        assert_eq!(
            decide(RequestKind::Camera, Some(&camera_only), t0),
            Decision::Allow
        );
        assert_eq!(
            decide(RequestKind::Microphone, Some(&camera_only), t0),
            Decision::Deny
        );
        let mic_only = gate(false, true, t0);
        assert_eq!(
            decide(RequestKind::Microphone, Some(&mic_only), t0),
            Decision::Allow
        );
        assert_eq!(
            decide(RequestKind::Camera, Some(&mic_only), t0),
            Decision::Deny
        );
    }

    #[test]
    fn other_permissions_are_always_denied() {
        let t0 = Instant::now();
        let both = gate(true, true, t0);
        assert_eq!(decide(RequestKind::Other, Some(&both), t0), Decision::Deny);
    }

    #[test]
    fn gate_expires_at_the_limit() {
        let t0 = Instant::now();
        let both = gate(true, true, t0);
        let just_before = t0 + Duration::from_secs(MAX_OPEN_SECS) - Duration::from_millis(1);
        let at_limit = t0 + Duration::from_secs(MAX_OPEN_SECS);
        assert_eq!(
            decide(RequestKind::Camera, Some(&both), just_before),
            Decision::Allow
        );
        assert_eq!(
            decide(RequestKind::Camera, Some(&both), at_limit),
            Decision::Deny
        );
    }

    #[test]
    fn status_reports_remaining_time_and_expiry() {
        let t0 = Instant::now();
        let both = gate(true, true, t0);
        let s = status_at(Some(&both), t0 + Duration::from_secs(10));
        assert!(s.open && s.camera && s.microphone);
        assert_eq!(s.remaining_secs, MAX_OPEN_SECS - 10);
        let expired = status_at(Some(&both), t0 + Duration::from_secs(MAX_OPEN_SECS));
        assert!(!expired.open && !expired.camera && !expired.microphone);
        assert_eq!(status_at(None, t0).remaining_secs, 0);
    }

    #[test]
    fn media_gate_open_close_cycle() {
        let g = MediaGate::default();
        assert!(!g.status().open);
        assert!(g.open(false, false).is_err(), "harus memilih minimal satu");
        g.open(true, false).unwrap();
        assert_eq!(g.decide(RequestKind::Camera), Decision::Allow);
        assert_eq!(g.decide(RequestKind::Microphone), Decision::Deny);
        g.close("test");
        assert_eq!(g.decide(RequestKind::Camera), Decision::Deny);
        assert!(!g.status().open);
    }

    #[test]
    fn never_returns_default_response() {
        use tauri::webview::PermissionResponse as R;
        assert_eq!(to_response(Decision::Allow), R::Allow);
        assert_eq!(to_response(Decision::Deny), R::Deny);
    }

    #[test]
    fn gate_status_is_camel_case() {
        let json = serde_json::to_string(&status_at(None, Instant::now())).unwrap();
        assert!(json.contains("remainingSecs"));
    }
}
