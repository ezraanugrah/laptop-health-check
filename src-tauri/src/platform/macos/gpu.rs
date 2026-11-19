//! GPU & layar: `system_profiler SPDisplaysDataType`.

use serde_json::Value;

use super::bin::SYSTEM_PROFILER;
use super::command::run_json;
use super::parse::{json_str, json_u64, non_empty};
use crate::diagnostics::raw::{DisplayInfo, GpuInfo};
use crate::platform::ProbeError;

pub fn probe() -> Result<Vec<GpuInfo>, ProbeError> {
    let value = run_json(SYSTEM_PROFILER, &["SPDisplaysDataType", "-json"])?;
    Ok(parse(&value))
}

pub fn parse(value: &Value) -> Vec<GpuInfo> {
    value
        .get("SPDisplaysDataType")
        .and_then(Value::as_array)
        .map(|gpus| gpus.iter().map(parse_gpu).collect())
        .unwrap_or_default()
}

fn parse_gpu(g: &Value) -> GpuInfo {
    let text = |key: &str| json_str(g, key).and_then(non_empty);
    let model = text("sppci_model").or_else(|| text("_name"));

    let integrated = match json_str(g, "sppci_bus") {
        Some(bus) if bus.contains("builtin") => Some(true),
        Some(bus) if bus.contains("pcie") => Some(false),
        _ => model
            .as_deref()
            .filter(|m| m.starts_with("Apple"))
            .map(|_| true),
    };

    // VRAM khusus (GPU diskret) vs. memori bersama (GPU terintegrasi Intel).
    let vram = text("spdisplays_vram")
        .or_else(|| text("spdisplays_vram_shared").map(|v| format!("{v} (memori bersama)")));

    GpuInfo {
        model,
        vendor: text("spdisplays_vendor").map(|v| vendor_label(&v)),
        integrated,
        vram,
        graphics_api: text("spdisplays_mtlgpufamilysupport")
            .or_else(|| text("spdisplays_metal"))
            .map(|m| metal_label(&m)),
        cores: json_u64(g, "sppci_cores").and_then(|c| u32::try_from(c).ok()),
        displays: g
            .get("spdisplays_ndrvs")
            .and_then(Value::as_array)
            .map(|ds| ds.iter().map(parse_display).collect())
            .unwrap_or_default(),
        // Driver/kode masalah perangkat/suhu GPU: khusus Windows.
        ..Default::default()
    }
}

fn parse_display(d: &Value) -> DisplayInfo {
    let text = |key: &str| json_str(d, key).and_then(non_empty);
    DisplayInfo {
        name: text("_name"),
        resolution: text("_spdisplays_resolution").or_else(|| text("spdisplays_resolution")),
        internal: text("spdisplays_connection_type")
            .map(|c| c.contains("internal"))
            .or_else(|| text("spdisplays_display_type").map(|t| t.contains("built-in"))),
    }
}

/// "spdisplays_metal3" -> "Metal 3".
pub fn metal_label(raw: &str) -> String {
    let s = raw.trim_start_matches("spdisplays_");
    match s.strip_prefix("metal") {
        Some("") => "Metal".to_string(),
        Some(version) => format!("Metal {version}"),
        None => s.to_string(),
    }
}

/// "sppci_vendor_intel" -> "Intel"; "Intel" tetap "Intel".
pub fn vendor_label(raw: &str) -> String {
    let s = raw.trim_start_matches("sppci_vendor_");
    let mut chars = s.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_intel_fixture() {
        let v: Value = serde_json::from_str(fixture!("sp_displays.json")).unwrap();
        let gpus = parse(&v);
        assert_eq!(gpus.len(), 1);
        let g = &gpus[0];
        assert_eq!(g.model.as_deref(), Some("Intel Iris Plus Graphics"));
        assert_eq!(g.vendor.as_deref(), Some("Intel"));
        assert_eq!(g.integrated, Some(true));
        assert_eq!(g.vram.as_deref(), Some("1536 MB (memori bersama)"));
        assert_eq!(g.graphics_api.as_deref(), Some("Metal 3"));
        assert_eq!(g.displays.len(), 1);
        assert_eq!(g.displays[0].name.as_deref(), Some("Color LCD"));
        assert_eq!(g.displays[0].resolution.as_deref(), Some("1440 x 900"));
        assert_eq!(g.displays[0].internal, Some(true));
    }

    /// Format Apple Silicon (contoh format, BUKAN data perangkat asli).
    #[test]
    fn apple_silicon_style() {
        let v = serde_json::json!({"SPDisplaysDataType": [{
            "sppci_model": "Apple M2", "sppci_cores": "10",
            "spdisplays_mtlgpufamilysupport": "spdisplays_metal3",
            "spdisplays_vendor": "sppci_vendor_Apple"
        }]});
        let g = &parse(&v)[0];
        assert_eq!(g.cores, Some(10));
        assert_eq!(g.integrated, Some(true));
        assert_eq!(g.vendor.as_deref(), Some("Apple"));
        assert_eq!(g.vram, None);
    }

    #[test]
    fn missing_metal_stays_none() {
        let v = serde_json::json!({"SPDisplaysDataType": [{"sppci_model": "GPU X"}]});
        assert_eq!(parse(&v)[0].graphics_api, None);
        assert!(parse(&serde_json::json!({})).is_empty());
    }

    #[test]
    fn labels() {
        assert_eq!(metal_label("spdisplays_metal3"), "Metal 3");
        assert_eq!(metal_label("spdisplays_metal"), "Metal");
        assert_eq!(vendor_label("sppci_vendor_intel"), "Intel");
    }
}
