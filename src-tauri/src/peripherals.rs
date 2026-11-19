//! Periferal untuk Tes Interaktif (Fase 3): Wi-Fi, Bluetooth, port
//! USB/Thunderbolt, perangkat audio, dan bukti hardware Touch Bar.
//!
//! - Pembacaan ada di `platform` (read-only, tanpa pemindaian/penemuan/pemasangan,
//!   tanpa mengubah pengaturan, tanpa lalu lintas jaringan).
//! - Modul ini hanya merangkum data mentah menjadi laporan IPC (camelCase) dengan
//!   status yang bisa dites tanpa hardware. Hasil Lulus/Gagal tes interaktif
//!   diputuskan frontend (`src/lib/interactive/{wifi,bluetooth,ports}.ts`).
//! - Laporan TIDAK PERNAH memuat SSID/BSSID, alamat MAC/BD/IP, nomor seri, UID,
//!   atau nama perangkat Bluetooth/USB.
//! - Uji koneksi internet aktif TIDAK diimplementasikan (aturan offline proyek);
//!   statusnya selalu `awaitingOwnerDecision`.

use serde::Serialize;

use crate::diagnostics::raw::{
    AudioDevice, BluetoothInfo, NetworkRoute, PortsInfo, ThunderboltBus, TouchBarEvidence,
    UsbController, WifiBand, WifiInterfaceMode, WifiPhyMode, WifiStatus,
};
use crate::platform::{Current, Platform, ProbeError};

// --- Wi-Fi ---------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WifiState {
    /// CoreWLAN tidak menemukan antarmuka Wi-Fi.
    NoInterface,
    /// Wi-Fi dimatikan pengguna (aplikasi tidak pernah menyalakannya).
    PoweredOff,
    NotConnected,
    Connected,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RouteState {
    /// macOS melaporkan ada rute jaringan (BUKAN bukti akses internet).
    Reported,
    NotReported,
    Unknown,
}

