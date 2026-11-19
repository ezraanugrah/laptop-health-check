//! Lapisan platform: membaca data mentah dari sistem operasi.
//!
//! Implementasi dipilih saat kompilasi lewat `cfg(target_os)` dan diekspor
//! sebagai alias [`Current`]. Semua implementasi wajib memenuhi trait
//! [`Platform`], sehingga lapisan `diagnostics` tidak perlu tahu OS-nya.
//!
//! Prinsip:
//! - Hanya membaca data, tanpa menilai (penilaian ada di `diagnostics`).
//! - Tanpa akses jaringan; tanpa hak administrator bila memungkinkan.
//! - Perintah sistem dipanggil dengan path absolut (lihat `macos.rs`).

use std::fmt;

use crate::diagnostics::types::SystemOverview;

/// Kontrak yang harus dipenuhi setiap platform.
///
/// Method baru ditambahkan bertahap per fase, mis. `battery()`,
/// `storage()`, `cpu()`, `memory()` (lihat TASKS.md).
pub trait Platform {
    fn system_overview() -> Result<SystemOverview, ProbeError>;
}

/// Kesalahan saat membaca data dari OS.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProbeError(String);

impl ProbeError {
    pub fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }
}

impl fmt::Display for ProbeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ProbeError {}

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::MacOs as Current;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::Windows as Current;

// Linux ditunda; fallback ini menjaga proyek tetap bisa dikompilasi di OS lain.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
mod unsupported;
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub use unsupported::Unsupported as Current;
