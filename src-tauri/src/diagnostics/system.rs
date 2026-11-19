//! Pemeriksaan identitas sistem (satu-satunya pemeriksaan aktif di Fase 1).

use super::format_gib;
use super::types::{CheckId, CheckResult, Metric, Status, SystemOverview};
use crate::platform::Platform;

pub fn run<P: Platform>() -> CheckResult {
    match P::system_overview() {
        Ok(overview) => evaluate(&overview),
        Err(err) => CheckResult {
            id: CheckId::System,
            status: Status::Unknown,
            summary: format!("Informasi sistem tidak dapat dibaca: {err}"),
            metrics: Vec::new(),
        },
    }
}

pub fn evaluate(o: &SystemOverview) -> CheckResult {
    let unknown = || "Tidak diketahui".to_string();

    let os = match &o.os_version {
        Some(v) => format!("{} {v}", o.os_name),
        None => o.os_name.clone(),
    };

    let mut metrics = vec![
        Metric::new("Sistem operasi", os),
        Metric::new("Arsitektur", o.arch.clone()),
        Metric::new("Model", o.model.clone().unwrap_or_else(unknown)),
        Metric::new("Prosesor", o.cpu.clone().unwrap_or_else(unknown)),
        Metric::new(
            "Core logis",
            o.logical_cpus
                .map(|n| n.to_string())
                .unwrap_or_else(unknown),
        ),
        Metric::new(
            "Total RAM",
            o.memory_bytes.map(format_gib).unwrap_or_else(unknown),
        ),
    ];
    if let Some(build) = &o.os_build {
        metrics.insert(1, Metric::new("Build OS", build.clone()));
    }

    let complete = o.os_version.is_some() && o.cpu.is_some() && o.memory_bytes.is_some();
    let (status, summary) = if complete {
        (Status::Pass, "Informasi sistem terbaca lengkap.")
    } else {
        (Status::Unknown, "Sebagian informasi sistem tidak terbaca.")
    };

    CheckResult {
        id: CheckId::System,
        status,
        summary: summary.into(),
        metrics,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::ProbeError;

    fn full_overview() -> SystemOverview {
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

    struct OkPlatform;
    impl Platform for OkPlatform {
        fn system_overview() -> Result<SystemOverview, ProbeError> {
            Ok(full_overview())
        }
    }

    struct FailingPlatform;
    impl Platform for FailingPlatform {
        fn system_overview() -> Result<SystemOverview, ProbeError> {
            Err(ProbeError::new("akses ditolak"))
        }
    }

    #[test]
    fn complete_overview_passes() {
        let result = run::<OkPlatform>();
        assert_eq!(result.id, CheckId::System);
        assert_eq!(result.status, Status::Pass);
        let os = result
            .metrics
            .iter()
            .find(|m| m.label == "Sistem operasi")
            .unwrap();
        assert_eq!(os.value, "macOS 15.0");
        let ram = result
            .metrics
            .iter()
            .find(|m| m.label == "Total RAM")
            .unwrap();
        assert_eq!(ram.value, "16 GB");
    }

    #[test]
    fn partial_overview_is_unknown() {
        let mut o = full_overview();
        o.memory_bytes = None;
        o.os_build = None;
        let result = evaluate(&o);
        assert_eq!(result.status, Status::Unknown);
        assert!(result.metrics.iter().all(|m| m.label != "Build OS"));
    }

    #[test]
    fn probe_error_is_reported_as_unknown() {
        let result = run::<FailingPlatform>();
        assert_eq!(result.status, Status::Unknown);
        assert!(result.summary.contains("akses ditolak"));
    }
}