/// Uji internet aktif menunggu keputusan pemilik; tidak ada kode jaringan.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InternetTest {
    AwaitingOwnerDecision,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteReport {
    pub state: RouteState,
    pub interface_count: u32,
    /// Antarmuka Wi-Fi termasuk yang dilaporkan punya rute? `None` = tidak diketahui.
    pub wifi_interface_listed: Option<bool>,
    pub ipv4: Option<bool>,
    pub ipv6: Option<bool>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WifiReport {
    pub state: WifiState,
    pub interface_name: Option<String>,
    pub power_on: Option<bool>,
    pub service_active: Option<bool>,
    pub rssi_dbm: Option<i32>,
    pub noise_dbm: Option<i32>,
    /// Selisih RSSI − noise (dB), bila keduanya tersedia.
    pub snr_db: Option<i32>,
    pub transmit_rate_mbps: Option<f64>,
    pub phy_mode: Option<WifiPhyMode>,
    pub channel_number: Option<u32>,
    pub channel_band: Option<WifiBand>,
    pub channel_width_mhz: Option<u32>,
    pub interface_mode: Option<WifiInterfaceMode>,
    /// Kendala teknis pembacaan (tidak diterjemahkan).
    pub error: Option<String>,
    pub route: RouteReport,
    pub internet_test: InternetTest,
}

pub fn wifi_state(status: Option<&WifiStatus>) -> WifiState {
    match status {
        None => WifiState::NoInterface,
        Some(s) => match s.power_on {
            Some(false) => WifiState::PoweredOff,
            None => WifiState::Unknown,
            Some(true) if s.rssi_dbm.is_some() => WifiState::Connected,
            Some(true) => WifiState::NotConnected,
        },
    }
}

pub fn snr_db(rssi: Option<i32>, noise: Option<i32>) -> Option<i32> {
    match (rssi, noise) {
        (Some(r), Some(n)) if r > n => Some(r - n),
        _ => None,
    }
}

pub fn route_report(
    route: Result<NetworkRoute, ProbeError>,
    wifi_name: Option<&str>,
) -> RouteReport {
    match route {
        Err(e) => RouteReport {
            state: RouteState::Unknown,
            interface_count: 0,
            wifi_interface_listed: None,
            ipv4: None,
            ipv6: None,
            error: Some(e.to_string()),
        },
        Ok(r) => {
            let state = match (r.ipv4_reachable, r.ipv6_reachable) {
                (Some(true), _) | (_, Some(true)) => RouteState::Reported,
                (None, None) => RouteState::Unknown,
                _ => RouteState::NotReported,
            };
            RouteReport {
                state,
                interface_count: u32::try_from(r.interfaces.len()).unwrap_or(u32::MAX),
                wifi_interface_listed: wifi_name.map(|n| r.interfaces.iter().any(|i| i == n)),
                ipv4: r.ipv4_reachable,
                ipv6: r.ipv6_reachable,
                error: None,
            }
        }
    }
}

pub fn wifi_report(
    wifi: Result<Option<WifiStatus>, ProbeError>,
    route: Result<NetworkRoute, ProbeError>,
) -> WifiReport {
    let (status, state, error) = match wifi {
        Ok(status) => {
            let state = wifi_state(status.as_ref());
            (status, state, None)
        }
        Err(e) => (None, WifiState::Unknown, Some(e.to_string())),
    };
    let s = status.unwrap_or_default();
    let route = route_report(route, s.interface_name.as_deref());
    WifiReport {
        state,
        snr_db: snr_db(s.rssi_dbm, s.noise_dbm),
        channel_number: s.channel.and_then(|c| c.number),
        channel_band: s.channel.map(|c| c.band),
        channel_width_mhz: s.channel.and_then(|c| c.width_mhz),
        interface_name: s.interface_name,
        power_on: s.power_on,
        service_active: s.service_active,
        rssi_dbm: s.rssi_dbm,
        noise_dbm: s.noise_dbm,
        transmit_rate_mbps: s.transmit_rate_mbps,
        phy_mode: s.phy_mode,
        interface_mode: s.interface_mode,
        error,
        route,
        internet_test: InternetTest::AwaitingOwnerDecision,
    }
}

pub fn wifi_status<P: Platform>() -> WifiReport {
    wifi_report(P::wifi(), P::network_route())
}

// --- Bluetooth -----------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BluetoothState {
    NoController,
    On,
    /// Dimatikan pengguna (aplikasi tidak pernah menyalakannya).
    Off,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BluetoothReport {
    pub state: BluetoothState,
    pub chipset: Option<String>,
    pub firmware: Option<String>,
    pub transport: Option<String>,
    pub vendor_id: Option<String>,
    pub discoverable: Option<bool>,
    pub services: Vec<String>,
    pub connected_count: u32,
    /// Jenis perangkat tersambung saja (mis. "Headphones"); `null` = tidak dilaporkan.
    pub connected_types: Vec<Option<String>>,
    pub paired_not_connected: u32,
    pub error: Option<String>,
}

pub fn bluetooth_state(info: &BluetoothInfo) -> BluetoothState {
    match (info.controller_present, info.powered) {
        (false, _) => BluetoothState::NoController,
        (true, Some(true)) => BluetoothState::On,
        (true, Some(false)) => BluetoothState::Off,
        (true, None) => BluetoothState::Unknown,
    }
}

pub fn bluetooth_report(info: Result<BluetoothInfo, ProbeError>) -> BluetoothReport {
    let (info, state, error) = match info {
        Ok(info) => {
            let state = bluetooth_state(&info);
            (info, state, None)
        }
        Err(e) => (
            BluetoothInfo::default(),
            BluetoothState::Unknown,
            Some(e.to_string()),
        ),
    };
    BluetoothReport {
        state,
        connected_count: u32::try_from(info.connected_types.len()).unwrap_or(u32::MAX),
        chipset: info.chipset,
        firmware: info.firmware,
        transport: info.transport,
        vendor_id: info.vendor_id,
        discoverable: info.discoverable,
        services: info.services,
        connected_types: info.connected_types,
        paired_not_connected: info.paired_not_connected,
        error,
    }
}

pub fn bluetooth_status<P: Platform>() -> BluetoothReport {
    bluetooth_report(P::bluetooth())
}

// --- Port USB/Thunderbolt --------------------------------------------------------

/// Potret port saat ini. Frontend membandingkan dua potret (sebelum/sesudah
/// pengguna memasang perangkat) untuk tes port manual.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortsSnapshot {
    pub thunderbolt: Vec<ThunderboltBus>,
    pub usb: Vec<UsbController>,
    /// Bagian Thunderbolt/USB ada di output macOS?
    pub thunderbolt_available: bool,
    pub usb_available: bool,
    pub receptacle_count: u32,
    /// Perangkat USB eksternal (bukan komponen bawaan/T2).
    pub external_usb_devices: u32,
    pub error: Option<String>,
}

