//! Tipe data yang dikirim ke frontend lewat IPC.
//!
//! PENTING: setiap perubahan di sini wajib dicerminkan di
//! `src/types/diagnostics.ts`. Semua field diserialisasi dalam camelCase.

use serde::Serialize;

use crate::platform::ProbeError;

/// Identitas setiap pemeriksaan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CheckId {
    System,
    Battery,
    Storage,
    Memory,
    Cpu,
    Temperature,
    Fans,
    Gpu,
    Ownership,
}

/// Kelompok pemeriksaan (keputusan D1/D3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CheckCategory {
    /// Hardware inti: bila datanya tidak tersedia, hasil hardware "belum lengkap".
    CoreHardware,
    /// Hardware pelengkap: boleh tidak terukur tanpa mengubah kesimpulan inti.
    SupplementaryHardware,
    /// Identitas perangkat, keamanan OS, dan kepemilikan — BUKAN kesehatan hardware.
    DeviceSecurity,
}

impl CheckId {
    pub fn category(self) -> CheckCategory {
        match self {
            CheckId::Battery | CheckId::Storage | CheckId::Memory | CheckId::Cpu => {
                CheckCategory::CoreHardware
            }
            CheckId::Temperature | CheckId::Fans | CheckId::Gpu => {
                CheckCategory::SupplementaryHardware
            }
            CheckId::System | CheckId::Ownership => CheckCategory::DeviceSecurity,
        }
    }
}

/// Hasil penilaian sebuah pemeriksaan.
///
/// Aturan: `Healthy` hanya boleh dipakai bila ADA bukti positif. Data yang
/// tidak tersedia tidak pernah dianggap sehat — gunakan `Unknown`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Status {
    Healthy,
    Warning,
    Critical,
    /// Data tidak dapat dibaca / bukti tidak cukup.
    Unknown,
    /// Pemeriksaan tidak berlaku di perangkat ini (mis. tanpa baterai/kipas).
    NotApplicable,
}

/// Kesimpulan kesehatan hardware (gabungan pemeriksaan inti + pelengkap).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum HardwareStatus {
    Healthy,
    Warning,
    Critical,
    /// Ada data inti yang tidak tersedia: TIDAK boleh disimpulkan sehat.
    Incomplete,
}

/// Ringkasan kesehatan hardware beserta cakupan pengukurannya.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareSummary {
    pub status: HardwareStatus,
    /// Jumlah pemeriksaan hardware yang menghasilkan kesimpulan
    /// (Sehat/Peringatan/Kritis/Tidak berlaku).
    pub measured: usize,
    pub total: usize,
    pub missing_core: Vec<CheckId>,
    pub missing_supplementary: Vec<CheckId>,
}

/// Tingkat sebuah alasan; urutan deklarasi = urutan tampil.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReasonLevel {
    Critical,
    Warning,
    Ok,
    Info,
}

/// Alasan di balik status sebuah pemeriksaan (bukti yang ditemukan).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reason {
    pub level: ReasonLevel,
    pub text: String,
}

impl Reason {
    pub fn info(text: impl Into<String>) -> Self {
        Self {
            level: ReasonLevel::Info,
            text: text.into(),
        }
    }
}

/// Satu baris data yang ditampilkan di kartu pemeriksaan.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metric {
    pub label: String,
    pub value: String,
    /// Berasal dari sumber eksperimental yang belum diverifikasi di hardware
    /// asli (keputusan D5). UI wajib menandainya.
    pub experimental: bool,
}

impl Metric {
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            value: value.into(),
            experimental: false,
        }
    }

    pub fn experimental(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            experimental: true,
            ..Self::new(label, value)
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub id: CheckId,
    pub category: CheckCategory,
    pub status: Status,
    pub summary: String,
    /// Bukti/alasan status, terurut dari yang paling berat.
    pub reasons: Vec<Reason>,
    pub metrics: Vec<Metric>,
    /// Sumber data yang dipakai (mis. "ioreg AppleSmartBattery").
    pub sources: Vec<String>,
    /// Keterbatasan deteksi yang perlu diketahui pengguna (dari lapisan platform).
    pub notes: Vec<String>,
}

impl CheckResult {
    pub fn new(id: CheckId, status: Status, summary: impl Into<String>) -> Self {
        Self {
            id,
            category: id.category(),
            status,
            summary: summary.into(),
            reasons: Vec::new(),
            metrics: Vec::new(),
            sources: Vec::new(),
            notes: Vec::new(),
        }
    }

    /// Data gagal dibaca: status `Unknown` beserta penyebabnya.
    pub fn from_probe_error(id: CheckId, err: &ProbeError) -> Self {
        Self::new(id, Status::Unknown, "Data tidak dapat dibaca.")
            .with_reasons(vec![Reason::info(format!("Kendala: {err}"))])
    }

    pub fn with_reasons(mut self, reasons: Vec<Reason>) -> Self {
        self.reasons = reasons;
        self
    }

    pub fn with_metrics(mut self, metrics: Vec<Metric>) -> Self {
        self.metrics = metrics;
        self
    }

    pub fn with_sources(mut self, sources: &[&str]) -> Self {
        self.sources = sources.iter().map(|s| s.to_string()).collect();
        self
    }

    pub fn with_notes(mut self, notes: &[&str]) -> Self {
        self.notes = notes.iter().map(|s| s.to_string()).collect();
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    /// Kesimpulan kesehatan hardware (tanpa keamanan OS/kepemilikan).
    pub hardware: HardwareSummary,
    /// Waktu pembuatan laporan, milidetik sejak UNIX epoch.
    pub generated_at: u64,
    /// Lama pemeriksaan dalam milidetik.
    pub duration_ms: u64,
    pub checks: Vec<CheckResult>,
}

/// Tingkat verifikasi dukungan platform tempat aplikasi berjalan (D5/D7).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SupportLevel {
    /// Sudah diuji di hardware asli.
    Verified,
    /// Belum diverifikasi di hardware asli; hasil harus diperlakukan sebagai pratinjau.
    Preview,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformSupport {
    pub level: SupportLevel,
    pub note: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub os: String,
    pub arch: String,
    pub support: PlatformSupport,
}
