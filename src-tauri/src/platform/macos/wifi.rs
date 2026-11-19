//! Wi-Fi: status antarmuka lewat CoreWLAN + rute jaringan dari `scutil --nwi`.
//!
//! Privasi & keamanan (wajib):
//! - TIDAK memanggil `ssid`, `bssid`, `hardwareAddress`, maupun `scan*`:
//!   tidak ada pemindaian jaringan sekitar dan tidak ada identitas jaringan.
//! - Tidak mengubah status Wi-Fi (tanpa `setPower:` atau sejenisnya).
//! - `scutil --nwi` hanya membaca tabel rute macOS (tanpa lalu lintas jaringan);
//!   alamat IP di output langsung dibuang parser.
//!
//! Kode Objective-C dibatasi di [`corewlan`]; hasil mentahnya ([`CwValues`])
//! dipetakan oleh fungsi murni [`map_values`] yang bisa dites tanpa hardware.

use super::bin::SCUTIL;
use super::command::run;
use crate::diagnostics::raw::{
    NetworkRoute, WifiBand, WifiChannel, WifiInterfaceMode, WifiPhyMode, WifiStatus,
};
use crate::platform::ProbeError;

/// Nilai mentah dari `CWInterface` (sebelum dinormalisasi).
#[derive(Debug, Clone, Default, PartialEq)]
pub struct CwValues {
    pub interface_name: Option<String>,
    pub power_on: Option<bool>,
    pub service_active: Option<bool>,
    pub rssi: Option<isize>,
    pub noise: Option<isize>,
    pub transmit_rate: Option<f64>,
    pub phy_mode: Option<isize>,
    /// `None` = `wlanChannel` bernilai nil (umumnya tidak tersambung).
    pub channel: Option<CwChannel>,
    pub interface_mode: Option<isize>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct CwChannel {
    pub number: Option<isize>,
    pub band: Option<isize>,
    pub width: Option<isize>,
}

/// `Ok(None)` = CoreWLAN tidak menemukan antarmuka Wi-Fi.
pub fn probe() -> Result<Option<WifiStatus>, ProbeError> {
    Ok(corewlan::read()?.map(map_values))
}

pub fn probe_route() -> Result<NetworkRoute, ProbeError> {
    Ok(parse_nwi(&run(SCUTIL, &["--nwi"])?))
}

// --- Pemetaan murni ------------------------------------------------------------

/// RSSI/noise di luar rentang ini dianggap tidak dilaporkan (CoreWLAN memberi 0
/// saat tidak tersambung).
const MIN_DBM: isize = -120;

fn dbm(value: Option<isize>) -> Option<i32> {
    value
        .filter(|v| (MIN_DBM..0).contains(v))
        .and_then(|v| i32::try_from(v).ok())
}

fn positive_u32(value: Option<isize>) -> Option<u32> {
    value.filter(|v| *v > 0).and_then(|v| u32::try_from(v).ok())
}

pub fn map_values(v: CwValues) -> WifiStatus {
    WifiStatus {
        interface_name: v
            .interface_name
            .map(|n| n.trim().to_string())
            .filter(|n| is_bsd_interface_name(n)),
        power_on: v.power_on,
        service_active: v.service_active,
        rssi_dbm: dbm(v.rssi),
        noise_dbm: dbm(v.noise),
        transmit_rate_mbps: v.transmit_rate.filter(|r| r.is_finite() && *r > 0.0),
        phy_mode: v.phy_mode.map(phy_mode),
        channel: v.channel.map(|c| WifiChannel {
            number: positive_u32(c.number),
            band: c.band.map_or(WifiBand::Unknown, band),
            width_mhz: c.width.and_then(width_mhz),
        }),
        interface_mode: v.interface_mode.map(interface_mode),
    }
}

/// `CWPHYMode`.
pub fn phy_mode(code: isize) -> WifiPhyMode {
    match code {
        0 => WifiPhyMode::None,
        1 => WifiPhyMode::A,
        2 => WifiPhyMode::B,
        3 => WifiPhyMode::G,
        4 => WifiPhyMode::N,
        5 => WifiPhyMode::Ac,
        6 => WifiPhyMode::Ax,
        7 => WifiPhyMode::Be,
        _ => WifiPhyMode::Unknown,
    }
}

/// `CWChannelBand`.
pub fn band(code: isize) -> WifiBand {
    match code {
        1 => WifiBand::Ghz2_4,
        2 => WifiBand::Ghz5,
        3 => WifiBand::Ghz6,
        _ => WifiBand::Unknown,
    }
}

/// `CWChannelWidth` → MHz. Kode yang tidak dikenal = tidak diketahui.
pub fn width_mhz(code: isize) -> Option<u32> {
    match code {
        1 => Some(20),
        2 => Some(40),
        3 => Some(80),
        4 => Some(160),
        _ => None,
    }
}

/// `CWInterfaceMode`.
pub fn interface_mode(code: isize) -> WifiInterfaceMode {
    match code {
        0 => WifiInterfaceMode::None,
        1 => WifiInterfaceMode::Station,
        2 => WifiInterfaceMode::Ibss,
        3 => WifiInterfaceMode::HostAp,
        _ => WifiInterfaceMode::Unknown,
    }
}

/// Nama antarmuka BSD yang wajar, mis. "en0", "utun3", "bridge100".
fn is_bsd_interface_name(name: &str) -> bool {
    let letters = name.trim_end_matches(|c: char| c.is_ascii_digit());
    !letters.is_empty() && name.len() <= 16 && letters.chars().all(|c| c.is_ascii_lowercase())
}

// --- scutil --nwi -------------------------------------------------------------

/// Hanya membaca daftar "Network interfaces" dan flag REACH per keluarga IP.
/// Baris alamat (IP) diabaikan sepenuhnya.
pub fn parse_nwi(text: &str) -> NetworkRoute {
    #[derive(Clone, Copy)]
    enum Family {
        V4,
        V6,
    }
    let mut route = NetworkRoute::default();
    let mut family = None;
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("IPv4 network interface information") {
            family = Some(Family::V4);
        } else if trimmed.starts_with("IPv6 network interface information") {
            family = Some(Family::V6);
        } else if let Some(rest) = trimmed.strip_prefix("REACH :") {
            let reachable = reach_flags(rest).map(|f| f & 0x2 != 0);
            match family {
                Some(Family::V4) => route.ipv4_reachable = reachable,
                Some(Family::V6) => route.ipv6_reachable = reachable,
                None => {}
            }
        } else if let Some(rest) = trimmed.strip_prefix("Network interfaces:") {
            route.interfaces = rest
                .split_whitespace()
                .filter(|n| is_bsd_interface_name(n))
                .map(str::to_string)
                .collect();
        }
    }
    route
}

