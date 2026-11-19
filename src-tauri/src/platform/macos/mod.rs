//! Implementasi macOS (Intel & Apple Silicon).
//!
//! Semua pembacaan memakai utilitas bawaan macOS atau API sistem (Mach,
//! IOKit/SMC) secara **read-only**, tanpa hak administrator dan tanpa
//! dependency tambahan. Pengujian langsung baru dilakukan di Mac Intel;
//! jalur Apple Silicon ditandai "belum diverifikasi" di dokumentasi.

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    BatteryInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, OwnershipInfo, SensorReadings,
};
use crate::diagnostics::types::{CheckId, SystemOverview};

/// Memuat fixture tersanitasi (output asli Mac Intel) untuk test parser.
#[cfg(test)]
macro_rules! fixture {
    ($name:literal) => {
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/fixtures/macos/intel-macbookpro16-2/",
            $name
        ))
    };
}

mod battery;
mod command;
mod cpu;
mod gpu;
mod memory;
mod ownership;
mod parse;
mod sensors;
mod smc;
mod storage;
mod system;

/// Path absolut utilitas sistem (aman dari pembajakan `PATH`).
mod bin {
    pub const IOREG: &str = "/usr/sbin/ioreg";
    pub const SYSCTL: &str = "/usr/sbin/sysctl";
    pub const SW_VERS: &str = "/usr/bin/sw_vers";
    pub const SYSTEM_PROFILER: &str = "/usr/sbin/system_profiler";
    pub const DISKUTIL: &str = "/usr/sbin/diskutil";
    pub const PLUTIL: &str = "/usr/bin/plutil";
    pub const VM_STAT: &str = "/usr/bin/vm_stat";
    pub const PMSET: &str = "/usr/bin/pmset";
    pub const PROFILES: &str = "/usr/bin/profiles";
}

pub struct MacOs;

impl Platform for MacOs {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        system::probe()
    }
    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        battery::probe()
    }
    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        storage::probe()
    }
    fn memory() -> Result<MemoryInfo, ProbeError> {
        memory::probe()
    }
    fn cpu() -> Result<CpuInfo, ProbeError> {
        cpu::probe()
    }
    fn sensors() -> Result<SensorReadings, ProbeError> {
        sensors::probe()
    }
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        gpu::probe()
    }
    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        ownership::probe()
    }
    fn serial_number() -> Result<Option<String>, ProbeError> {
        system::serial_number()
    }
    fn sources(check: CheckId) -> &'static [&'static str] {
        match check {
            CheckId::System => &["sw_vers", "sysctl"],
            CheckId::Battery => &["ioreg AppleSmartBattery", "system_profiler SPPowerDataType"],
            CheckId::Storage => &[
                "diskutil",
                "system_profiler SPNVMeDataType / SPSerialATADataType",
            ],
            CheckId::Memory => &["sysctl", "vm_stat", "system_profiler SPMemoryDataType"],
            CheckId::Cpu => &["sysctl", "host_statistics (Mach)", "pmset -g therm"],
            CheckId::Temperature => &["SMC via IOKit (read-only)", "ioreg AppleSmartBattery"],
            CheckId::Fans => &["SMC via IOKit (read-only)"],
            CheckId::Gpu => &["system_profiler SPDisplaysDataType"],
            CheckId::Ownership => &[
                "system_profiler SPHardwareDataType",
                "profiles status -type enrollment",
            ],
        }
    }
}
