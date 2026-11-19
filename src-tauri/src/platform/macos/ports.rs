//! Port USB/Thunderbolt: `system_profiler -json SPThunderboltDataType SPUSBHostDataType`.
//!
//! Hanya struktur port yang dibaca: bus, receptacle (status/kecepatan), pengontrol,
//! dan perangkat (bawaan vs eksternal, kecepatan tautan, daya, vendor ID,
//! location ID). Nama perangkat, nama vendor, nomor seri, dan UID TIDAK dibaca.
//! Isi penyimpanan eksternal tidak pernah disentuh.

use serde_json::Value;

use super::bin::SYSTEM_PROFILER;
use super::command::run_json;
use super::parse::{json_str, non_empty};
use crate::diagnostics::raw::{
    PortsInfo, ReceptacleStatus, ThunderboltBus, ThunderboltReceptacle, UsbController, UsbDevice,
};
use crate::platform::ProbeError;

pub fn probe() -> Result<PortsInfo, ProbeError> {
    let value = run_json(
        SYSTEM_PROFILER,
        &["-json", "SPThunderboltDataType", "SPUSBHostDataType"],
    )?;
    Ok(parse(&value))
}

pub fn parse(value: &Value) -> PortsInfo {
    PortsInfo {
        thunderbolt: value
            .get("SPThunderboltDataType")
            .and_then(Value::as_array)
            .map(|buses| parse_thunderbolt(buses)),
        usb: value
            .get("SPUSBHostDataType")
            .and_then(Value::as_array)
            .map(|buses| buses.iter().map(parse_usb_controller).collect()),
    }
}

fn parse_thunderbolt(buses: &[Value]) -> Vec<ThunderboltBus> {
    let mut list: Vec<ThunderboltBus> = buses
        .iter()
        .filter(|b| b.is_object())
        .map(|bus| {
            let mut receptacles: Vec<ThunderboltReceptacle> = bus
                .as_object()
                .into_iter()
                .flatten()
                .filter(|(key, _)| key.starts_with("receptacle_") && key.ends_with("_tag"))
                .map(|(_, r)| parse_receptacle(r))
                .collect();
            receptacles.sort_by_key(|r| r.id.unwrap_or(u32::MAX));
            ThunderboltBus {
                index: json_str(bus, "_name").and_then(bus_index),
                receptacles,
                connected_devices: bus
                    .get("_items")
                    .and_then(Value::as_array)
                    .map_or(0, |items| u32::try_from(items.len()).unwrap_or(u32::MAX)),
            }
        })
        .collect();
    list.sort_by_key(|b| b.index.unwrap_or(u32::MAX));
    list
}

fn parse_receptacle(r: &Value) -> ThunderboltReceptacle {
    let (speed_gbps, speed_is_max) = json_str(r, "current_speed_key")
        .and_then(speed_gbps)
        .map_or((None, false), |(v, max)| (Some(v), max));
    ThunderboltReceptacle {
        id: json_str(r, "receptacle_id_key").and_then(|s| s.trim().parse().ok()),
        status: json_str(r, "receptacle_status_key")
            .map_or(ReceptacleStatus::Unknown, receptacle_status),
        speed_gbps,
        speed_is_max,
        link_status: json_str(r, "link_status_key")
            .and_then(non_empty)
            .filter(|s| s.len() <= 16),
    }
}

/// "thunderbolt_bus_1" -> 1.
fn bus_index(name: &str) -> Option<u32> {
    name.strip_prefix("thunderbolt_bus_")?.parse().ok()
}

pub fn receptacle_status(raw: &str) -> ReceptacleStatus {
    match raw.trim() {
        "receptacle_no_devices_connected" => ReceptacleStatus::Empty,
        "receptacle_connected" => ReceptacleStatus::Connected,
        _ => ReceptacleStatus::Unknown,
    }
}

/// "Up to 40 Gb/s" -> (40, true); "20 Gb/s" -> (20, false); "480 Mb/s" -> (0.48, false).
pub fn speed_gbps(raw: &str) -> Option<(f64, bool)> {
    let text = raw.trim();
    let (is_max, rest) = match text.strip_prefix("Up to") {
        Some(rest) => (true, rest.trim()),
        None => (false, text),
    };
    let mut parts = rest.split_whitespace();
    let number: f64 = parts.next()?.replace(',', ".").parse().ok()?;
    let gbps = match parts.next()? {
        "Gb/s" => number,
        "Mb/s" => number / 1000.0,
        _ => return None,
    };
    gbps.is_finite().then_some((gbps, is_max))
}

