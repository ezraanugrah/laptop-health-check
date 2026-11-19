//! Implementasi Windows 10/11 x64.
//!
//! Status: **Milestone 3.0 — kerangka**. Setiap probe mengembalikan error
//! "belum diimplementasikan" beserta nomor milestone-nya sehingga dashboard
//! menampilkan "Tidak diketahui" — tidak pernah data karangan dan tidak pernah
//! dianggap sehat. Rencana API per modul: `docs/FASE3-WINDOWS-PRD.md` §4.
//!
//! Aturan modul ini (berlaku untuk semua milestone berikutnya):
//! - Hanya API native (Win32, WMI/COM, DXGI, PDH, SetupAPI/IOCTL) lewat crate
//!   `windows` (versi yang sama dengan Tauri). Tanpa PowerShell/cmd, tanpa
//!   driver kernel, tanpa hak admin, read-only.
//! - COM diinisialisasi per thread probe (MTA); setiap query punya batas waktu.
//! - Parser/dekoder murni ditempatkan terpisah agar bisa dites di semua OS.
//! - Nama organisasi/tenant/domain, UPN, nama komputer/pengguna tidak dibaca
//!   ke model (D4).
//!
//! Submodul yang direncanakan: `com`, `system`, `battery`, `storage`,
//! `memory`, `cpu`, `gpu`, `sensors`, `ownership`.
//!
//! CATATAN: belum pernah dijalankan di hardware Windows asli; CI hanya
//! membuktikan kompilasi dan smoke test di VM (lihat PRD §6.2).

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    BatteryInfo, CpuInfo, DiskInfo, GpuInfo, MemoryInfo, OwnershipInfo, SensorReadings,
    SystemOverview,
};
use crate::diagnostics::types::{CheckId, PlatformSupport, SupportLevel};

pub struct Windows;

fn pending<T>(milestone: &str) -> Result<T, ProbeError> {
    Err(ProbeError::new(format!(
        "Belum diimplementasikan untuk Windows (Milestone {milestone})"
    )))
}

impl Platform for Windows {
    /// Sementara hanya data dari pustaka standar Rust (arsitektur, jumlah CPU
    /// logis). Pembacaan registry/WMI/firmware dijadwalkan Milestone 3.1.
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        Ok(SystemOverview {
            os_name: "Windows".into(),
            arch: std::env::consts::ARCH.to_string(),
            logical_cpus: std::thread::available_parallelism().ok().map(|n| n.get()),
            ..Default::default()
        })
    }
    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        pending("3.2")
    }
    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        pending("3.3")
    }
    fn memory() -> Result<MemoryInfo, ProbeError> {
        pending("3.4")
    }
    fn cpu() -> Result<CpuInfo, ProbeError> {
        pending("3.5")
    }
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        pending("3.6")
    }
    fn sensors() -> Result<SensorReadings, ProbeError> {
        pending("3.7")
    }
    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        pending("3.8")
    }
    fn serial_number() -> Result<Option<String>, ProbeError> {
        pending("3.1")
    }

    fn sources(check: CheckId) -> &'static [&'static str] {
        match check {
            CheckId::System => &["Rust std (arsitektur, CPU logis)"],
            _ => &[],
        }
    }

    fn notes(check: CheckId) -> &'static [&'static str] {
        match check {
            CheckId::System => {
                &["Status dukungan Windows (lifecycle) dinilai terpisah dari kesehatan hardware."]
            }
            CheckId::Battery => &[],
            CheckId::Storage => &[
                "Persentase keausan, jam pemakaian, dan suhu SSD bersifat eksperimental di Windows dan belum diverifikasi di hardware asli.",
            ],
            CheckId::Memory => &[
                "Kerusakan fisik sel RAM tidak dapat dideteksi dari dalam Windows. Gunakan Windows Memory Diagnostic (mdsched.exe) untuk menguji perangkat keras.",
            ],
            CheckId::Cpu => &[
                "Pembatasan kecepatan bisa disebabkan pengaturan daya (mode hemat/baterai), bukan hanya suhu. Uji beban CPU tidak dijalankan.",
            ],
            CheckId::Temperature => &[
                "Windows hanya menyediakan suhu zona termal ACPI tanpa driver tambahan; nilai ini bukan suhu die CPU. Aplikasi tidak memakai driver kernel demi keamanan.",
            ],
            CheckId::Fans => &[
                "Windows tidak menyediakan API kipas standar; sebagian besar laptop tidak melaporkannya tanpa driver kernel/vendor.",
            ],
            CheckId::Gpu => &[
                "Tidak ada metrik resmi untuk \"kesehatan\" GPU. Suhu GPU bersifat eksperimental.",
            ],
            CheckId::Ownership => &[
                "Pendaftaran Windows Autopilot bisa baru muncul setelah reset atau instal ulang, walaupun saat ini tidak terdeteksi.",
                "Kunci pemulihan BitLocker/Device Encryption bisa terikat ke akun Microsoft pemilik sebelumnya.",
                "Status aktivasi lokal bisa berbeda dengan status di server Microsoft.",
                "Hasil ini bukan jaminan bebas penguncian dan bukan bukti kepemilikan.",
            ],
        }
    }

    fn support() -> PlatformSupport {
        PlatformSupport {
            level: SupportLevel::Preview,
            note: "Dukungan Windows masih dalam pengembangan dan belum diverifikasi di hardware Windows asli; sebagian pemeriksaan belum tersedia.".into(),
        }
    }
}
