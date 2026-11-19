//! Penilaian GPU: deteksi & akselerasi grafis (Metal) di macOS.

use super::findings::Findings;
use super::raw::GpuInfo;
use super::text::Text;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;
use crate::tr;

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
        match &g.graphics_api {
            Some(api) => {
                accelerated += 1;
                f.ok(tr!(
                    "gpu.reason.accelerated",
                    format!("{name}: terdeteksi, akselerasi grafis aktif ({api})."),
                    gpu = name,
                    api = api
                ));
            }
            None => f.warning(tr!(
                "gpu.reason.noMetal",
                format!("{name}: terdeteksi, tetapi macOS tidak melaporkan dukungan Metal (kemungkinan driver/akselerasi tidak aktif)."),
                gpu = name
            )),
        }
    }
    if gpus.is_empty() {
        f.info(tr!(
            "gpu.reason.none",
            "Tidak ada GPU yang dilaporkan oleh macOS."
        ));
    }

    let status = f.status(accelerated > 0);
    let summary = match status {
        Status::Healthy => tr!(
            "gpu.summary.healthy",
            "GPU terdeteksi dan akselerasi aktif."
        ),
        Status::Warning => tr!(
            "gpu.summary.warning",
            "GPU terdeteksi tanpa akselerasi — perlu perhatian."
        ),
        _ => tr!("gpu.summary.unknown", "GPU tidak dapat dipastikan."),
    };

    CheckResult::new(CheckId::Gpu, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics(gpus))
}

fn metrics(gpus: &[GpuInfo]) -> Vec<Metric> {
    let mut metrics = Vec::new();
    let multiple = gpus.len() > 1;
    for (i, g) in gpus.iter().enumerate() {
        let group_name = format!("GPU {}", i + 1);
        let group = multiple.then_some(group_name.as_str());
        if let Some(m) = &g.model {
            metrics.push(Metric::new(
                tr!("metric.model", "Model").grouped(group),
                m.clone(),
            ));
        }
        if let Some(kind) = g.integrated {
            metrics.push(Metric::new(
                tr!("gpu.metric.type", "Jenis").grouped(group),
                if kind {
                    tr!("gpu.value.integrated", "Terintegrasi")
                } else {
                    tr!("gpu.value.discrete", "Diskret")
                },
            ));
        }
        if let Some(c) = g.cores {
            metrics.push(Metric::new(
                tr!("gpu.metric.cores", "Core GPU").grouped(group),
                c.to_string(),
            ));
        }
        if let Some(v) = &g.vram {
            metrics.push(Metric::new(
                tr!("gpu.metric.vram", "VRAM").grouped(group),
                v.clone(),
            ));
        }
        metrics.push(Metric::new(
            tr!("gpu.metric.api", "API grafis").grouped(group),
            match &g.graphics_api {
                Some(api) => api.clone().into(),
                None => tr!("value.notReported", "Tidak dilaporkan"),
            },
        ));
        for d in &g.displays {
            // Nama layar dari macOS (mis. "Color LCD") tidak diterjemahkan.
            let label: Text = match &d.name {
                Some(name) => name.clone().into(),
                None => tr!("gpu.metric.display", "Layar"),
            };
            let res = d.resolution.clone().unwrap_or_default();
            let value = match d.internal {
                Some(true) => tr!(
                    "gpu.value.displayInternal",
                    format!("{res} · internal"),
                    res = res
                ),
                Some(false) => tr!(
                    "gpu.value.displayExternal",
                    format!("{res} · eksternal"),
                    res = res
                ),
                None => res.into(),
            };
            metrics.push(Metric::new(label.grouped(group), value));
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
        let api = r.metrics.iter().find(|m| m.label == "API grafis").unwrap();
        assert_eq!(api.value, "Metal 3");
    }
}
