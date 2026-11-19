//! Implementasi Windows 10/11.
//!
//! Fase 1: hanya memakai pustaka standar Rust + variabel lingkungan bawaan
//! Windows, sehingga belum ada dependency khusus Windows.
//! Rencana Fase 3: WMI / Win32 API (crate `windows`) untuk versi OS,
//! model, RAM, baterai, dan penyimpanan.
//!
//! CATATAN: modul ini belum pernah dikompilasi di Windows. Verifikasi lewat
//! mesin Windows atau CI (lihat TASKS.md).

use super::{Platform, ProbeError};
use crate::diagnostics::types::SystemOverview;

pub struct Windows;

impl Platform for Windows {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        Ok(SystemOverview {
            os_name: "Windows".into(),
            os_version: None,
            os_build: None,
            arch: std::env::consts::ARCH.to_string(),
            model: None,
            cpu: std::env::var("PROCESSOR_IDENTIFIER").ok(),
            logical_cpus: std::thread::available_parallelism().ok().map(|n| n.get()),
            memory_bytes: None,
        })
    }
}
