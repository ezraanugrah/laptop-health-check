//! Data mentah hasil pembacaan lapisan platform macOS (belum dinilai).
//!
//! Aturan:
//! - Field `Option` bernilai `None` bila data tidak tersedia di Mac ini.
//!   JANGAN pernah diisi nilai tebakan atau simulasi.
//! - Tidak ada field untuk nama organisasi, UPN, nama komputer, atau nama
//!   pengguna — data itu tidak boleh dibaca ke dalam model.

use serde::Serialize;

/// Identitas sistem.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SystemOverview {
    pub os_name: String,
    pub os_version: Option<String>,
    pub os_build: Option<String>,
    pub arch: String,
    pub model: Option<String>,
    pub cpu: Option<String>,
    pub logical_cpus: Option<usize>,
    pub memory_bytes: Option<u64>,
}

/// Data baterai. `None` di level atas (lihat `Platform::battery`) berarti
/// perangkat tidak memiliki baterai.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct BatteryInfo {
    /// Kapasitas desain (mAh).
    pub design_capacity: Option<u32>,
    /// Kapasitas penuh saat ini (mAh).
    pub full_charge_capacity: Option<u32>,
    pub cycle_count: Option<u32>,
    pub design_cycle_count: Option<u32>,
    pub temperature_c: Option<f64>,
    pub charge_percent: Option<u8>,
    pub is_charging: Option<bool>,
    pub external_power: Option<bool>,
    pub permanent_failure: Option<bool>,
    /// Kondisi menurut macOS, mis. "Good", "Service Recommended".
    pub os_condition: Option<String>,
    /// Kapasitas maksimum (%) menurut macOS, bila dilaporkan.
    pub os_max_capacity_percent: Option<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VolumeSpace {
    pub free_bytes: u64,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Default, PartialEq)]
pub struct DiskInfo {
    /// Identitas disk dari macOS, mis. "disk0".
    pub id: String,
    pub model: Option<String>,
    pub size_bytes: Option<u64>,
    pub solid_state: Option<bool>,
    /// Antarmuka, mis. "PCI-Express", "Apple Fabric", "SATA", "USB".
    pub protocol: Option<String>,
    pub internal: Option<bool>,
    /// Ringkasan SMART dari macOS, mis. "Verified", "Failing", "Not Supported".
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
    /// Status modul menurut macOS, mis. "ok".
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
    /// Batas kecepatan CPU (%) dari pmset; < 100 = *throttling* (Intel).
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
    /// Nama sensor asli dari SMC, mis. "TC0P".
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
    /// API grafis yang dilaporkan aktif, mis. "Metal 3".
    pub graphics_api: Option<String>,
    pub cores: Option<u32>,
    pub displays: Vec<DisplayInfo>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct OwnershipInfo {
    /// Activation Lock / Find My.
    pub activation_lock_enabled: Option<bool>,
    /// Terdaftar DEP (Apple Business/School Manager).
    pub provisioning_enrolled: Option<bool>,
    /// Terdaftar MDM.
    pub mdm_enrolled: Option<bool>,
}

// ---------------------------------------------------------------------------
// Periferal (Fase 3: Wi-Fi, Bluetooth, port USB/Thunderbolt, audio, Touch Bar)
//
// Privasi: TIDAK ADA field untuk SSID/BSSID, alamat MAC/BD, nomor seri, UID,
// alamat IP, atau nama perangkat Bluetooth/USB. Lapisan platform membuang
// data itu sebelum mengisi struct di bawah. Enum kecil dan struct port/audio
// ikut diserialisasi apa adanya ke frontend (camelCase), jadi wajib tetap
// bebas data identitas.
// ---------------------------------------------------------------------------

/// Standar Wi-Fi aktif (CoreWLAN `CWPHYMode`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum WifiPhyMode {
    #[serde(rename = "none")]
    None,
    #[serde(rename = "11a")]
    A,
    #[serde(rename = "11b")]
    B,
    #[serde(rename = "11g")]
    G,
    #[serde(rename = "11n")]
    N,
    #[serde(rename = "11ac")]
    Ac,
    #[serde(rename = "11ax")]
    Ax,
    #[serde(rename = "11be")]
    Be,
    #[serde(rename = "unknown")]
    Unknown,
}

/// Pita frekuensi kanal Wi-Fi (CoreWLAN `CWChannelBand`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub enum WifiBand {
    #[serde(rename = "2.4GHz")]
    Ghz2_4,
    #[serde(rename = "5GHz")]
    Ghz5,
    #[serde(rename = "6GHz")]
    Ghz6,
    #[serde(rename = "unknown")]
    Unknown,
}

