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
    AudioDevice, BatteryInfo, BluetoothInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, NetworkRoute,
    OwnershipInfo, PortsInfo, SensorReadings, SystemOverview, TouchBarEvidence, WifiStatus,
};
use crate::diagnostics::types::{CheckId, PlatformSupport};

/// Kontrak yang harus dipenuhi setiap platform.
/// Catatan keterbatasan: (kode terjemahan, teks Indonesia).
pub type Note = (&'static str, &'static str);

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
    fn notes(check: CheckId) -> &'static [Note];
    /// Tingkat verifikasi platform di hardware asli.
    fn support() -> PlatformSupport;

    // --- Periferal untuk Tes Interaktif (read-only, tanpa pemindaian) ------
    // Data identitas (SSID/BSSID, alamat MAC/BD, nomor seri, UID, nama
    // perangkat Bluetooth/USB) dibuang SEBELUM keluar dari probe.

    /// Status Wi-Fi tanpa pemindaian. `Ok(None)` = tidak ada antarmuka Wi-Fi.
    fn wifi() -> Result<Option<WifiStatus>, ProbeError>;
    /// Rute jaringan menurut macOS, tanpa mengirim lalu lintas (bukan uji internet).
    fn network_route() -> Result<NetworkRoute, ProbeError>;
    fn bluetooth() -> Result<BluetoothInfo, ProbeError>;
    /// Bus/receptacle Thunderbolt dan pengontrol/perangkat USB.
    fn ports() -> Result<PortsInfo, ProbeError>;
    fn audio_devices() -> Result<Vec<AudioDevice>, ProbeError>;
    fn touch_bar() -> Result<TouchBarEvidence, ProbeError>;
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

// Aplikasi ini khusus macOS. Fallback ini hanya menjaga proyek tetap bisa
// dikompilasi di OS lain (semua pemeriksaan menjadi "Tidak diketahui").
#[cfg(not(target_os = "macos"))]
mod unsupported;
#[cfg(not(target_os = "macos"))]
pub use unsupported::Unsupported as Current;

#[cfg(test)]
pub mod fake;
