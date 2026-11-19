//! Penilaian GPU: deteksi, driver, & akselerasi grafis (lintas OS).
//!
//! macOS: dukungan Metal. Windows: kode masalah perangkat
//! (`ConfigManagerErrorCode`) dan API grafis (Direct3D). Suhu GPU bersifat
//! eksperimental (D5) dan hanya ditampilkan.

use super::findings::Findings;
use super::format::format_celsius;
use super::raw::GpuInfo;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

/// Kode masalah perangkat Windows yang berarti perangkat dihentikan/gagal.
pub const CRITICAL_PROBLEM_CODES: [u32; 2] = [10, 43];

pub fn evaluate(data: &Result<Vec<GpuInfo>, ProbeError>) -> CheckResult {
    match data {
        Ok(gpus) => assess(gpus),
        Err(err) => CheckResult::from_probe_error(CheckId::Gpu, err),
    }
}

fn is_basic_display_driver(model: Option<&str>) -> bool {
    model.is_some_and(|m| {
        let m = m.to_lowercase();
        m.contains("basic display adapter") || m.contains("basic render driver")
    })
}

/// Menilai satu GPU; `true` bila ada bukti positif bahwa GPU berfungsi.
fn assess_gpu(name: &str, g: &GpuInfo, f: &mut Findings) -> bool {
    let mut evidence = false;

    match g.device_problem_code {
        Some(0) => {
            evidence = true;
            f.ok(format!(
                "{name}: OS melaporkan perangkat berfungsi normal (kode 0)."
            ));
        }
        Some(code) if CRITICAL_PROBLEM_CODES.contains(&code) => f.critical(format!(
            "{name}: OS menghentikan perangkat karena melaporkan masalah (kode {code})."
        )),
        Some(28) => f.warning(format!("{name}: driver GPU tidak terpasang (kode 28).")),
        Some(22) => f.warning(format!("{name}: perangkat dinonaktifkan (kode 22).")),
        Some(code) => f.warning(format!(
            "{name}: OS melaporkan masalah perangkat (kode {code})."
        )),
        None => {}
    }

    let basic = is_basic_display_driver(g.model.as_deref());
    if basic {
        f.warning(format!(
            "{name}: hanya memakai driver dasar Microsoft; driver GPU asli tidak aktif."
        ));
    }

    match &g.graphics_api {
        Some(api) => {
            evidence = true;
            f.ok(format!("{name}: akselerasi grafis aktif ({api})."));
        }
        None if g.device_problem_code.is_none() => f.warning(format!(
            "{name}: terdeteksi, tetapi OS tidak melaporkan dukungan akselerasi grafis (kemungkinan driver/akselerasi tidak aktif)."
        )),
        None => f.info(format!("{name}: API grafis tidak dilaporkan.")),
    }

    evidence && !basic
}

pub fn assess(gpus: &[GpuInfo]) -> CheckResult {
    let mut f = Findings::default();
    let mut working = 0;
    for (i, g) in gpus.iter().enumerate() {
        let name = g.model.clone().unwrap_or_else(|| format!("GPU {}", i + 1));
        if assess_gpu(&name, g, &mut f) {
            working += 1;
        }
    }
    if gpus.is_empty() {
        f.info("Tidak ada GPU yang dilaporkan oleh OS.");
    }

    let status = f.status(working > 0);
    let summary = match status {
        Status::Healthy => "GPU terdeteksi dan akselerasi aktif.",
        Status::Warning => "GPU perlu perhatian (driver/akselerasi).",
        Status::Critical => "GPU melaporkan masalah perangkat.",
        _ => "GPU tidak dapat dipastikan.",
    };

    CheckResult::new(CheckId::Gpu, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics(gpus))
}

