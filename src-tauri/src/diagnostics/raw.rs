//! Data mentah hasil pembacaan lapisan platform (belum dinilai).
//!
//! Aturan: field `Option` bernilai `None` bila data tidak tersedia di
//! perangkat/OS ini. JANGAN pernah diisi nilai tebakan atau simulasi.

/// Data baterai. `None` di level atas (lihat `Platform::battery`) berarti
/// perangkat tidak memiliki baterai.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct BatteryInfo {
    pub design_capacity_mah: Option<u32>,
    pub full_charge_capacity_mah: Option<u32>,
    pub cycle_count: Option<u32>,
    pub design_cycle_count: Option<u32>,
    pub temperature_c: Option<f64>,
    pub charge_percent: Option<u8>,
    pub is_charging: Option<bool>,
    pub external_power: Option<bool>,
    pub permanent_failure: Option<bool>,
    /// Kondisi menurut OS, mis. "Good", "Service Recommended".
    pub os_condition: Option<String>,
    /// Kapasitas maksimum (%) menurut OS, bila dilaporkan.
    pub os_max_capacity_percent: Option<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VolumeSpace {
    pub free_bytes: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct DiskInfo {
    /// Identitas disk dari OS, mis. "disk0".
    pub id: String,
    pub model: Option<String>,
    pub size_bytes: Option<u64>,
    pub solid_state: Option<bool>,
    /// Antarmuka, mis. "PCI-Express", "SATA", "USB".
    pub protocol: Option<String>,
    pub internal: Option<bool>,
    /// Ringkasan SMART dari OS, mis. "Verified", "Failing", "Not Supported".
    pub smart_status: Option<String>,
    pub trim: Option<bool>,
    /// Diisi bila disk ini menampung volume sistem.
    pub system_volume: Option<VolumeSpace>,
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
    /// Status modul menurut OS, mis. "ok".
    pub status: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct MemoryInfo {
    pub total_bytes: Option<u64>,
    pub app_bytes: Option<u64>,
    pub wired_bytes: Option<u64>,
    pub compressed_bytes: Option<u64>,
    pub swap_used_bytes: Option<u64>,
    pub swap_total_bytes: Option<u64>,
    pub pressure: Option<MemoryPressure>,
    pub memory_type: Option<String>,
    pub modules: Vec<MemoryModule>,
    pub upgradeable: Option<bool>,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct ThermalStatus {
    /// Batas kecepatan CPU (%) dari OS; < 100 = *throttling*.
    pub speed_limit_percent: Option<u32>,
    pub scheduler_limit_percent: Option<u32>,
    pub available_cpus: Option<u32>,
    pub thermal_warning_recorded: Option<bool>,
    pub performance_warning_recorded: Option<bool>,
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
}

#[derive(Debug, Clone, PartialEq)]
pub struct TemperatureReading {
    /// Nama sensor asli dari OS/SMC, mis. "TC0P".
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
    pub vram: Option<String>,
    /// Dukungan Metal yang dilaporkan OS, mis. "Metal 3".
    pub metal_support: Option<String>,
    pub cores: Option<u32>,
    pub displays: Vec<DisplayInfo>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OwnershipInfo {
    pub activation_lock_enabled: Option<bool>,
    pub dep_enrolled: Option<bool>,
    pub mdm_enrolled: Option<bool>,
}