/// Mode antarmuka (CoreWLAN `CWInterfaceMode`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WifiInterfaceMode {
    None,
    Station,
    Ibss,
    HostAp,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WifiChannel {
    pub number: Option<u32>,
    pub band: WifiBand,
    pub width_mhz: Option<u32>,
}

/// Status antarmuka Wi-Fi dari CoreWLAN, TANPA pemindaian jaringan.
/// `None` pada nilai sinyal berarti tidak tersambung / tidak dilaporkan.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct WifiStatus {
    /// Nama antarmuka BSD, mis. "en0" (bukan identitas perangkat).
    pub interface_name: Option<String>,
    pub power_on: Option<bool>,
    pub service_active: Option<bool>,
    pub rssi_dbm: Option<i32>,
    pub noise_dbm: Option<i32>,
    pub transmit_rate_mbps: Option<f64>,
    pub phy_mode: Option<WifiPhyMode>,
    pub channel: Option<WifiChannel>,
    pub interface_mode: Option<WifiInterfaceMode>,
}

/// Rute jaringan menurut macOS (`scutil --nwi`). Tidak mengirim lalu lintas
/// jaringan apa pun dan BUKAN uji koneksi internet. Alamat IP dibuang parser.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct NetworkRoute {
    /// Nama antarmuka yang dilaporkan, mis. ["en0"].
    pub interfaces: Vec<String>,
    pub ipv4_reachable: Option<bool>,
    pub ipv6_reachable: Option<bool>,
}

/// Pengontrol Bluetooth (`system_profiler SPBluetoothDataType`).
/// Perangkat hanya dihitung + jenisnya (minor type); tanpa nama dan alamat.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BluetoothInfo {
    pub controller_present: bool,
    pub powered: Option<bool>,
    pub discoverable: Option<bool>,
    pub chipset: Option<String>,
    pub firmware: Option<String>,
    pub transport: Option<String>,
    pub vendor_id: Option<String>,
    pub services: Vec<String>,
    /// Jenis tiap perangkat tersambung, mis. "Headphones" (`None` = tidak dilaporkan).
    pub connected_types: Vec<Option<String>>,
    pub paired_not_connected: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ReceptacleStatus {
    /// Kosong — BUKAN tanda kerusakan.
    Empty,
    Connected,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThunderboltReceptacle {
    pub id: Option<u32>,
    pub status: ReceptacleStatus,
    /// Kecepatan dalam Gb/s; `speed_is_max` = "Up to …" (kemampuan, bukan tautan aktif).
    pub speed_gbps: Option<f64>,
    pub speed_is_max: bool,
    pub link_status: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThunderboltBus {
    pub index: Option<u32>,
    pub receptacles: Vec<ThunderboltReceptacle>,
    /// Jumlah perangkat Thunderbolt yang tersambung di bus ini (tanpa nama).
    pub connected_devices: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbDevice {
    /// `Some(true)` = komponen bawaan (mis. lewat Apple T2), `Some(false)` = eksternal.
    pub built_in: Option<bool>,
    pub link_speed: Option<String>,
    pub power: Option<String>,
    pub vendor_id: Option<String>,
    pub location_id: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsbController {
    /// Versi dari label bus macOS, mis. "3.1" untuk "USB 3.1 Bus".
    pub usb_version: Option<String>,
    pub built_in: Option<bool>,
    /// Bus internal Apple (T2) — berisi komponen bawaan, bukan port fisik.
    pub apple_internal: bool,
    pub location_id: Option<String>,
    pub devices: Vec<UsbDevice>,
}

/// Port USB/Thunderbolt. `None` = bagian itu tidak ada di output macOS.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct PortsInfo {
    pub thunderbolt: Option<Vec<ThunderboltBus>>,
    pub usb: Option<Vec<UsbController>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioTransport {
    BuiltIn,
    Bluetooth,
    Usb,
    Hdmi,
    DisplayPort,
    AirPlay,
    Virtual,
    Unknown,
}

/// Perangkat audio (`system_profiler SPAudioDataType`). Nama hanya diisi untuk
/// perangkat bawaan Apple (mis. "MacBook Pro Speakers"); lainnya hanya transport.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    pub builtin_name: Option<String>,
    pub transport: AudioTransport,
    pub output_channels: Option<u32>,
    pub input_channels: Option<u32>,
    pub default_output: bool,
    pub default_input: bool,
    pub default_system_output: bool,
}

/// Bukti hardware Touch Bar (bukan nama model). `None` = tidak bisa diperiksa.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct TouchBarEvidence {
    /// Perangkat IORegistry "Touch Bar Display" (Intel T1/T2).
    pub display_device: Option<bool>,
    /// Perangkat IORegistry "Touch Bar Backlight" (Intel T1/T2).
    pub backlight_device: Option<bool>,
    /// Proses sistem TouchBarServer sedang berjalan.
    pub server_running: Option<bool>,
}