/// "flags 0x00000002 (Reachable)" -> 2.
fn reach_flags(text: &str) -> Option<u32> {
    let hex = text
        .trim()
        .strip_prefix("flags")?
        .split_whitespace()
        .next()?;
    u32::from_str_radix(hex.trim_start_matches("0x"), 16).ok()
}

// --- CoreWLAN (Objective-C) ------------------------------------------------------

mod corewlan {
    use objc2::rc::{Retained, autoreleasepool};
    use objc2::runtime::{AnyClass, AnyObject, Sel};
    use objc2::{msg_send, sel};
    use objc2_foundation::NSString;

    use super::{CwChannel, CwValues};
    use crate::platform::ProbeError;

    // Hanya memuat framework; kelas diambil lewat runtime Objective-C.
    #[link(name = "CoreWLAN", kind = "framework")]
    unsafe extern "C" {}

    /// Selector dicek dulu agar versi macOS lain tidak memicu exception
    /// "unrecognized selector" (yang akan menghentikan aplikasi).
    fn responds(obj: &AnyObject, selector: Sel) -> bool {
        // SAFETY: `respondsToSelector:` ada di semua NSObject dan mengembalikan BOOL.
        unsafe { msg_send![obj, respondsToSelector: selector] }
    }

    /// Getter tanpa argumen, hanya bila objek meresponsnya.
    macro_rules! getter {
        ($obj:expr, $name:ident -> $ty:ty) => {
            if responds($obj, sel!($name)) {
                // SAFETY: selector getter tanpa argumen yang sudah dicek ada;
                // tipe kembalian sesuai deklarasi CoreWLAN (BOOL/NSInteger/double/objek nullable).
                let value: $ty = unsafe { msg_send![$obj, $name] };
                Some(value)
            } else {
                None
            }
        };
    }

