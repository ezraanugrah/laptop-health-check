//! Data mentah hasil pembacaan lapisan platform (belum dinilai).
//!
//! Aturan:
//! - Field `Option` bernilai `None` bila data tidak tersedia di perangkat/OS
//!   ini. JANGAN pernah diisi nilai tebakan atau simulasi.
//! - Model ini lintas OS: field khusus satu OS dibiarkan `None` di OS lain.
//! - Tidak ada field untuk nama organisasi, tenant, domain, UPN, nama
//!   komputer, atau nama pengguna (keputusan D4) — data itu tidak boleh dibaca
//!   ke dalam model.

/// Status dukungan pembaruan keamanan OS (keputusan D3).
/// Dinilai TERPISAH dari kesehatan hardware.
#[allow(
    dead_code,
    reason = "Diisi probe Windows (Milestone 3.1); macOS tidak melaporkan lifecycle OS"
)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OsSupportState {
    /// Masih menerima pembaruan keamanan.
    Supported,
    /// Masa dukungan utama berakhir, tetapi ESU terverifikasi aktif.
    ExtendedSecurityUpdates,
    /// Masa dukungan berakhir dan status ESU tidak dapat diverifikasi secara andal.
    EndedEsuUnverified,
    /// Masa dukungan berakhir dan tidak ada ESU yang aktif.
    Ended,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OsSupport {
    pub state: OsSupportState,
    /// Tanggal akhir dukungan yang relevan (ISO, mis. "2025-10-14").
    pub end_date: Option<String>,
    /// Asal informasi lifecycle (mis. tabel lifecycle Microsoft yang tertanam).
    pub source: String,
}

/// Identitas sistem.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SystemOverview {
    pub os_name: String,
    pub os_version: Option<String>,
    pub os_build: Option<String>,
    /// Edisi OS, mis. "Professional", "EnterpriseS" (Windows).
    pub os_edition: Option<String>,
    /// Versi rilis yang ditampilkan OS, mis. "24H2" (Windows).
    pub os_display_version: Option<String>,
    pub arch: String,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub cpu: Option<String>,
    pub logical_cpus: Option<usize>,
    pub memory_bytes: Option<u64>,
    /// "UEFI" / "BIOS (Legacy)".
    pub firmware_type: Option<String>,
    pub firmware_version: Option<String>,
    pub os_support: Option<OsSupport>,
}

/// Satuan kapasitas baterai yang dilaporkan OS.
#[allow(
    dead_code,
    reason = "MilliwattHours diisi probe baterai Windows (Milestone 3.2)"
)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CapacityUnit {
    /// macOS (`AppleSmartBattery`).
    MilliampHours,
    /// Windows (`BATTERY_INFORMATION`).
    MilliwattHours,
}

impl CapacityUnit {
    pub fn symbol(self) -> &'static str {
        match self {
            CapacityUnit::MilliampHours => "mAh",
            CapacityUnit::MilliwattHours => "mWh",
        }
    }
}

/// Data baterai. `None` di level atas (lihat `Platform::battery`) berarti
/// perangkat tidak memiliki baterai.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct BatteryInfo {
    /// Kapasitas desain dalam `capacity_unit`.
    pub design_capacity: Option<u32>,
    /// Kapasitas penuh saat ini dalam `capacity_unit`.
    pub full_charge_capacity: Option<u32>,
    pub capacity_unit: Option<CapacityUnit>,
    /// `None` bila tidak dilaporkan (Windows sering melaporkan 0 = tidak didukung).
    pub cycle_count: Option<u32>,
    pub design_cycle_count: Option<u32>,
    pub temperature_c: Option<f64>,
    pub charge_percent: Option<u8>,
    pub is_charging: Option<bool>,
    pub external_power: Option<bool>,
    pub permanent_failure: Option<bool>,
    /// Kondisi menurut OS, mis. "Good", "Service Recommended" (macOS).
    pub os_condition: Option<String>,
    /// Kapasitas maksimum (%) menurut OS, bila dilaporkan.
    pub os_max_capacity_percent: Option<u8>,
    /// Jumlah baterai terpasang (Windows bisa > 1).
    pub battery_count: Option<u32>,
    pub chemistry: Option<String>,
    /// `true` bila firmware hanya melaporkan kapasitas relatif (persen bisa
    /// tidak bermakna sebagai mWh/mAh).
    pub capacity_is_relative: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VolumeSpace {
    pub free_bytes: u64,
    pub total_bytes: u64,
}

