//! Penilaian GPU: deteksi & akselerasi.

use super::findings::Findings;
use super::raw::GpuInfo;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

pub fn evaluate(data: &Result<Vec<GpuInfo>, ProbeError>) -> CheckResult {
    match data {
        Ok(gpus) => assess(gpus),
        Err(err) => CheckResult::from_probe_error(CheckId::Gpu, err),
    }
}

pub fn assess(gpus: &[GpuInfo]) -> CheckResult {
    let mut f = Findings::default();
    let mut accelerated = 0;
    for (i, g) in gpus.iter().enumerate() {
        let name = g.model.clone().unwrap_or_else(|| format!("GPU {}", i + 1));
        match &g.metal_support {
            Some(metal) => {
                accelerated += 1;
                f.ok(format!("{name}: terdeteksi, akselerasi {metal} aktif."));
            }
            None => f.warning(format!(
                "{name}: terdeteksi, tetapi macOS tidak melaporkan dukungan Metal (kemungkinan driver/akselerasi tidak aktif)."
            )),
        }
    }
    if gpus.is_empty() {
        f.info("Tidak ada GPU yang dilaporkan oleh macOS.");
    }

    let status = f.status(accelerated > 0);
    let summary = match status {
        Status::Healthy => "GPU terdeteksi dan akselerasi aktif.",
        Status::Warning => "GPU terdeteksi tanpa akselerasi — perlu perhatian.",
        _ => "GPU tidak dapat dipastikan.",
    };

    let mut metrics = Vec::new();
    let multiple = gpus.len() > 1;
    for (i, g) in gpus.iter().enumerate() {
        let prefix = if multiple {
            format!("GPU {} · ", i + 1)
        } else {
            String::new()
        };
        if let Some(m) = &g.model {
            metrics.push(Metric::new(format!("{prefix}Model"), m.clone()));
        }
        if let Some(kind) = g.integrated {
            let label = if kind { "Terintegrasi" } else { "Diskret" };
            metrics.push(Metric::new(format!("{prefix}Jenis"), label));
        }
        if let Some(c) = g.cores {
            metrics.push(Metric::new(format!("{prefix}Core GPU"), c.to_string()));
        }
        if let Some(v) = &g.vram {
            metrics.push(Metric::new(format!("{prefix}VRAM"), v.clone()));
        }
        metrics.push(Metric::new(
            format!("{prefix}Metal"),
            g.metal_support
                .clone()
                .unwrap_or_else(|| "Tidak dilaporkan".into()),
        ));
        for d in &g.displays {
            let name = d.name.clone().unwrap_or_else(|| "Layar".into());
            let place = match d.internal {
                Some(true) => " · internal",
                Some(false) => " · eksternal",
                None => "",
            };
            let res = d.resolution.clone().unwrap_or_default();
            metrics.push(Metric::new(
                format!("{prefix}{name}"),
                format!("{res}{place}"),
            ));
        }
    }

    CheckResult::new(CheckId::Gpu, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
        .with_notes(vec![
            "Tidak ada metrik resmi untuk \"kesehatan\" GPU. Pemeriksaan ini memastikan GPU terdeteksi dan akselerasi Metal aktif; uji artefak visual direncanakan di Fase 4.".into(),
        ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::raw::DisplayInfo;

    fn gpu(metal: Option<&str>) -> GpuInfo {
        GpuInfo {
            model: Some("Intel Iris Plus Graphics".into()),
            integrated: Some(true),
            metal_support: metal.map(str::to_string),
            displays: vec![DisplayInfo {
                name: Some("Color LCD".into()),
                resolution: Some("1440 x 900".into()),
                internal: Some(true),
            }],
            ..Default::default()
        }
    }

    #[test]
    fn metal_support_decides_status() {
        assert_eq!(assess(&[gpu(Some("Metal 3"))]).status, Status::Healthy);
        assert_eq!(assess(&[gpu(None)]).status, Status::Warning);
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
    }
}
