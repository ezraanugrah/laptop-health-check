//! Pemeriksaan identitas sistem.
//!
//! Kategori `DeviceSecurity`: tidak memengaruhi kesimpulan kesehatan hardware.

use super::findings::Findings;
use super::format::format_gib;
use super::raw::SystemOverview;
use super::text::Text;
use super::types::{CheckId, CheckResult, Metric};
use crate::platform::ProbeError;
use crate::tr;

pub fn evaluate(data: &Result<SystemOverview, ProbeError>) -> CheckResult {
    match data {
        Ok(overview) => assess(overview),
        Err(err) => CheckResult::from_probe_error(CheckId::System, err),
    }
}

pub fn assess(o: &SystemOverview) -> CheckResult {
    let unknown = || tr!("value.unknown", "Tidak diketahui");
    let os = match &o.os_version {
        Some(v) => format!("{} {v}", o.os_name),
        None => o.os_name.clone(),
    };

    let mut metrics = vec![Metric::new(tr!("system.metric.os", "Sistem operasi"), os)];
    if let Some(build) = &o.os_build {
        metrics.push(Metric::new(
            tr!("system.metric.build", "Build OS"),
            build.clone(),
        ));
    }
    metrics.extend([
        Metric::new(tr!("system.metric.arch", "Arsitektur"), o.arch.clone()),
        Metric::new(
            tr!("metric.model", "Model"),
            o.model.clone().map(Text::from).unwrap_or_else(unknown),
        ),
        Metric::new(
            tr!("system.metric.processor", "Prosesor"),
            o.cpu.clone().map(Text::from).unwrap_or_else(unknown),
        ),
        Metric::new(
            tr!("system.metric.logicalCores", "Core logis"),
            o.logical_cpus
                .map(|n| Text::from(n.to_string()))
                .unwrap_or_else(unknown),
        ),
        Metric::new(
            tr!("system.metric.totalRam", "Total RAM"),
            o.memory_bytes
                .map(|b| Text::from(format_gib(b)))
                .unwrap_or_else(unknown),
        ),
    ]);

    let mut f = Findings::default();
    let complete = o.os_version.is_some() && o.cpu.is_some() && o.memory_bytes.is_some();
    if complete {
        f.ok(tr!(
            "system.reason.complete",
            "Versi OS, prosesor, dan RAM terbaca dari sistem."
        ));
    } else {
        f.info(tr!(
            "system.reason.partial",
            "Sebagian informasi sistem tidak dilaporkan oleh macOS."
        ));
    }
    let status = f.status(complete);
    let summary = if complete {
        tr!(
            "system.summary.complete",
            "Informasi sistem terbaca lengkap."
        )
    } else {
        tr!(
            "system.summary.partial",
            "Sebagian informasi sistem tidak terbaca."
        )
    };

    CheckResult::new(CheckId::System, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::types::Status;

    fn full() -> SystemOverview {
        SystemOverview {
            os_name: "macOS".into(),
            os_version: Some("15.0".into()),
            os_build: Some("24A335".into()),
            arch: "x86_64".into(),
            model: Some("MacBookPro16,2".into()),
            cpu: Some("Intel(R) Core(TM) i5".into()),
            logical_cpus: Some(8),
            memory_bytes: Some(16 * 1024 * 1024 * 1024),
        }
    }

    fn metric<'a>(r: &'a CheckResult, label: &str) -> &'a str {
        &r.metrics.iter().find(|m| m.label == label).unwrap().value
    }

    #[test]
    fn complete_overview_is_healthy() {
        let r = assess(&full());
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(metric(&r, "Sistem operasi"), "macOS 15.0");
        assert_eq!(metric(&r, "Total RAM"), "16 GB");
    }

    #[test]
    fn partial_overview_is_unknown() {
        let mut o = full();
        o.memory_bytes = None;
        o.os_build = None;
        let r = assess(&o);
        assert_eq!(r.status, Status::Unknown);
        assert!(r.metrics.iter().all(|m| m.label != "Build OS"));
        assert_eq!(metric(&r, "Total RAM"), "Tidak diketahui");
    }

    #[test]
    fn probe_error_is_unknown_with_reason() {
        let r = evaluate(&Err(ProbeError::new("akses ditolak")));
        assert_eq!(r.status, Status::Unknown);
        assert!(r.reasons[0].text.contains("akses ditolak"));
    }
}
