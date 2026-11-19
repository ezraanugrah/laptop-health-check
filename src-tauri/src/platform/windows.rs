//! Implementasi Windows 10/11.
//!
//! Fase 2 hanya menyiapkan kontrak: pemeriksaan inti Windows (WMI/Win32)
//! dijadwalkan di Fase 3. Sampai saat itu setiap probe mengembalikan error
//! yang jelas sehingga dashboard menampilkan "Tidak diketahui" — tidak pernah
//! dianggap sehat.
//!
//! CATATAN: modul ini belum pernah dikompilasi di Windows. Verifikasi lewat
//! mesin Windows atau CI (lihat TASKS.md).

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    BatteryInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, OwnershipInfo, SensorReadings,
};
use crate::diagnostics::types::{CheckId, SystemOverview};

pub struct Windows;

fn pending<T>() -> Result<T, ProbeError> {
    Err(ProbeError::new(
        "Belum didukung di Windows (dijadwalkan Fase 3)",
    ))
}

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
    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        pending()
    }
    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        pending()
    }
    fn memory() -> Result<MemoryInfo, ProbeError> {
        pending()
    }
    fn cpu() -> Result<CpuInfo, ProbeError> {
        pending()
    }
    fn sensors() -> Result<SensorReadings, ProbeError> {
        pending()
    }
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        pending()
    }
    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        pending()
    }
    fn serial_number() -> Result<Option<String>, ProbeError> {
        pending()
    }
    fn sources(_check: CheckId) -> &'static [&'static str] {
        &["Windows (Fase 3)"]
    }
}
