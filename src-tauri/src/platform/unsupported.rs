//! Fallback untuk OS selain macOS. Laptop Health Check khusus macOS; modul ini
//! hanya menjaga crate tetap terkompilasi di OS lain dan selalu mengembalikan
//! error (hasilnya "Tidak diketahui"). Bukan target dukungan.

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    AudioDevice, BatteryInfo, BluetoothInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, NetworkRoute,
    OwnershipInfo, PortsInfo, SensorReadings, SystemOverview, TouchBarEvidence, WifiStatus,
};
use crate::diagnostics::types::{CheckId, PlatformSupport, SupportLevel};

pub struct Unsupported;

fn unsupported<T>() -> Result<T, ProbeError> {
    Err(ProbeError::new(format!(
        "Sistem operasi '{}' tidak didukung: Laptop Health Check khusus macOS",
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
    fn wifi() -> Result<Option<WifiStatus>, ProbeError> {
        unsupported()
    }
    fn network_route() -> Result<NetworkRoute, ProbeError> {
        unsupported()
    }
    fn bluetooth() -> Result<BluetoothInfo, ProbeError> {
        unsupported()
    }
    fn ports() -> Result<PortsInfo, ProbeError> {
        unsupported()
    }
    fn audio_devices() -> Result<Vec<AudioDevice>, ProbeError> {
        unsupported()
    }
    fn touch_bar() -> Result<TouchBarEvidence, ProbeError> {
        unsupported()
    }
    fn sources(_check: CheckId) -> &'static [&'static str] {
        &[]
    }
    fn notes(_check: CheckId) -> &'static [super::Note] {
        &[]
    }
    fn support() -> PlatformSupport {
        PlatformSupport::new(
            SupportLevel::Preview,
            crate::tr!(
                "support.unsupportedOs",
                "Sistem operasi ini tidak didukung (aplikasi khusus macOS)."
            ),
        )
    }
}
