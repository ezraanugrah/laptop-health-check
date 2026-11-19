//! Implementasi macOS (Intel & Apple Silicon).
//!
//! Semua pembacaan memakai utilitas bawaan macOS atau API sistem (Mach,
//! IOKit/SMC) secara **read-only**, tanpa hak administrator dan tanpa
//! dependency tambahan. Pengujian langsung baru dilakukan di Mac Intel;
//! jalur Apple Silicon ditandai "belum diverifikasi" di dokumentasi.

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    BatteryInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, OwnershipInfo, SensorReadings,
    SystemOverview,
};
use crate::diagnostics::types::{CheckId, PlatformSupport, SupportLevel};

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

    fn notes(check: CheckId) -> &'static [&'static str] {
        match check {
            CheckId::System | CheckId::Battery => &[],
            CheckId::Storage => &[
                "Status SMART dari macOS hanya berupa ringkasan lulus/gagal. Persentase keausan SSD, total data tertulis (TBW), dan jam pemakaian tidak tersedia tanpa hak administrator.",
            ],
            CheckId::Memory => &[
                "Kerusakan fisik sel RAM tidak dapat dideteksi dari dalam macOS. Gunakan Apple Diagnostics untuk menguji perangkat keras.",
            ],
            CheckId::Cpu => &[
                "Status termal dibaca dari catatan macOS (pmset). Uji beban CPU tidak dijalankan.",
            ],
            CheckId::Temperature => &[
                "Dibaca dari SMC secara read-only. Nama sensor SMC tidak didokumentasikan Apple; hanya sensor yang dikenali dan bernilai wajar yang ditampilkan.",
                "Pemetaan sensor Apple Silicon belum diverifikasi di perangkat asli.",
            ],
            CheckId::Fans => &[
                "Dibaca dari SMC secara read-only; aplikasi tidak pernah mengubah kecepatan kipas.",
            ],
            CheckId::Gpu => &[
                "Tidak ada metrik resmi untuk \"kesehatan\" GPU. Pemeriksaan ini memastikan GPU terdeteksi dan akselerasi grafis aktif; uji artefak visual direncanakan di Fase 4.",
            ],
            CheckId::Ownership => &[
                "Status dibaca dari macOS di perangkat ini dan bisa berbeda dengan status di server Apple. Kepastian hanya didapat bila pemilik sebelumnya mematikan Find My dan menghapus perangkat dari Apple ID-nya.",
                "Mac yang terdaftar di Apple Business/School Manager dapat terdaftar ulang ke MDM setelah macOS dihapus dan diinstal ulang, walaupun saat ini tidak terdeteksi.",
                "Hasil ini bukan jaminan bebas penguncian dan bukan bukti kepemilikan.",
            ],
        }
    }

    fn support() -> PlatformSupport {
        if cfg!(target_arch = "x86_64") {
            PlatformSupport {
                level: SupportLevel::Verified,
                note: "Diuji di MacBook Intel asli (MacBookPro16,2).".into(),
            }
        } else {
            PlatformSupport {
                level: SupportLevel::Preview,
                note: "Apple Silicon belum diverifikasi di perangkat asli; perlakukan hasil sebagai pratinjau.".into(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ownership_notes_always_state_limitations() {
        let notes = MacOs::notes(CheckId::Ownership);
        assert_eq!(notes.len(), 3);
        assert!(notes.iter().any(|n| n.contains("bukan jaminan")));
    }

    #[test]
    fn every_check_has_a_source() {
        for id in [
            CheckId::System,
            CheckId::Battery,
            CheckId::Storage,
            CheckId::Memory,
            CheckId::Cpu,
            CheckId::Temperature,
            CheckId::Fans,
            CheckId::Gpu,
            CheckId::Ownership,
        ] {
            assert!(!MacOs::sources(id).is_empty(), "{id:?}");
        }
    }

    #[test]
    fn intel_build_is_verified() {
        let level = MacOs::support().level;
        if cfg!(target_arch = "x86_64") {
            assert_eq!(level, SupportLevel::Verified);
        } else {
            assert_eq!(level, SupportLevel::Preview);
        }
    }
}
