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

impl Status {
    /// Tingkat keparahan untuk menghitung status keseluruhan.
    /// `None` = tidak ikut dihitung.
    pub fn severity(self) -> Option<u8> {
        match self {
            Status::Healthy => Some(0),
            Status::Unknown => Some(1),
            Status::Warning => Some(2),
            Status::Critical => Some(3),
            Status::NotApplicable => None,
        }
    }
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
}

impl Metric {
    pub fn new(label: impl Into<String>, value: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            value: value.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub id: CheckId,
    pub status: Status,
    pub summary: String,
    /// Bukti/alasan status, terurut dari yang paling berat.
    pub reasons: Vec<Reason>,
    pub metrics: Vec<Metric>,
    /// Sumber data yang dipakai (mis. "ioreg AppleSmartBattery").
    pub sources: Vec<String>,
    /// Keterbatasan deteksi yang perlu diketahui pengguna.
    pub notes: Vec<String>,
}

impl CheckResult {
    pub fn new(id: CheckId, status: Status, summary: impl Into<String>) -> Self {
        Self {
            id,
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

    pub fn with_notes(mut self, notes: Vec<String>) -> Self {
        self.notes = notes;
        self
    }

    pub fn with_sources(mut self, sources: &[&str]) -> Self {
        self.sources = sources.iter().map(|s| s.to_string()).collect();
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub overall: Status,
    /// Waktu pembuatan laporan, milidetik sejak UNIX epoch.
    pub generated_at: u64,
    /// Lama pemeriksaan dalam milidetik.
    pub duration_ms: u64,
    pub checks: Vec<CheckResult>,
}

/// Data mentah identitas sistem, dibaca oleh lapisan platform.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemOverview {
    pub os_name: String,
    pub os_version: Option<String>,
    pub os_build: Option<String>,
    pub arch: String,
    pub model: Option<String>,
    pub cpu: Option<String>,
    pub logical_cpus: Option<usize>,
    pub memory_bytes: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub os: String,
    pub arch: String,
}