fn metrics(gpus: &[GpuInfo]) -> Vec<Metric> {
    let mut metrics = Vec::new();
    let multiple = gpus.len() > 1;
    for (i, g) in gpus.iter().enumerate() {
        let prefix = if multiple {
            format!("GPU {} · ", i + 1)
        } else {
            String::new()
        };
        let label = |l: &str| format!("{prefix}{l}");
        if let Some(m) = &g.model {
            metrics.push(Metric::new(label("Model"), m.clone()));
        }
        if let Some(kind) = g.integrated {
            metrics.push(Metric::new(
                label("Jenis"),
                if kind { "Terintegrasi" } else { "Diskret" },
            ));
        }
        if let Some(c) = g.cores {
            metrics.push(Metric::new(label("Core GPU"), c.to_string()));
        }
        if let Some(v) = &g.vram {
            metrics.push(Metric::new(label("VRAM"), v.clone()));
        }
        metrics.push(Metric::new(
            label("API grafis"),
            g.graphics_api
                .clone()
                .unwrap_or_else(|| "Tidak dilaporkan".into()),
        ));
        let driver = match (&g.driver_version, &g.driver_date) {
            (Some(v), Some(d)) => Some(format!("{v} ({d})")),
            (Some(x), None) | (None, Some(x)) => Some(x.clone()),
            (None, None) => None,
        };
        if let Some(d) = driver {
            metrics.push(Metric::new(label("Driver"), d));
        }
        if let Some(code) = g.device_problem_code {
            metrics.push(Metric::new(
                label("Kode masalah perangkat"),
                code.to_string(),
            ));
        }
        if let Some(t) = g.temperature_c {
            metrics.push(Metric::experimental(label("Suhu GPU"), format_celsius(t)));
        }
        for d in &g.displays {
            let name = d.name.clone().unwrap_or_else(|| "Layar".into());
            let place = match d.internal {
                Some(true) => " · internal",
                Some(false) => " · eksternal",
                None => "",
            };
            let res = d.resolution.clone().unwrap_or_default();
            metrics.push(Metric::new(label(&name), format!("{res}{place}")));
        }
    }
    metrics
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::raw::DisplayInfo;

    fn gpu(api: Option<&str>) -> GpuInfo {
        GpuInfo {
            model: Some("Intel Iris Plus Graphics".into()),
            integrated: Some(true),
            graphics_api: api.map(str::to_string),
            displays: vec![DisplayInfo {
                name: Some("Color LCD".into()),
                resolution: Some("1440 x 900".into()),
                internal: Some(true),
            }],
            ..Default::default()
        }
    }

    /// GPU bergaya Windows (contoh format, BUKAN data perangkat asli).
    fn win(model: &str, code: Option<u32>, api: Option<&str>) -> GpuInfo {
        GpuInfo {
            model: Some(model.into()),
            device_problem_code: code,
            graphics_api: api.map(str::to_string),
            driver_version: Some("31.0.101.5186".into()),
            driver_date: Some("2026-01-15".into()),
            ..Default::default()
        }
    }

    #[test]
    fn macos_graphics_api_decides_status() {
        assert_eq!(assess(&[gpu(Some("Metal 3"))]).status, Status::Healthy);
        assert_eq!(assess(&[gpu(None)]).status, Status::Warning);
    }

    #[test]
    fn windows_problem_codes() {
        let api = Some("Direct3D 11 (FL 12_1)");
        assert_eq!(
            assess(&[win("Contoh GPU", Some(0), api)]).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&[win("Contoh GPU", Some(0), None)]).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&[win("Contoh GPU", Some(43), api)]).status,
            Status::Critical
        );
        assert_eq!(
            assess(&[win("Contoh GPU", Some(10), api)]).status,
            Status::Critical
        );
        assert_eq!(
            assess(&[win("Contoh GPU", Some(28), None)]).status,
            Status::Warning
        );
        assert_eq!(
            assess(&[win("Contoh GPU", Some(22), None)]).status,
            Status::Warning
        );
        assert_eq!(
            assess(&[win("Contoh GPU", Some(31), None)]).status,
            Status::Warning
        );
    }

    #[test]
    fn windows_basic_display_driver_is_a_warning() {
        let r = assess(&[win("Microsoft Basic Display Adapter", Some(0), None)]);
        assert_eq!(r.status, Status::Warning);
        assert!(
            r.reasons
                .iter()
                .any(|x| x.text.contains("driver dasar Microsoft"))
        );
    }

    #[test]
    fn experimental_temperature_is_labelled() {
        let mut g = win("Contoh GPU", Some(0), Some("Direct3D 12"));
        g.temperature_c = Some(55.0);
        let r = assess(&[g]);
        assert_eq!(r.status, Status::Healthy);
        let t = r.metrics.iter().find(|m| m.label == "Suhu GPU").unwrap();
        assert!(t.experimental);
        let d = r.metrics.iter().find(|m| m.label == "Driver").unwrap();
        assert_eq!(d.value, "31.0.101.5186 (2026-01-15)");
    }

    #[test]
    fn no_gpu_is_unknown() {
        assert_eq!(assess(&[]).status, Status::Unknown);
    }

    #[test]
    fn display_metric() {
        let r = assess(&[gpu(Some("Metal 3"))]);
        let d = r.metrics.iter().find(|m| m.label == "Color LCD").unwrap();
        assert_eq!(d.value, "1440 x 900 · internal");
        let api = r.metrics.iter().find(|m| m.label == "API grafis").unwrap();
        assert_eq!(api.value, "Metal 3");
    }
}
