//! Lapisan platform: membaca data mentah dari sistem operasi.
//!
//! Implementasi dipilih saat kompilasi lewat `cfg(target_os)` dan diekspor
//! sebagai alias [`Current`]. Semua implementasi wajib memenuhi trait
//! [`Platform`], sehingga lapisan `diagnostics` tidak perlu tahu OS-nya.
//!
//! Prinsip:
//! - Hanya membaca data, tanpa menilai (penilaian ada di `diagnostics`).
//! - Tidak pernah mengisi nilai pengganti/simulasi: data yang tidak ada = `None`
//!   atau `ProbeError`.
//! - Tanpa akses jaringan; tanpa hak administrator; tanpa mengubah hardware.
//! - Perintah sistem dipanggil dengan path absolut.

use std::fmt;

use crate::diagnostics::raw::{
    BatteryInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, OwnershipInfo, SensorReadings,
    SystemOverview,
};
use crate::diagnostics::types::{CheckId, PlatformSupport};

/// Kontrak yang harus dipenuhi setiap platform.
pub trait Platform {
    fn system_overview() -> Result<SystemOverview, ProbeError>;
    /// `Ok(None)` = perangkat tidak memiliki baterai.
    fn battery() -> Result<Option<BatteryInfo>, ProbeError>;
    fn storage() -> Result<Vec<DiskInfo>, ProbeError>;
    fn memory() -> Result<MemoryInfo, ProbeError>;
    /// Termasuk pengukuran beban CPU selama ±1 detik.
    fn cpu() -> Result<CpuInfo, ProbeError>;
    /// Sensor suhu & kipas. Wajib read-only.
    fn sensors() -> Result<SensorReadings, ProbeError>;
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError>;
    fn ownership() -> Result<OwnershipInfo, ProbeError>;
    /// Hanya dipanggil atas permintaan eksplisit pengguna (privasi).
    fn serial_number() -> Result<Option<String>, ProbeError>;
    /// Nama sumber data per pemeriksaan, untuk ditampilkan ke pengguna.
    fn sources(check: CheckId) -> &'static [&'static str];
    /// Keterbatasan deteksi khusus platform per pemeriksaan (selalu ditampilkan).
    fn notes(check: CheckId) -> &'static [&'static str];
    /// Tingkat verifikasi platform di hardware asli (D5/D7).
    fn support() -> PlatformSupport;
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

#[cfg(test)]
pub mod fake;