    pub fn read() -> Result<Option<CwValues>, ProbeError> {
        autoreleasepool(|_| read_inner())
    }

    fn read_inner() -> Result<Option<CwValues>, ProbeError> {
        let class = AnyClass::get(c"CWWiFiClient")
            .ok_or_else(|| ProbeError::new("CoreWLAN: kelas CWWiFiClient tidak tersedia"))?;
        // SAFETY: class method `+sharedWiFiClient` (CoreWLAN, macOS 10.10+) mengembalikan objek atau nil.
        let client: Option<Retained<AnyObject>> = unsafe { msg_send![class, sharedWiFiClient] };
        let client =
            client.ok_or_else(|| ProbeError::new("CoreWLAN: sharedWiFiClient bernilai nil"))?;
        let iface: Option<Option<Retained<AnyObject>>> =
            getter!(&*client, interface -> Option<Retained<AnyObject>>);
        let Some(iface) =
            iface.ok_or_else(|| ProbeError::new("CoreWLAN: metode interface tidak tersedia"))?
        else {
            return Ok(None);
        };
        let iface: &AnyObject = &iface;

        let interface_name = getter!(iface, interfaceName -> Option<Retained<NSString>>)
            .flatten()
            .map(|n| n.to_string());
        let channel = getter!(iface, wlanChannel -> Option<Retained<AnyObject>>)
            .flatten()
            .map(|ch| read_channel(&ch));

        Ok(Some(CwValues {
            interface_name,
            power_on: getter!(iface, powerOn -> bool),
            service_active: getter!(iface, serviceActive -> bool),
            rssi: getter!(iface, rssiValue -> isize),
            noise: getter!(iface, noiseMeasurement -> isize),
            transmit_rate: getter!(iface, transmitRate -> f64),
            phy_mode: getter!(iface, activePHYMode -> isize),
            channel,
            interface_mode: getter!(iface, interfaceMode -> isize),
        }))
    }