pub fn external_usb_count(usb: &[UsbController]) -> u32 {
    let n = usb
        .iter()
        .filter(|c| !c.apple_internal)
        .flat_map(|c| &c.devices)
        .filter(|d| d.built_in != Some(true))
        .count();
    u32::try_from(n).unwrap_or(u32::MAX)
}

pub fn ports_snapshot_from(info: Result<PortsInfo, ProbeError>) -> PortsSnapshot {
    match info {
        Err(e) => PortsSnapshot {
            thunderbolt: Vec::new(),
            usb: Vec::new(),
            thunderbolt_available: false,
            usb_available: false,
            receptacle_count: 0,
            external_usb_devices: 0,
            error: Some(e.to_string()),
        },
        Ok(p) => {
            let thunderbolt_available = p.thunderbolt.is_some();
            let usb_available = p.usb.is_some();
            let thunderbolt = p.thunderbolt.unwrap_or_default();
            let usb = p.usb.unwrap_or_default();
            let receptacles: usize = thunderbolt.iter().map(|b| b.receptacles.len()).sum();
            PortsSnapshot {
                receptacle_count: u32::try_from(receptacles).unwrap_or(u32::MAX),
                external_usb_devices: external_usb_count(&usb),
                thunderbolt,
                usb,
                thunderbolt_available,
                usb_available,
                error: None,
            }
        }
    }
}

pub fn ports_snapshot<P: Platform>() -> PortsSnapshot {
    ports_snapshot_from(P::ports())
}

// --- Audio (dipakai Tes Speaker) ---------------------------------------------------

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputs {
    /// Perangkat keluaran default menurut macOS.
    pub default_output: Option<AudioDevice>,
    /// Ada keluaran bawaan (speaker/jack internal)? `None` = tidak terbaca.
    pub builtin_output_present: Option<bool>,
    /// Nama keluaran bawaan Apple saja, mis. "MacBook Pro Speakers".
    pub builtin_output_names: Vec<String>,
    /// Semua perangkat yang punya kanal keluaran.
    pub outputs: Vec<AudioDevice>,
    pub error: Option<String>,
}

pub fn audio_outputs_from(devices: Result<Vec<AudioDevice>, ProbeError>) -> AudioOutputs {
    match devices {
        Err(e) => AudioOutputs {
            default_output: None,
            builtin_output_present: None,
            builtin_output_names: Vec::new(),
            outputs: Vec::new(),
            error: Some(e.to_string()),
        },
        Ok(devices) => {
            let outputs: Vec<AudioDevice> = devices
                .into_iter()
                .filter(|d| d.output_channels.is_some() || d.default_output)
                .collect();
            let builtin: Vec<&AudioDevice> = outputs
                .iter()
                .filter(|d| d.transport == crate::diagnostics::raw::AudioTransport::BuiltIn)
                .collect();
            AudioOutputs {
                default_output: outputs.iter().find(|d| d.default_output).cloned(),
                builtin_output_present: Some(!builtin.is_empty()),
                builtin_output_names: builtin
                    .iter()
                    .filter_map(|d| d.builtin_name.clone())
                    .collect(),
                outputs,
                error: None,
            }
        }
    }
}

pub fn audio_outputs<P: Platform>() -> AudioOutputs {
    audio_outputs_from(P::audio_devices())
}

