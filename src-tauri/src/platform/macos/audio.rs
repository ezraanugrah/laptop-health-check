//! Perangkat audio: `system_profiler -json SPAudioDataType` (read-only).
//!
//! Volume dan perangkat default TIDAK pernah diubah. Nama hanya disimpan untuk
//! perangkat bawaan Apple (mis. "MacBook Pro Speakers"); perangkat lain
//! (Bluetooth, USB, virtual) hanya dicatat jenis transport-nya.

use serde_json::Value;

use super::bin::SYSTEM_PROFILER;
use super::command::run_json;
use super::parse::{json_str, json_u64, non_empty};
use crate::diagnostics::raw::{AudioDevice, AudioTransport};
use crate::platform::ProbeError;

pub fn probe() -> Result<Vec<AudioDevice>, ProbeError> {
    let value = run_json(SYSTEM_PROFILER, &["-json", "SPAudioDataType"])?;
    Ok(parse(&value))
}

pub fn parse(value: &Value) -> Vec<AudioDevice> {
    value
        .get("SPAudioDataType")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|group| group.get("_items").and_then(Value::as_array))
        .flatten()
        .filter(|d| d.is_object())
        .map(parse_device)
        .collect()
}

fn parse_device(d: &Value) -> AudioDevice {
    let transport =
        json_str(d, "coreaudio_device_transport").map_or(AudioTransport::Unknown, transport);
    let apple =
        json_str(d, "coreaudio_device_manufacturer").is_some_and(|m| m.trim() == "Apple Inc.");
    let yes = |key: &str| json_str(d, key) == Some("spaudio_yes");
    let channels = |key: &str| {
        json_u64(d, key)
            .and_then(|n| u32::try_from(n).ok())
            .filter(|n| *n > 0)
    };
    AudioDevice {
        builtin_name: (transport == AudioTransport::BuiltIn && apple)
            .then(|| json_str(d, "_name").and_then(non_empty))
            .flatten()
            .filter(|n| n.len() <= 64),
        transport,
        output_channels: channels("coreaudio_device_output"),
        input_channels: channels("coreaudio_device_input"),
        default_output: yes("coreaudio_default_audio_output_device"),
        default_input: yes("coreaudio_default_audio_input_device"),
        default_system_output: yes("coreaudio_default_audio_system_device"),
    }
}

/// "coreaudio_device_type_builtin" -> BuiltIn, dst.
pub fn transport(raw: &str) -> AudioTransport {
    let kind = raw
        .trim()
        .trim_start_matches("coreaudio_device_type_")
        .to_ascii_lowercase();
    match kind.as_str() {
        "builtin" => AudioTransport::BuiltIn,
        k if k.starts_with("bluetooth") => AudioTransport::Bluetooth,
        "usb" => AudioTransport::Usb,
        "hdmi" => AudioTransport::Hdmi,
        "displayport" => AudioTransport::DisplayPort,
        "airplay" => AudioTransport::AirPlay,
        "virtual" => AudioTransport::Virtual,
        _ => AudioTransport::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_intel_fixture() {
        let v: Value = serde_json::from_str(fixture!("sp_audio.json")).unwrap();
        let devices = parse(&v);
        assert_eq!(devices.len(), 5);

        let default_out: Vec<_> = devices.iter().filter(|d| d.default_output).collect();
        assert_eq!(default_out.len(), 1);
        assert_eq!(default_out[0].transport, AudioTransport::BuiltIn);
        assert_eq!(
            default_out[0].builtin_name.as_deref(),
            Some("MacBook Pro Speakers")
        );
        assert_eq!(default_out[0].output_channels, Some(2));

        let mic = devices.iter().find(|d| d.default_input).unwrap();
        assert_eq!(mic.builtin_name.as_deref(), Some("MacBook Pro Microphone"));
        assert_eq!(mic.output_channels, None);

        // Perangkat virtual/agregat: hanya transport, tanpa nama.
        let others: Vec<_> = devices
            .iter()
            .filter(|d| d.transport != AudioTransport::BuiltIn)
            .collect();
        assert_eq!(others.len(), 3);
        assert!(others.iter().all(|d| d.builtin_name.is_none()));
        assert_eq!(
            others
                .iter()
                .filter(|d| d.transport == AudioTransport::Virtual)
                .count(),
            2
        );
        assert!(
            others
                .iter()
                .any(|d| d.default_system_output && d.transport == AudioTransport::Unknown)
        );
    }

    /// Contoh format headphone Bluetooth (BUKAN data perangkat asli).
    #[test]
    fn bluetooth_output_keeps_no_name() {
        let v = serde_json::json!({"SPAudioDataType": [{"_items": [{
            "_name": "Headphone Contoh", "coreaudio_device_transport": "coreaudio_device_type_bluetooth",
            "coreaudio_device_manufacturer": "Apple Inc.", "coreaudio_device_output": 2,
            "coreaudio_default_audio_output_device": "spaudio_yes"
        }]}]});
        let d = &parse(&v)[0];
        assert_eq!(d.transport, AudioTransport::Bluetooth);
        assert_eq!(d.builtin_name, None);
        assert!(d.default_output);
    }

    #[test]
    fn transport_table() {
        assert_eq!(
            transport("coreaudio_device_type_builtin"),
            AudioTransport::BuiltIn
        );
        assert_eq!(
            transport("coreaudio_device_type_bluetoothle"),
            AudioTransport::Bluetooth
        );
        assert_eq!(transport("coreaudio_device_type_usb"), AudioTransport::Usb);
        assert_eq!(
            transport("coreaudio_device_type_hdmi"),
            AudioTransport::Hdmi
        );
        assert_eq!(
            transport("coreaudio_device_type_displayport"),
            AudioTransport::DisplayPort
        );
        assert_eq!(
            transport("coreaudio_device_type_airplay"),
            AudioTransport::AirPlay
        );
        assert_eq!(
            transport("coreaudio_device_type_virtual"),
            AudioTransport::Virtual
        );
        assert_eq!(
            transport("coreaudio_device_type_aggregate"),
            AudioTransport::Unknown
        );
        assert!(parse(&serde_json::json!({})).is_empty());
    }

    /// `cargo test real_audio -- --ignored --nocapture` (hanya data tersaring).
    #[test]
    #[ignore]
    fn real_audio_probe() {
        println!("audio: {:#?}", probe());
    }
}