fn parse_usb_controller(bus: &Value) -> UsbController {
    let name = json_str(bus, "_name").unwrap_or_default();
    let apple_internal = json_str(bus, "Driver") == Some("AppleUSBVHCIBCE") || name.contains("T2");
    let mut devices = Vec::new();
    collect_devices(bus.get("_items"), apple_internal, &mut devices);
    UsbController {
        usb_version: usb_version(name),
        built_in: json_str(bus, "USBKeyHardwareType").and_then(hardware_built_in),
        apple_internal,
        location_id: location_id(bus),
        devices,
    }
}

/// Perangkat (termasuk di balik hub) diratakan; nama tidak dibaca.
fn collect_devices(items: Option<&Value>, apple_internal: bool, out: &mut Vec<UsbDevice>) {
    for item in items.and_then(Value::as_array).into_iter().flatten() {
        if !item.is_object() {
            continue;
        }
        // Semua perangkat di bus internal Apple (T2) adalah komponen bawaan.
        let built_in = if apple_internal {
            Some(true)
        } else {
            json_str(item, "USBKeyHardwareType").and_then(hardware_built_in)
        };
        let text = |key: &str| {
            json_str(item, key)
                .and_then(non_empty)
                .filter(|t| t.len() <= 32)
        };
        out.push(UsbDevice {
            built_in,
            link_speed: text("USBDeviceKeyLinkSpeed"),
            power: text("USBDeviceKeyPowerAllocation"),
            vendor_id: text("USBDeviceKeyVendorID").filter(|v| is_hex(v)),
            location_id: location_id(item),
        });
        collect_devices(item.get("_items"), apple_internal, out);
    }
}

fn location_id(item: &Value) -> Option<String> {
    json_str(item, "USBKeyLocationID")
        .and_then(non_empty)
        .filter(|v| is_hex(v))
}

fn is_hex(value: &str) -> bool {
    value
        .strip_prefix("0x")
        .is_some_and(|h| !h.is_empty() && h.len() <= 16 && h.chars().all(|c| c.is_ascii_hexdigit()))
}

/// "Built-in" -> true; nilai lain (mis. "Removable") -> false.
fn hardware_built_in(raw: &str) -> Option<bool> {
    let t = raw.trim();
    if t.is_empty() {
        None
    } else {
        Some(t.eq_ignore_ascii_case("Built-in"))
    }
}