// --- Touch Bar -------------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Presence {
    Present,
    Absent,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TouchBarSignal {
    /// IORegistry "Touch Bar Display" (Intel T1/T2).
    UsbDisplayDevice,
    /// IORegistry "Touch Bar Backlight" (Intel T1/T2).
    UsbBacklightDevice,
    /// Proses sistem TouchBarServer berjalan.
    TouchBarServerRunning,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TouchBarPresence {
    pub presence: Presence,
    pub evidence: Vec<TouchBarSignal>,
    /// Belum terverifikasi di hardware asli (Apple Silicon, atau hanya bukti proses):
    /// hanya informasi.
    pub experimental: bool,
    pub error: Option<String>,
}

pub fn touch_bar_presence_from(
    evidence: Result<TouchBarEvidence, ProbeError>,
    apple_silicon: bool,
) -> TouchBarPresence {
    let e = match evidence {
        Ok(e) => e,
        Err(err) => {
            return TouchBarPresence {
                presence: Presence::Unknown,
                evidence: Vec::new(),
                experimental: apple_silicon,
                error: Some(err.to_string()),
            };
        }
    };
    let signals: Vec<TouchBarSignal> = [
        (e.display_device, TouchBarSignal::UsbDisplayDevice),
        (e.backlight_device, TouchBarSignal::UsbBacklightDevice),
        (e.server_running, TouchBarSignal::TouchBarServerRunning),
    ]
    .into_iter()
    .filter(|(found, _)| *found == Some(true))
    .map(|(_, s)| s)
    .collect();
    let all_checked_absent = [e.display_device, e.backlight_device, e.server_running]
        .iter()
        .all(|v| *v == Some(false));
    let presence = if !signals.is_empty() {
        Presence::Present
    } else if all_checked_absent {
        Presence::Absent
    } else {
        Presence::Unknown
    };
    let only_process = signals == [TouchBarSignal::TouchBarServerRunning];
    TouchBarPresence {
        presence,
        evidence: signals,
        experimental: apple_silicon || only_process,
        error: None,
    }
}

pub fn touch_bar_presence<P: Platform>() -> TouchBarPresence {
    touch_bar_presence_from(P::touch_bar(), cfg!(target_arch = "aarch64"))
}

// --- Command Tauri ---------------------------------------------------------------

/// Hanya nama command yang dicatat — tidak pernah datanya.
fn trace(_command: &str) {
    #[cfg(debug_assertions)]
    eprintln!("[ipc] {_command}");
}

async fn blocking<T: Send + 'static>(work: fn() -> T) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|e| e.to_string())
}

/// Status Wi-Fi (CoreWLAN, tanpa pemindaian) + rute jaringan macOS.
#[tauri::command]
pub async fn get_wifi_status() -> Result<WifiReport, String> {
    trace("get_wifi_status");
    blocking(wifi_status::<Current>).await
}

#[tauri::command]
pub async fn get_bluetooth_status() -> Result<BluetoothReport, String> {
    trace("get_bluetooth_status");
    blocking(bluetooth_status::<Current>).await
}

#[tauri::command]
pub async fn get_ports_snapshot() -> Result<PortsSnapshot, String> {
    trace("get_ports_snapshot");
    blocking(ports_snapshot::<Current>).await
}

#[tauri::command]
pub async fn get_audio_outputs() -> Result<AudioOutputs, String> {
    trace("get_audio_outputs");
    blocking(audio_outputs::<Current>).await
}

