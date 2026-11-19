//! Logika diagnostik lintas platform.
//!
//! Setiap modul pemeriksaan menerima data mentah dari [`crate::platform`]
//! dan mengubahnya menjadi [`types::CheckResult`]. Modul di sini TIDAK boleh
//! memanggil API OS secara langsung — itu tugas lapisan platform.

pub mod types;

mod battery;
mod cpu;
mod memory;
mod storage;
mod system;

use std::time::{SystemTime, UNIX_EPOCH};

use crate::platform::Platform;
use types::{CheckResult, DiagnosticsReport, Status};

/// Menjalankan seluruh pemeriksaan secara berurutan.
pub fn run_all<P: Platform>() -> DiagnosticsReport {
    let checks = vec![
        system::run::<P>(),
        battery::run(),
        storage::run(),
        cpu::run(),
        memory::run(),
    ];

    DiagnosticsReport {
        overall: overall_status(&checks),
        generated_at: now_millis(),
        checks,
    }
}

/// Status keseluruhan = status terburuk dari pemeriksaan yang ikut dihitung.
/// Jika tidak ada satu pun yang dihitung, hasilnya `Unknown`.
pub fn overall_status(checks: &[CheckResult]) -> Status {
    checks
        .iter()
        .filter_map(|c| c.status.severity().map(|s| (s, c.status)))
        .max_by_key(|(severity, _)| *severity)
        .map(|(_, status)| status)
        .unwrap_or(Status::Unknown)
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Format byte ke GB (basis 1024), mis. `8589934592` -> `"8 GB"`.
pub fn format_gib(bytes: u64) -> String {
    let gib = bytes as f64 / (1024.0 * 1024.0 * 1024.0);
    if (gib - gib.round()).abs() < 0.05 {
        format!("{} GB", gib.round() as u64)
    } else {
        format!("{gib:.1} GB")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use types::CheckId;

    fn check(status: Status) -> CheckResult {
        CheckResult {
            id: CheckId::System,
            status,
            summary: String::new(),
            metrics: vec![],
        }
    }

    struct FakePlatform;
    impl Platform for FakePlatform {
        fn system_overview() -> Result<types::SystemOverview, crate::platform::ProbeError> {
            Ok(types::SystemOverview {
                os_name: "macOS".into(),
                os_version: Some("15.0".into()),
                cpu: Some("Apple M1".into()),
                memory_bytes: Some(8 * 1024 * 1024 * 1024),
                ..Default::default()
            })
        }
    }

    #[test]
    fn run_all_returns_every_check_in_order() {
        let report = run_all::<FakePlatform>();
        let ids: Vec<CheckId> = report.checks.iter().map(|c| c.id).collect();
        assert_eq!(
            ids,
            [
                CheckId::System,
                CheckId::Battery,
                CheckId::Storage,
                CheckId::Cpu,
                CheckId::Memory
            ]
        );
        // Fase 1: hanya Sistem yang aktif, sehingga status keseluruhan = status Sistem.
        assert_eq!(report.checks[0].status, Status::Pass);
        assert_eq!(report.overall, Status::Pass);
        assert!(report.generated_at > 0);
    }

    #[test]
    fn overall_takes_worst_counted_status() {
        let checks = [
            check(Status::Pass),
            check(Status::Warning),
            check(Status::Unknown),
        ];
        assert_eq!(overall_status(&checks), Status::Warning);

        let checks = [
            check(Status::Warning),
            check(Status::Fail),
            check(Status::Pass),
        ];
        assert_eq!(overall_status(&checks), Status::Fail);
    }

    #[test]
    fn overall_ignores_not_implemented_and_unsupported() {
        let checks = [
            check(Status::Pass),
            check(Status::NotImplemented),
            check(Status::Unsupported),
        ];
        assert_eq!(overall_status(&checks), Status::Pass);
    }

    #[test]
    fn overall_is_unknown_when_nothing_counted() {
        assert_eq!(overall_status(&[]), Status::Unknown);
        assert_eq!(
            overall_status(&[check(Status::NotImplemented)]),
            Status::Unknown
        );
    }

    #[test]
    fn format_gib_rounds_sensibly() {
        assert_eq!(format_gib(8 * 1024 * 1024 * 1024), "8 GB");
        assert_eq!(format_gib(16 * 1024 * 1024 * 1024), "16 GB");
        assert_eq!(format_gib(1_610_612_736), "1.5 GB");
    }

    #[test]
    fn serializes_camel_case_for_frontend() {
        let report = DiagnosticsReport {
            overall: Status::NotImplemented,
            generated_at: 42,
            checks: vec![CheckResult::not_implemented(CheckId::Battery)],
        };
        let json = serde_json::to_value(&report).unwrap();
        assert_eq!(json["overall"], "notImplemented");
        assert_eq!(json["generatedAt"], 42);
        assert_eq!(json["checks"][0]["id"], "battery");
        assert!(json["checks"][0]["metrics"].as_array().unwrap().is_empty());
    }
}