/// "USB 3.1 Bus" -> "3.1".
pub fn usb_version(name: &str) -> Option<String> {
    let v = name.strip_prefix("USB ")?.strip_suffix(" Bus")?;
    (!v.is_empty() && v.chars().all(|c| c.is_ascii_digit() || c == '.')).then(|| v.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_value() -> Value {
        let tb: Value = serde_json::from_str(fixture!("sp_thunderbolt.json")).unwrap();
        let usb: Value = serde_json::from_str(fixture!("sp_usb_host.json")).unwrap();
        serde_json::json!({
            "SPThunderboltDataType": tb["SPThunderboltDataType"],
            "SPUSBHostDataType": usb["SPUSBHostDataType"],
        })
    }

    #[test]
    fn parses_real_intel_thunderbolt_fixture() {
        let ports = parse(&fixture_value());
        let tb = ports.thunderbolt.unwrap();
        assert_eq!(tb.len(), 2);
        assert_eq!(tb[0].index, Some(0));
        assert_eq!(tb[1].index, Some(1));
        let ids: Vec<_> = tb
            .iter()
            .flat_map(|b| b.receptacles.iter().map(|r| r.id))
            .collect();
        assert_eq!(ids, [Some(1), Some(2), Some(3), Some(4)]);
        for r in tb.iter().flat_map(|b| &b.receptacles) {
            assert_eq!(r.status, ReceptacleStatus::Empty, "kosong ≠ rusak");
            assert_eq!(r.speed_gbps, Some(40.0));
            assert!(r.speed_is_max);
            assert_eq!(r.link_status.as_deref(), Some("0x101"));
        }
        assert!(tb.iter().all(|b| b.connected_devices == 0));
    }

    #[test]
    fn parses_real_intel_usb_fixture_without_names() {
        let usb = parse(&fixture_value()).usb.unwrap();
        assert_eq!(usb.len(), 3);
        assert_eq!(usb[0].usb_version.as_deref(), Some("2.0"));
        assert_eq!(usb[1].usb_version.as_deref(), Some("3.1"));
        assert!(usb[0].devices.is_empty() && usb[1].devices.is_empty());
        assert_eq!(usb[0].built_in, Some(true));
        assert!(!usb[0].apple_internal);
        let t2 = &usb[2];
        assert!(t2.apple_internal);
        assert_eq!(t2.usb_version, None);
        assert_eq!(t2.location_id.as_deref(), Some("0x80000000"));
        assert_eq!(t2.devices.len(), 7);
        for d in &t2.devices {
            assert_eq!(d.built_in, Some(true));
            assert_eq!(d.vendor_id.as_deref(), Some("0x05ac"));
            assert_eq!(d.link_speed.as_deref(), Some("480 Mb/s"));
            assert_eq!(d.power.as_deref(), Some("2.5 W (500 mA)"));
        }
        let dump = format!("{usb:?}");
        assert!(!dump.contains("Perangkat USB") && !dump.contains("Apple Inc."));
    }

    /// Contoh format perangkat eksternal di balik hub (BUKAN data perangkat asli).
    #[test]
    fn external_devices_behind_hub_are_flattened() {
        let v = serde_json::json!({"SPUSBHostDataType": [{
            "_name": "USB 3.1 Bus", "USBKeyHardwareType": "Built-in", "USBKeyLocationID": "0x0d000000",
            "_items": [{
                "_name": "Hub Contoh", "USBKeyHardwareType": "Removable", "USBKeyLocationID": "0x0d100000",
                "USBDeviceKeySerialNumber": "RAHASIA123", "USBDeviceKeyVendorID": "0x1234",
                "_items": [{"_name": "Flashdisk Contoh", "USBKeyLocationID": "0x0d110000",
                            "USBDeviceKeyLinkSpeed": "5 Gb/s", "USBDeviceKeyVendorID": "Bukan hex"}]
            }]
        }]});
        let usb = parse(&v).usb.unwrap();
        assert_eq!(usb[0].devices.len(), 2);
        assert_eq!(usb[0].devices[0].built_in, Some(false));
        assert_eq!(usb[0].devices[0].vendor_id.as_deref(), Some("0x1234"));
        assert_eq!(
            usb[0].devices[1].built_in, None,
            "tanpa tipe hardware = tidak diketahui"
        );
        assert_eq!(usb[0].devices[1].vendor_id, None);
        assert_eq!(usb[0].devices[1].location_id.as_deref(), Some("0x0d110000"));
        let dump = format!("{usb:?}");
        assert!(!dump.contains("RAHASIA") && !dump.contains("Contoh"));
    }

    /// Contoh format receptacle terisi (BUKAN data perangkat asli).
    #[test]
    fn connected_receptacle_and_devices() {
        let v = serde_json::json!({"SPThunderboltDataType": [{
            "_name": "thunderbolt_bus_0",
            "receptacle_1_tag": {"receptacle_id_key": "1", "receptacle_status_key": "receptacle_connected",
                                 "current_speed_key": "20 Gb/s"},
            "_items": [{"device_name_key": "Dock Contoh"}]
        }]});
        let tb = parse(&v).thunderbolt.unwrap();
        assert_eq!(tb[0].connected_devices, 1);
        let r = &tb[0].receptacles[0];
        assert_eq!(r.status, ReceptacleStatus::Connected);
        assert_eq!(r.speed_gbps, Some(20.0));
        assert!(!r.speed_is_max);
        assert!(!format!("{tb:?}").contains("Contoh"));
    }

    #[test]
    fn missing_sections_stay_none() {
        let p = parse(&serde_json::json!({}));
        assert_eq!(p.thunderbolt, None);
        assert_eq!(p.usb, None);
    }

    #[test]
    fn small_parsers() {
        assert_eq!(
            receptacle_status("receptacle_no_devices_connected"),
            ReceptacleStatus::Empty
        );
        assert_eq!(
            receptacle_status("receptacle_connected"),
            ReceptacleStatus::Connected
        );
        assert_eq!(receptacle_status("lainnya"), ReceptacleStatus::Unknown);
        assert_eq!(speed_gbps("Up to 40 Gb/s"), Some((40.0, true)));
        assert_eq!(speed_gbps("480 Mb/s"), Some((0.48, false)));
        assert_eq!(speed_gbps("cepat"), None);
        assert_eq!(speed_gbps("40 GB"), None);
        assert_eq!(usb_version("USB 3.1 Bus").as_deref(), Some("3.1"));
        assert_eq!(usb_version("Apple T2 Bus"), None);
        assert_eq!(bus_index("thunderbolt_bus_3"), Some(3));
        assert_eq!(bus_index("lain"), None);
        assert_eq!(hardware_built_in("Built-in"), Some(true));
        assert_eq!(hardware_built_in("Removable"), Some(false));
        assert_eq!(hardware_built_in(""), None);
        assert!(is_hex("0x05ac") && !is_hex("05ac") && !is_hex("0x"));
    }

    /// `cargo test real_ports -- --ignored --nocapture` (hanya data tersaring).
    #[test]
    #[ignore]
    fn real_ports_probe() {
        println!("ports: {:#?}", probe());
    }
}