#[tauri::command]
pub async fn get_touch_bar_presence() -> Result<TouchBarPresence, String> {
    trace("get_touch_bar_presence");
    blocking(touch_bar_presence::<Current>).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::raw::{
        AudioTransport, ReceptacleStatus, ThunderboltReceptacle, UsbDevice, WifiChannel,
    };
    use crate::platform::fake::{Failing, Healthy};

    fn err<T>() -> Result<T, ProbeError> {
        Err(ProbeError::new("uji gagal"))
    }

    fn on(rssi: Option<i32>) -> WifiStatus {
        WifiStatus {
            interface_name: Some("en0".into()),
            power_on: Some(true),
            rssi_dbm: rssi,
            ..Default::default()
        }
    }

    // --- Wi-Fi

    #[test]
    fn wifi_state_branches() {
        assert_eq!(wifi_state(None), WifiState::NoInterface);
        let mut off = on(None);
        off.power_on = Some(false);
        assert_eq!(wifi_state(Some(&off)), WifiState::PoweredOff);
        let mut unknown = on(None);
        unknown.power_on = None;
        assert_eq!(wifi_state(Some(&unknown)), WifiState::Unknown);
        assert_eq!(wifi_state(Some(&on(None))), WifiState::NotConnected);
        assert_eq!(wifi_state(Some(&on(Some(-60)))), WifiState::Connected);
    }

    #[test]
    fn snr_requires_both_and_positive_margin() {
        assert_eq!(snr_db(Some(-55), Some(-90)), Some(35));
        assert_eq!(snr_db(Some(-90), Some(-90)), None);
        assert_eq!(snr_db(Some(-55), None), None);
        assert_eq!(snr_db(None, Some(-90)), None);
    }

    #[test]
    fn route_branches() {
        let route = |v4, v6, ifs: &[&str]| NetworkRoute {
            interfaces: ifs.iter().map(|s| s.to_string()).collect(),
            ipv4_reachable: v4,
            ipv6_reachable: v6,
        };
        let r = route_report(Ok(route(Some(true), Some(false), &["en0"])), Some("en0"));
        assert_eq!(r.state, RouteState::Reported);
        assert_eq!(r.wifi_interface_listed, Some(true));
        assert_eq!(r.interface_count, 1);
        let r = route_report(Ok(route(Some(false), Some(true), &["en5"])), Some("en0"));
        assert_eq!(r.state, RouteState::Reported);
        assert_eq!(r.wifi_interface_listed, Some(false));
        let r = route_report(Ok(route(Some(false), None, &[])), None);
        assert_eq!(r.state, RouteState::NotReported);
        assert_eq!(r.wifi_interface_listed, None);
        assert_eq!(
            route_report(Ok(route(None, None, &[])), None).state,
            RouteState::Unknown
        );
        let r = route_report(err(), Some("en0"));
        assert_eq!(r.state, RouteState::Unknown);
        assert!(r.error.is_some());
    }

    #[test]
    fn wifi_report_from_fake_platforms() {
        let r = wifi_status::<Healthy>();
        assert_eq!(r.state, WifiState::Connected);
        assert_eq!(r.snr_db, Some(35));
        assert_eq!(r.channel_number, Some(36));
        assert_eq!(r.channel_band, Some(WifiBand::Ghz5));
        assert_eq!(r.channel_width_mhz, Some(80));
        assert_eq!(r.route.state, RouteState::Reported);
        assert_eq!(r.internet_test, InternetTest::AwaitingOwnerDecision);

        let f = wifi_status::<Failing>();
        assert_eq!(f.state, WifiState::Unknown, "gagal baca ≠ tidak ada Wi-Fi");
        assert!(f.error.is_some());
        assert_eq!(f.route.state, RouteState::Unknown);
    }

    #[test]
    fn wifi_report_without_interface_or_channel() {
        let r = wifi_report(Ok(None), err());
        assert_eq!(r.state, WifiState::NoInterface);
        assert_eq!(r.error, None);
        let mut s = on(Some(-70));
        s.channel = Some(WifiChannel {
            number: None,
            band: WifiBand::Unknown,
            width_mhz: None,
        });
        let r = wifi_report(Ok(Some(s)), err());
        assert_eq!(r.channel_band, Some(WifiBand::Unknown));
        assert_eq!(r.channel_number, None);
    }

    // --- Bluetooth

    #[test]
    fn bluetooth_state_branches() {
        let mut info = BluetoothInfo::default();
        assert_eq!(bluetooth_state(&info), BluetoothState::NoController);
        info.controller_present = true;
        assert_eq!(bluetooth_state(&info), BluetoothState::Unknown);
        info.powered = Some(false);
        assert_eq!(bluetooth_state(&info), BluetoothState::Off);
        info.powered = Some(true);
        assert_eq!(bluetooth_state(&info), BluetoothState::On);
    }

    #[test]
    fn bluetooth_report_counts_devices() {
        let r = bluetooth_status::<Healthy>();
        assert_eq!(r.state, BluetoothState::On);
        assert_eq!(r.connected_count, 2);
        assert_eq!(
            r.connected_types,
            vec![Some("Headphones".to_string()), None]
        );
        assert_eq!(r.paired_not_connected, 2);
        let f = bluetooth_status::<Failing>();
        assert_eq!(f.state, BluetoothState::Unknown);
        assert!(f.error.is_some());
    }

    // --- Port

    #[test]
    fn ports_snapshot_counts_and_errors() {
        let s = ports_snapshot::<Healthy>();
        assert!(s.thunderbolt_available && s.usb_available);
        assert_eq!(s.receptacle_count, 2);
        assert_eq!(
            s.external_usb_devices, 1,
            "perangkat T2 tidak dihitung eksternal"
        );
        let f = ports_snapshot::<Failing>();
        assert_eq!(f.receptacle_count, 0);
        assert!(!f.thunderbolt_available && f.error.is_some());
        let partial = ports_snapshot_from(Ok(PortsInfo {
            thunderbolt: None,
            usb: Some(vec![]),
        }));
        assert!(!partial.thunderbolt_available && partial.usb_available);
    }

    #[test]
    fn external_count_ignores_builtin_and_t2() {
        let dev = |built_in| UsbDevice {
            built_in,
            link_speed: None,
            power: None,
            vendor_id: None,
            location_id: None,
        };
        let ctrl = |apple_internal, devices| UsbController {
            usb_version: None,
            built_in: Some(true),
            apple_internal,
            location_id: None,
            devices,
        };
        let usb = vec![
            ctrl(false, vec![dev(Some(false)), dev(None), dev(Some(true))]),
            ctrl(true, vec![dev(None)]),
        ];
        assert_eq!(external_usb_count(&usb), 2);
    }

    // --- Audio

    #[test]
    fn audio_outputs_branches() {
        let a = audio_outputs::<Healthy>();
        assert_eq!(a.builtin_output_present, Some(true));
        assert_eq!(a.builtin_output_names, ["Speaker Uji"]);
        assert_eq!(a.default_output.unwrap().transport, AudioTransport::BuiltIn);
        assert_eq!(a.outputs.len(), 2);
        let f = audio_outputs::<Failing>();
        assert_eq!(
            f.builtin_output_present, None,
            "gagal baca ≠ tidak ada speaker"
        );
        let none = audio_outputs_from(Ok(vec![]));
        assert_eq!(none.builtin_output_present, Some(false));
        assert_eq!(none.default_output, None);
    }

    // --- Touch Bar

    fn tb(
        display: Option<bool>,
        backlight: Option<bool>,
        server: Option<bool>,
    ) -> TouchBarEvidence {
        TouchBarEvidence {
            display_device: display,
            backlight_device: backlight,
            server_running: server,
        }
    }

    #[test]
    fn touch_bar_branches() {
        let p = touch_bar_presence_from(Ok(tb(Some(true), Some(true), Some(true))), false);
        assert_eq!(p.presence, Presence::Present);
        assert_eq!(p.evidence.len(), 3);
        assert!(!p.experimental);

        let p = touch_bar_presence_from(Ok(tb(Some(false), Some(false), Some(true))), false);
        assert_eq!(p.presence, Presence::Present);
        assert!(p.experimental, "hanya bukti proses = eksperimental");

        let p = touch_bar_presence_from(Ok(tb(Some(false), Some(false), Some(false))), false);
        assert_eq!(p.presence, Presence::Absent);
        assert!(p.evidence.is_empty());

        let p = touch_bar_presence_from(Ok(tb(Some(false), Some(false), None)), false);
        assert_eq!(
            p.presence,
            Presence::Unknown,
            "sumber tidak lengkap ≠ tidak ada"
        );

        let p = touch_bar_presence_from(Ok(tb(Some(false), Some(false), Some(false))), true);
        assert_eq!(p.presence, Presence::Absent);
        assert!(p.experimental, "Apple Silicon belum diverifikasi");

        let p = touch_bar_presence_from(err(), false);
        assert_eq!(p.presence, Presence::Unknown);
        assert!(p.error.is_some());
        assert_eq!(touch_bar_presence::<Healthy>().presence, Presence::Present);
    }

    // --- Kontrak IPC & privasi

    #[test]
    fn serializes_camel_case_for_frontend() {
        let w = serde_json::to_value(wifi_status::<Healthy>()).unwrap();
        assert_eq!(w["state"], "connected");
        assert_eq!(w["rssiDbm"], -55);
        assert_eq!(w["phyMode"], "11ac");
        assert_eq!(w["channelBand"], "5GHz");
        assert_eq!(w["interfaceMode"], "station");
        assert_eq!(w["internetTest"], "awaitingOwnerDecision");
        assert_eq!(w["route"]["wifiInterfaceListed"], true);

        let b = serde_json::to_value(bluetooth_status::<Healthy>()).unwrap();
        assert_eq!(b["state"], "on");
        assert_eq!(b["pairedNotConnected"], 2);

        let p = serde_json::to_value(ports_snapshot::<Healthy>()).unwrap();
        assert_eq!(p["receptacleCount"], 2);
        assert_eq!(p["thunderbolt"][0]["receptacles"][0]["status"], "empty");
        assert_eq!(p["thunderbolt"][0]["receptacles"][0]["speedIsMax"], true);
        assert_eq!(p["usb"][0]["devices"][0]["builtIn"], false);
        assert_eq!(p["usb"][0]["usbVersion"], "3.1");
        assert_eq!(p["usb"][1]["appleInternal"], true);

        let a = serde_json::to_value(audio_outputs::<Healthy>()).unwrap();
        assert_eq!(a["defaultOutput"]["transport"], "builtIn");
        assert_eq!(a["builtinOutputPresent"], true);

        let t = serde_json::to_value(touch_bar_presence::<Healthy>()).unwrap();
        assert_eq!(t["presence"], "present");
        assert_eq!(t["evidence"][2], "touchBarServerRunning");

        let r = serde_json::to_value(ThunderboltReceptacle {
            id: None,
            status: ReceptacleStatus::Connected,
            speed_gbps: None,
            speed_is_max: false,
            link_status: None,
        })
        .unwrap();
        assert_eq!(r["status"], "connected");
    }

    fn keys(value: &serde_json::Value, out: &mut Vec<String>) {
        match value {
            serde_json::Value::Object(map) => {
                for (k, v) in map {
                    out.push(k.to_ascii_lowercase());
                    keys(v, out);
                }
            }
            serde_json::Value::Array(items) => items.iter().for_each(|v| keys(v, out)),
            _ => {}
        }
    }

    #[test]
    fn reports_carry_no_identity_fields() {
        let mut all = Vec::new();
        for value in [
            serde_json::to_value(wifi_status::<Healthy>()).unwrap(),
            serde_json::to_value(bluetooth_status::<Healthy>()).unwrap(),
            serde_json::to_value(ports_snapshot::<Healthy>()).unwrap(),
            serde_json::to_value(audio_outputs::<Healthy>()).unwrap(),
            serde_json::to_value(touch_bar_presence::<Healthy>()).unwrap(),
        ] {
            keys(&value, &mut all);
        }
        assert!(all.len() > 40, "kunci terbaca: {}", all.len());
        for key in &all {
            let forbidden = key.starts_with("ssid")
                || key.starts_with("bssid")
                || key.contains("serial")
                || key.contains("address")
                || key.contains("uuid")
                || key == "uid"
                || key.ends_with("_uid")
                || key == "name"
                || key == "devicename";
            assert!(!forbidden, "field terlarang: {key}");
        }
    }

    /// Integrasi ringan di Mac asli: cetak laporan yang sudah tersaring.
    /// `cargo test real_peripherals -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_peripherals_report() {
        let print = |label: &str, json: String| println!("{label}: {json}");
        print(
            "wifi",
            serde_json::to_string_pretty(&wifi_status::<Current>()).unwrap(),
        );
        print(
            "bluetooth",
            serde_json::to_string_pretty(&bluetooth_status::<Current>()).unwrap(),
        );
        print(
            "ports",
            serde_json::to_string_pretty(&ports_snapshot::<Current>()).unwrap(),
        );
        print(
            "audio",
            serde_json::to_string_pretty(&audio_outputs::<Current>()).unwrap(),
        );
        print(
            "touchBar",
            serde_json::to_string_pretty(&touch_bar_presence::<Current>()).unwrap(),
        );
    }
}
