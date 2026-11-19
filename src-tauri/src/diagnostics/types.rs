//! Tipe data yang dikirim ke frontend lewat IPC.
//!
//! PENTING: setiap perubahan di sini wajib dicerminkan di
//! `src/types/diagnostics.ts`. Semua field diserialisasi dalam camelCase.

use serde::Serialize;

/// Identitas setiap pemeriksaan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CheckId {
    System,
    Battery,
    Storage,
    Cpu,
    Memory,
}

/// Hasil penilaian sebuah pemeriksaan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
// Warning/Fail/Unsupported mulai dipakai saat diagnostik inti dibuat (Fase 2+).
#[allow(dead_code)]
pub enum Status {
    Pass,
    Warning,
    Fail,
    /// Data tidak dapat dibaca / tidak meyakinkan.
    Unknown,
    /// Pemeriksaan belum diimplementasikan di versi ini.
    NotImplemented,
    /// Pemeriksaan tidak berlaku di platform/perangkat ini (mis. desktop tanpa baterai).
    Unsupported,
}

impl Status {
    /// Tingkat keparahan untuk menghitung status keseluruhan.
    /// `None` = tidak ikut dihitung.
    pub fn severity(self) -> Option<u8> {
        match self {
            Status::Pass => Some(0),
            Status::Unknown => Some(1),
            Status::Warning => Some(2),
            Status::Fail => Some(3),
            Status::NotImplemented | Status::Unsupported => None,
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
    pub metrics: Vec<Metric>,
}

impl CheckResult {
    pub fn not_implemented(id: CheckId) -> Self {
        Self {
            id,
            status: Status::NotImplemented,
            summary: "Belum tersedia di versi ini.".into(),
            metrics: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsReport {
    pub overall: Status,
    /// Waktu pembuatan laporan, milidetik sejak UNIX epoch.
    pub generated_at: u64,
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
