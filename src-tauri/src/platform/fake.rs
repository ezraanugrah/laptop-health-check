//! Platform palsu KHUSUS TEST (`#[cfg(test)]`): tidak pernah ikut
//! dikompilasi ke aplikasi. Nilai di sini adalah data uji, bukan diagnosis.

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    BatteryInfo, CpuInfo, DiskInfo, FanReading, GpuInfo, MemoryInfo, MemoryModule, MemoryPressure,
    OwnershipInfo, SensorKind, SensorReadings, TemperatureReading, ThermalStatus, VolumeSpace,
};
use crate::diagnostics::types::{CheckId, SystemOverview};

const GIB: u64 = 1024 * 1024 * 1024;

/// Semua data tersedia dan berada dalam batas sehat.
pub struct Healthy;

impl Platform for Healthy {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        Ok(SystemOverview {
            os_name: "macOS".into(),
            os_version: Some("15.0".into()),
            os_build: Some("24A335".into()),
            arch: "x86_64".into(),
            model: Some("TestModel1,1".into()),
            cpu: Some("Test CPU".into()),
            logical_cpus: Some(8),
            memory_bytes: Some(16 * GIB),
        })
    }

    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        Ok(Some(BatteryInfo {
            design_capacity_mah: Some(5000),
            full_charge_capacity_mah: Some(4600),
            cycle_count: Some(100),
            design_cycle_count: Some(1000),
            temperature_c: Some(30.0),
            charge_percent: Some(80),
            is_charging: Some(false),
            external_power: Some(true),
            permanent_failure: Some(false),
            os_condition: Some("Good".into()),
            os_max_capacity_percent: None,
        }))
    }

    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        Ok(vec![DiskInfo {
            id: "disk0".into(),
            model: Some("Test SSD".into()),
            size_bytes: Some(500_000_000_000),
            solid_state: Some(true),
            protocol: Some("PCI-Express".into()),
            internal: Some(true),
            smart_status: Some("Verified".into()),
            trim: Some(true),
            system_volume: Some(VolumeSpace {
                free_bytes: 200_000_000_000,
                total_bytes: 500_000_000_000,
            }),
        }])
    }

    fn memory() -> Result<MemoryInfo, ProbeError> {
        Ok(MemoryInfo {
            total_bytes: Some(16 * GIB),
            app_bytes: Some(4 * GIB),
            wired_bytes: Some(2 * GIB),
            compressed_bytes: Some(GIB),
            swap_used_bytes: Some(0),
            swap_total_bytes: Some(0),
            pressure: Some(MemoryPressure::Normal),
            memory_type: Some("LPDDR4X".into()),
            modules: vec![MemoryModule {
                slot: Some("BANK 0".into()),
                size: Some("16 GB".into()),
                kind: Some("LPDDR4X".into()),
                speed: Some("3733 MHz".into()),
                status: Some("ok".into()),
            }],
            upgradeable: Some(false),
        })
    }

    fn cpu() -> Result<CpuInfo, ProbeError> {
        Ok(CpuInfo {
            model: Some("Test CPU".into()),
            physical_cores: Some(4),
            logical_cores: Some(8),
            performance_cores: None,
            efficiency_cores: None,
            base_frequency_hz: Some(2_000_000_000),
            load_percent: Some(10.0),
            thermal: Some(ThermalStatus {
                speed_limit_percent: Some(100),
                scheduler_limit_percent: Some(100),
                available_cpus: Some(8),
                thermal_warning_recorded: Some(false),
                performance_warning_recorded: Some(false),
            }),
        })
    }

    fn sensors() -> Result<SensorReadings, ProbeError> {
        let t = |key: &str, kind, celsius| TemperatureReading {
            key: key.into(),
            kind,
            celsius,
        };
        Ok(SensorReadings {
            temperatures: vec![
                t("TC0P", SensorKind::Cpu, 50.0),
                t("TG0P", SensorKind::Gpu, 45.0),
                t("TB0T", SensorKind::Battery, 30.0),
            ],
            fans: Some(vec![FanReading {
                index: 0,
                actual_rpm: Some(1800.0),
                min_rpm: Some(1200.0),
                max_rpm: Some(6000.0),
            }]),
        })
    }

    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        Ok(vec![GpuInfo {
            model: Some("Test GPU".into()),
            vendor: Some("Intel".into()),
            integrated: Some(true),
            vram: None,
            metal_support: Some("Metal 3".into()),
            cores: None,
            displays: vec![],
        }])
    }

    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        Ok(OwnershipInfo {
            activation_lock_enabled: Some(false),
            dep_enrolled: Some(false),
            mdm_enrolled: Some(false),
        })
    }

    fn serial_number() -> Result<Option<String>, ProbeError> {
        Ok(Some("TEST-SERIAL".into()))
    }

    fn sources(_check: CheckId) -> &'static [&'static str] {
        &["sumber uji"]
    }
}

/// Semua pembacaan gagal.
pub struct Failing;

fn fail<T>() -> Result<T, ProbeError> {
    Err(ProbeError::new("gagal (uji)"))
}

impl Platform for Failing {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        fail()
    }
    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        fail()
    }
    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        fail()
    }
    fn memory() -> Result<MemoryInfo, ProbeError> {
        fail()
    }
    fn cpu() -> Result<CpuInfo, ProbeError> {
        fail()
    }
    fn sensors() -> Result<SensorReadings, ProbeError> {
        fail()
    }
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        fail()
    }
    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        fail()
    }
    fn serial_number() -> Result<Option<String>, ProbeError> {
        fail()
    }
    fn sources(_check: CheckId) -> &'static [&'static str] {
        &[]
    }
}