    fn read_channel(ch: &AnyObject) -> CwChannel {
        CwChannel {
            number: getter!(ch, channelNumber -> isize),
            band: getter!(ch, channelBand -> isize),
            width: getter!(ch, channelWidth -> isize),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn connected_values_are_mapped() {
        let s = map_values(CwValues {
            interface_name: Some("en0".into()),
            power_on: Some(true),
            service_active: Some(true),
            rssi: Some(-55),
            noise: Some(-92),
            transmit_rate: Some(866.0),
            phy_mode: Some(5),
            channel: Some(CwChannel {
                number: Some(44),
                band: Some(2),
                width: Some(3),
            }),
            interface_mode: Some(1),
        });
        assert_eq!(s.interface_name.as_deref(), Some("en0"));
        assert_eq!(s.rssi_dbm, Some(-55));
        assert_eq!(s.noise_dbm, Some(-92));
        assert_eq!(s.transmit_rate_mbps, Some(866.0));
        assert_eq!(s.phy_mode, Some(WifiPhyMode::Ac));
        assert_eq!(
            s.channel,
            Some(WifiChannel {
                number: Some(44),
                band: WifiBand::Ghz5,
                width_mhz: Some(80)
            })
        );
        assert_eq!(s.interface_mode, Some(WifiInterfaceMode::Station));
    }

    #[test]
    fn disconnected_sentinels_become_none() {
        let s = map_values(CwValues {
            interface_name: Some("en0".into()),
            power_on: Some(true),
            rssi: Some(0),
            noise: Some(0),
            transmit_rate: Some(0.0),
            phy_mode: Some(0),
            channel: None,
            ..Default::default()
        });
        assert_eq!(s.rssi_dbm, None);
        assert_eq!(s.noise_dbm, None);
        assert_eq!(s.transmit_rate_mbps, None);
        assert_eq!(s.phy_mode, Some(WifiPhyMode::None));
        assert_eq!(s.channel, None);
    }

    #[test]
    fn rssi_bounds() {
        assert_eq!(dbm(Some(-1)), Some(-1));
        assert_eq!(dbm(Some(-120)), Some(-120));
        assert_eq!(dbm(Some(-121)), None, "di luar rentang wajar");
        assert_eq!(dbm(Some(0)), None);
        assert_eq!(dbm(Some(5)), None);
        assert_eq!(dbm(None), None);
    }

    #[test]
    fn code_tables() {
        assert_eq!(phy_mode(1), WifiPhyMode::A);
        assert_eq!(phy_mode(2), WifiPhyMode::B);
        assert_eq!(phy_mode(3), WifiPhyMode::G);
        assert_eq!(phy_mode(4), WifiPhyMode::N);
        assert_eq!(phy_mode(6), WifiPhyMode::Ax);
        assert_eq!(phy_mode(7), WifiPhyMode::Be);
        assert_eq!(phy_mode(99), WifiPhyMode::Unknown);
        assert_eq!(band(1), WifiBand::Ghz2_4);
        assert_eq!(band(3), WifiBand::Ghz6);
        assert_eq!(band(0), WifiBand::Unknown);
        assert_eq!(width_mhz(1), Some(20));
        assert_eq!(width_mhz(2), Some(40));
        assert_eq!(width_mhz(4), Some(160));
        assert_eq!(width_mhz(0), None);
        assert_eq!(width_mhz(9), None);
        assert_eq!(interface_mode(0), WifiInterfaceMode::None);
        assert_eq!(interface_mode(2), WifiInterfaceMode::Ibss);
        assert_eq!(interface_mode(3), WifiInterfaceMode::HostAp);
        assert_eq!(interface_mode(-1), WifiInterfaceMode::Unknown);
    }

    #[test]
    fn odd_interface_names_are_dropped() {
        let s = map_values(CwValues {
            interface_name: Some("Wi-Fi Rumah".into()),
            ..Default::default()
        });
        assert_eq!(s.interface_name, None);
        assert!(is_bsd_interface_name("en0"));
        assert!(is_bsd_interface_name("bridge100"));
        assert!(!is_bsd_interface_name("0"));
        assert!(!is_bsd_interface_name("EN0"));
    }

    #[test]
    fn parses_real_nwi_fixture_without_addresses() {
        let text = fixture!("scutil_nwi.txt");
        let r = parse_nwi(text);
        assert_eq!(r.interfaces, vec!["en0".to_string()]);
        assert_eq!(r.ipv4_reachable, Some(true));
        assert_eq!(r.ipv6_reachable, Some(true));
        // Fixture sudah disensor; parser memang tidak pernah menyimpan alamat.
        assert!(!format!("{r:?}").contains("address"));
    }

    /// Contoh format tanpa jaringan (BUKAN data perangkat asli).
    #[test]
    fn parses_offline_nwi() {
        let text = "Network information\n\nIPv4 network interface information\n   No IPv4 states found\n\n   REACH : flags 0x00000000 (Not Reachable)\n\nIPv6 network interface information\n   No IPv6 states found\n\n   REACH : flags 0x00000000 (Not Reachable)\n\nNetwork interfaces: n/a\n";
        let r = parse_nwi(text);
        assert!(r.interfaces.is_empty());
        assert_eq!(r.ipv4_reachable, Some(false));
        assert_eq!(r.ipv6_reachable, Some(false));
        assert_eq!(parse_nwi(""), NetworkRoute::default());
    }

    /// Menjalankan CoreWLAN + scutil di Mac asli dan mencetak hasil yang sudah
    /// difilter (tanpa SSID/BSSID/alamat). `cargo test real_wifi -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_wifi_probe() {
        println!("wifi: {:?}", probe());
        println!("route: {:?}", probe_route());
    }
}
