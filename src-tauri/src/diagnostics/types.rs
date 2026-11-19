//! Tipe data yang dikirim ke frontend lewat IPC.
//!
//! PENTING: setiap perubahan di sini wajib dicerminkan di
//! `src/types/diagnostics.ts`. Semua field diserialisasi dalam camelCase.

use serde::Serialize;

use super::text::{Params, Text};
use crate::platform::ProbeError;
use crate::tr;

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

/// Kelompok pemeriksaan (lihat ARCHITECTURE.md §4).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CheckCategory {
    /// Hardware inti: bila datanya tidak tersedia, hasil hardware "belum lengkap".
    CoreHardware,
    /// Hardware pelengkap: boleh tidak terukur tanpa mengubah kesimpulan inti.
    SupplementaryHardware,
    /// Identitas perangkat dan kepemilikan (Activation Lock/MDM) — BUKAN
    /// kesehatan hardware.
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
    /// Teks Indonesia + kode terjemahan + parameter (diratakan ke JSON).
    #[serde(flatten)]
    pub text: Text,
}

impl Reason {
    pub fn info(text: impl Into<Text>) -> Self {
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label_code: Option<&'static str>,
    #[serde(skip_serializing_if = "Params::is_empty")]
    pub label_params: Params,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value_code: Option<&'static str>,
    #[serde(skip_serializing_if = "Params::is_empty")]
    pub value_params: Params,
    /// Berasal dari sumber eksperimental yang belum diverifikasi di hardware
    /// asli. UI wajib menandainya, dan data ini tidak boleh mengubah status.
    /// Saat ini belum ada metrik eksperimental di macOS; field disiapkan untuk
    /// fitur berikutnya (mis. sensor Apple Silicon yang belum tervalidasi).
    pub experimental: bool,
}

impl Metric {
    /// Label/nilai berkode (`tr!`) diterjemahkan frontend; teks biasa
    /// (nama hardware, angka) ditampilkan apa adanya.
    pub fn new(label: impl Into<Text>, value: impl Into<Text>) -> Self {
        let label = label.into();
        let value = value.into();
        Self {
            label: label.text,
            label_code: label.code,
            label_params: label.params,
            value: value.text,
            value_code: value.code,
            value_params: value.params,
            experimental: false,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary_code: Option<&'static str>,
    #[serde(skip_serializing_if = "Params::is_empty")]
    pub summary_params: Params,
    /// Bukti/alasan status, terurut dari yang paling berat.
    pub reasons: Vec<Reason>,
    pub metrics: Vec<Metric>,
    /// Sumber data yang dipakai (mis. "ioreg AppleSmartBattery").
    pub sources: Vec<String>,
    /// Keterbatasan deteksi yang perlu diketahui pengguna (dari lapisan platform).
    pub notes: Vec<Text>,
}

impl CheckResult {
    pub fn new(id: CheckId, status: Status, summary: impl Into<Text>) -> Self {
        let summary = summary.into();
        Self {
            id,
            category: id.category(),
            status,
            summary: summary.text,
            summary_code: summary.code,
            summary_params: summary.params,
            reasons: Vec::new(),
            metrics: Vec::new(),
            sources: Vec::new(),
            notes: Vec::new(),
        }
    }

    /// Data gagal dibaca: status `Unknown` beserta penyebabnya.
    pub fn from_probe_error(id: CheckId, err: &ProbeError) -> Self {
        Self::new(
            id,
            Status::Unknown,
            tr!("common.summary.unreadable", "Data tidak dapat dibaca."),
        )
        .with_reasons(vec![Reason::info(tr!(
            "common.reason.probeError",
            format!("Kendala: {err}"),
            detail = err
        ))])
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

    /// Catatan keterbatasan dari lapisan platform: pasangan (kode, teks Indonesia).
    pub fn with_notes(mut self, notes: &[(&'static str, &'static str)]) -> Self {
        self.notes = notes
            .iter()
            .map(|(code, text)| Text::coded(code, *text, []))
            .collect();
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

/// Tingkat verifikasi dukungan platform tempat aplikasi berjalan (Intel = verified, Apple Silicon = preview).
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note_code: Option<&'static str>,
}

impl PlatformSupport {
    pub fn new(level: SupportLevel, note: Text) -> Self {
        Self {
            level,
            note: note.text,
            note_code: note.code,
        }
    }
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
