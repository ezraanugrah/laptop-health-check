//! Fallback untuk OS yang belum didukung (Linux ditunda).

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    BatteryInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, OwnershipInfo, SensorReadings,
};
use crate::diagnostics::types::{CheckId, SystemOverview};

pub struct Unsupported;

fn unsupported<T>() -> Result<T, ProbeError> {
    Err(ProbeError::new(format!(
        "Sistem operasi '{}' belum didukung",
        std::env::consts::OS
    )))
}

impl Platform for Unsupported {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        unsupported()
    }
    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        unsupported()
    }
    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        unsupported()
    }
    fn memory() -> Result<MemoryInfo, ProbeError> {
        unsupported()
    }
    fn cpu() -> Result<CpuInfo, ProbeError> {
        unsupported()
    }
    fn sensors() -> Result<SensorReadings, ProbeError> {
        unsupported()
    }
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        unsupported()
    }
    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        unsupported()
    }
    fn serial_number() -> Result<Option<String>, ProbeError> {
        unsupported()
    }
    fn sources(_check: CheckId) -> &'static [&'static str] {
        &[]
    }
}
