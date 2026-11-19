//! Pemeriksaan Penyimpanan: penyimpanan (status SMART, kapasitas, ruang kosong, keausan SSD).
//!
//! Status: kerangka. Implementasi dijadwalkan di Fase 2 (macOS) dan
//! Fase 3 (Windows) — lihat TASKS.md. Saat diimplementasikan, tambahkan
//! method baca data mentah di trait `crate::platform::Platform`, lalu
//! nilai datanya di sini (fungsi `evaluate` yang bisa dites).

use super::types::{CheckId, CheckResult};

pub fn run() -> CheckResult {
    CheckResult::not_implemented(CheckId::Storage)
}