/// Status kesehatan disk menurut OS (Windows `MSFT_PhysicalDisk.HealthStatus`).
#[allow(dead_code, reason = "Diisi probe penyimpanan Windows (Milestone 3.3)")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiskHealth {
    Healthy,
    Warning,
    Unhealthy,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct DiskInfo {
    /// Identitas disk dari OS, mis. "disk0" / "PhysicalDrive0".
    pub id: String,
    pub model: Option<String>,
    pub size_bytes: Option<u64>,
    pub solid_state: Option<bool>,
    /// Antarmuka, mis. "PCI-Express", "NVMe", "SATA", "USB".
    pub protocol: Option<String>,
    pub internal: Option<bool>,
    /// Ringkasan SMART dari macOS, mis. "Verified", "Failing", "Not Supported".
    pub smart_status: Option<String>,
    /// Status kesehatan disk menurut OS (Windows).
    pub os_health: Option<DiskHealth>,
    /// Prediksi kegagalan SMART dari driver (Windows `Win32_DiskDrive.Status`).
    pub predicted_failure: Option<bool>,
    pub trim: Option<bool>,
    /// Diisi bila disk ini menampung volume sistem.
    pub system_volume: Option<VolumeSpace>,
    /// EKSPERIMENTAL: persentase umur terpakai (NVMe "Percentage Used").
    pub wear_percent: Option<u8>,
    /// EKSPERIMENTAL: jam pemakaian.
    pub power_on_hours: Option<u64>,
    /// EKSPERIMENTAL: suhu disk.
    pub temperature_c: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MemoryPressure {
    Normal,
    Warning,
    Critical,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MemoryModule {
    pub slot: Option<String>,
    pub size: Option<String>,
    pub kind: Option<String>,
    pub speed: Option<String>,
    /// Status modul menurut OS, mis. "ok" (macOS).
    pub status: Option<String>,
}

/// Hasil terakhir Windows Memory Diagnostic yang tercatat di log sistem.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MemoryDiagnosticResult {
    pub passed: bool,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MemoryInfo {
    pub total_bytes: Option<u64>,
    pub app_bytes: Option<u64>,
    pub wired_bytes: Option<u64>,
    pub compressed_bytes: Option<u64>,
    pub swap_used_bytes: Option<u64>,
    pub swap_total_bytes: Option<u64>,
    /// Tingkat tekanan memori dari OS (macOS).
    pub pressure: Option<MemoryPressure>,
    pub memory_type: Option<String>,
    pub modules: Vec<MemoryModule>,
    pub upgradeable: Option<bool>,
    /// Beban memori fisik (%) (Windows `GlobalMemoryStatusEx`).
    pub memory_load_percent: Option<u8>,
    pub commit_used_bytes: Option<u64>,
    pub commit_limit_bytes: Option<u64>,
    /// EKSPERIMENTAL: jumlah error memori terkoreksi (WHEA) 30 hari terakhir.
    pub hardware_error_events_30d: Option<u32>,
    /// EKSPERIMENTAL: hasil Windows Memory Diagnostic terakhir.
    pub memory_diagnostic_last: Option<MemoryDiagnosticResult>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ThermalStatus {
    /// Batas kecepatan CPU (%) dari OS; < 100 = *throttling* (macOS pmset).
    pub speed_limit_percent: Option<u32>,
    pub scheduler_limit_percent: Option<u32>,
    pub available_cpus: Option<u32>,
    pub thermal_warning_recorded: Option<bool>,
    pub performance_warning_recorded: Option<bool>,
    /// Batas pendinginan pasif (%) zona termal; < 100 = pembatasan termal (Windows).
    pub passive_limit_percent: Option<u32>,
    /// Persentase kinerja yang dibatasi daya/termal/OS (Windows PDH).
    pub performance_limit_percent: Option<u32>,
    pub max_mhz: Option<u32>,
    pub limit_mhz: Option<u32>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct CpuInfo {
    pub model: Option<String>,
    pub physical_cores: Option<u32>,
    pub logical_cores: Option<u32>,
    pub performance_cores: Option<u32>,
    pub efficiency_cores: Option<u32>,
    pub base_frequency_hz: Option<u64>,
    /// Beban CPU (%) yang diukur selama ±1 detik saat pemeriksaan.
    pub load_percent: Option<f64>,
    pub thermal: Option<ThermalStatus>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SensorKind {
    Cpu,
    Gpu,
    Battery,
    /// Zona termal ACPI (Windows): suhu sistem/area, BUKAN suhu die CPU.
    ThermalZone,
}

#[derive(Debug, Clone, PartialEq)]
pub struct TemperatureReading {
    /// Nama sensor asli dari OS/SMC, mis. "TC0P" atau nama zona ACPI.
    pub key: String,
    pub kind: SensorKind,
    pub celsius: f64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FanReading {
    pub index: u32,
    pub actual_rpm: Option<f64>,
    pub min_rpm: Option<f64>,
    pub max_rpm: Option<f64>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct SensorReadings {
    pub temperatures: Vec<TemperatureReading>,
    /// `None` = data kipas tidak tersedia; `Some(vec![])` = tidak ada kipas.
    pub fans: Option<Vec<FanReading>>,
}

impl SensorReadings {
    pub fn max_celsius(&self, kind: SensorKind) -> Option<f64> {
        self.temperatures
            .iter()
            .filter(|t| t.kind == kind)
            .map(|t| t.celsius)
            .fold(None, |acc, c| Some(acc.map_or(c, |a: f64| a.max(c))))
    }
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct DisplayInfo {
    pub name: Option<String>,
    pub resolution: Option<String>,
    pub internal: Option<bool>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct GpuInfo {
    pub model: Option<String>,
    pub vendor: Option<String>,
    pub integrated: Option<bool>,
    /// Teks VRAM siap tampil, mis. "4 GB" / "1536 MB (memori bersama)".
    pub vram: Option<String>,
    /// API grafis yang dilaporkan aktif, mis. "Metal 3" / "Direct3D 11 (FL 12_1)".
    pub graphics_api: Option<String>,
    pub cores: Option<u32>,
    pub driver_version: Option<String>,
    pub driver_date: Option<String>,
    /// Kode masalah perangkat Windows (`ConfigManagerErrorCode`); 0 = berfungsi.
    pub device_problem_code: Option<u32>,
    /// EKSPERIMENTAL: suhu GPU.
    pub temperature_c: Option<f64>,
    pub displays: Vec<DisplayInfo>,
}

/// Jenis keanggotaan direktori organisasi (Windows). Nama organisasi/tenant
/// sengaja tidak disimpan (D4).
#[allow(dead_code, reason = "Diisi probe kepemilikan Windows (Milestone 3.8)")]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DirectoryJoin {
    None,
    EntraId,
    Workplace,
    Domain,
}

/// Keluarga mekanisme kepemilikan/manajemen yang dilaporkan platform.
#[allow(
    dead_code,
    reason = "Windows diisi probe kepemilikan Windows (Milestone 3.8)"
)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum OwnershipFamily {
    /// Activation Lock, DEP (ABM/ASM), MDM.
    #[default]
    Apple,
    /// Aktivasi Windows, Autopilot, MDM, Entra ID/domain.
    Windows,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OwnershipInfo {
    pub family: OwnershipFamily,
    /// Activation Lock / Find My (macOS).
    pub activation_lock_enabled: Option<bool>,
    /// Terdaftar program pendaftaran organisasi: Apple DEP (ABM/ASM) atau
    /// Windows Autopilot.
    pub provisioning_enrolled: Option<bool>,
    /// Terdaftar MDM (macOS profiles / Windows MDM seperti Intune).
    pub mdm_enrolled: Option<bool>,
    /// Keanggotaan direktori (Windows).
    pub directory_join: Option<DirectoryJoin>,
    /// Windows teraktivasi & asli (Windows).
    pub os_activated: Option<bool>,
}
