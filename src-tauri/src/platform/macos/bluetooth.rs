//! Bluetooth: `system_profiler -json SPBluetoothDataType` (read-only).
//!
//! Tanpa pemindaian, penemuan, atau pemasangan perangkat, dan tanpa mengubah
//! status Bluetooth. Di output macOS, NAMA perangkat menjadi kunci objek dan
//! alamat ada di `device_address`: parser hanya membaca NILAI `device_minorType`
//! dan menghitung perangkat, sehingga nama/alamat tidak pernah masuk model.

use serde_json::Value;

use super::bin::SYSTEM_PROFILER;
use super::command::run_json;
use super::parse::{json_str, non_empty};
use crate::diagnostics::raw::BluetoothInfo;
use crate::platform::ProbeError;

pub fn probe() -> Result<BluetoothInfo, ProbeError> {
    let value = run_json(SYSTEM_PROFILER, &["-json", "SPBluetoothDataType"])?;
    Ok(parse(&value))
}

pub fn parse(value: &Value) -> BluetoothInfo {
    let Some(entry) = value
        .get("SPBluetoothDataType")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
    else {
        return BluetoothInfo::default();
    };
    let Some(props) = entry.get("controller_properties").filter(|p| p.is_object()) else {
        return BluetoothInfo::default();
    };
    let text = |key: &str| {
        json_str(props, key)
            .and_then(non_empty)
            .filter(|t| t.len() <= 64)
    };

    BluetoothInfo {
        controller_present: true,
        powered: json_str(props, "controller_state").and_then(attrib),
        discoverable: json_str(props, "controller_discoverable").and_then(attrib),
        chipset: text("controller_chipset"),
        firmware: text("controller_firmwareVersion"),
        transport: text("controller_transport"),
        vendor_id: text("controller_vendorID"),
        services: json_str(props, "controller_supportedServices")
            .map(services)
            .unwrap_or_default(),
        connected_types: device_values(entry.get("device_connected"))
            .map(|d| json_str(d, "device_minorType").and_then(minor_type))
            .collect(),
        paired_not_connected: u32::try_from(
            device_values(entry.get("device_not_connected")).count(),
        )
        .unwrap_or(u32::MAX),
    }
}

/// Nilai tiap perangkat dari `[{ "<nama>": { ... } }, ...]`. Kunci (nama) dibuang.
fn device_values(list: Option<&Value>) -> impl Iterator<Item = &Value> {
    list.and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(Value::as_object)
        .flat_map(|obj| obj.values())
        .filter(|v| v.is_object())
}

/// "attrib_on"/"attrib_Yes" -> true, "attrib_off"/"attrib_No" -> false.
fn attrib(raw: &str) -> Option<bool> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "attrib_on" | "attrib_yes" => Some(true),
        "attrib_off" | "attrib_no" => Some(false),
        _ => None,
    }
}

/// "0x392039 < HFP AVRCP A2DP >" -> ["HFP", "AVRCP", "A2DP"].
fn services(raw: &str) -> Vec<String> {
    let inner = match (raw.find('<'), raw.rfind('>')) {
        (Some(start), Some(end)) if start < end => &raw[start + 1..end],
        _ => raw,
    };
    inner
        .split_whitespace()
        .filter(|t| !t.starts_with("0x") && t.len() <= 24)
        .filter(|t| t.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'))
        .map(str::to_string)
        .collect()
}

/// Jenis perangkat, mis. "Headphones". Teks yang tidak wajar dibuang.
fn minor_type(raw: &str) -> Option<String> {
    let t = raw.trim();
    (!t.is_empty()
        && t.len() <= 32
        && t.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ' ' | '-' | '_')))
    .then(|| t.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_intel_fixture_bluetooth_off() {
        let v: Value = serde_json::from_str(fixture!("sp_bluetooth.json")).unwrap();
        let bt = parse(&v);
        assert!(bt.controller_present);
        assert_eq!(bt.powered, Some(false));
        assert_eq!(bt.discoverable, Some(false));
        assert_eq!(bt.chipset.as_deref(), Some("BCM_4364B3"));
        assert_eq!(bt.firmware.as_deref(), Some("v91 c4211"));
        assert_eq!(bt.transport.as_deref(), Some("UART"));
        assert_eq!(bt.vendor_id.as_deref(), Some("0x004C (Apple)"));
        assert_eq!(
            bt.services,
            [
                "HFP",
                "AVRCP",
                "A2DP",
                "HID",
                "Braille",
                "LEA",
                "AACP",
                "GATT",
                "SerialPort"
            ]
        );
        assert!(bt.connected_types.is_empty());
        assert_eq!(bt.paired_not_connected, 0);
    }

    /// Contoh format dengan perangkat (BUKAN data perangkat asli). Nama dan
    /// alamat sengaja diisi agar terbukti tidak ikut terbaca.
    #[test]
    fn devices_are_counted_without_names_or_addresses() {
        let v = serde_json::json!({"SPBluetoothDataType": [{
            "controller_properties": {"controller_state": "attrib_on"},
            "device_connected": [
                {"Headphone Contoh": {"device_address": "00:11:22:33:44:55", "device_minorType": "Headphones"}},
                {"Keyboard Contoh": {"device_address": "66:77:88:99:AA:BB"}}
            ],
            "device_not_connected": [
                {"Mouse Contoh": {"device_address": "CC:DD:EE:FF:00:11", "device_minorType": "Mouse"}}
            ]
        }]});
        let bt = parse(&v);
        assert_eq!(bt.powered, Some(true));
        assert_eq!(
            bt.connected_types,
            vec![Some("Headphones".to_string()), None]
        );
        assert_eq!(bt.paired_not_connected, 1);
        let dump = format!("{bt:?}");
        for secret in ["Contoh", "00:11", "66:77", "CC:DD"] {
            assert!(!dump.contains(secret), "{secret} bocor ke model");
        }
    }

    #[test]
    fn missing_controller_is_reported() {
        assert!(!parse(&serde_json::json!({})).controller_present);
        assert!(!parse(&serde_json::json!({"SPBluetoothDataType": []})).controller_present);
        assert!(!parse(&serde_json::json!({"SPBluetoothDataType": [{}]})).controller_present);
    }

    #[test]
    fn small_parsers() {
        assert_eq!(attrib("attrib_on"), Some(true));
        assert_eq!(attrib("attrib_Yes"), Some(true));
        assert_eq!(attrib("attrib_No"), Some(false));
        assert_eq!(attrib("lainnya"), None);
        assert_eq!(services("HFP A2DP"), ["HFP", "A2DP"]);
        assert!(services("0x0 < >").is_empty());
        assert_eq!(minor_type(" Gamepad "), Some("Gamepad".into()));
        assert_eq!(minor_type("<script>"), None);
        assert_eq!(minor_type(""), None);
    }

    /// `cargo test real_bluetooth -- --ignored --nocapture` (hanya data tersaring).
    #[test]
    #[ignore]
    fn real_bluetooth_probe() {
        println!("bluetooth: {:?}", probe());
    }
}
