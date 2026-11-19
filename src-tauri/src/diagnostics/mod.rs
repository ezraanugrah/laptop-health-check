//! Logika diagnostik lintas platform.
//!
//! Alur: lapisan [`crate::platform`] membaca data mentah ([`raw`]) secara
//! paralel, lalu setiap modul pemeriksaan menilainya menjadi
//! [`types::CheckResult`]. Modul di sini TIDAK memanggil API OS.

pub mod format;
pub mod raw;
pub mod types;

mod battery;
mod cpu;
mod fans;
mod findings;
mod gpu;
mod memory;
mod ownership;
mod storage;
mod system;
mod temperature;

use std::thread::ScopedJoinHandle;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use crate::platform::{Platform, ProbeError};
use raw::SensorKind;
use types::{CheckId, CheckResult, DiagnosticsReport, Status};

/// Beban CPU di bawah nilai ini (%) dianggap "beban ringan" untuk ambang suhu.
pub const LIGHT_LOAD_MAX_PERCENT: f64 = 30.0;

/// Menjalankan seluruh pemeriksaan. Pembacaan data mentah berjalan paralel.
pub fn run_all<P: Platform>() -> DiagnosticsReport {
    let started = Instant::now();

    let (overview, battery, storage, memory, cpu, sensors, gpu, ownership) =
        std::thread::scope(|s| {
            let overview = s.spawn(P::system_overview);
            let battery = s.spawn(P::battery);
            let storage = s.spawn(P::storage);
            let memory = s.spawn(P::memory);
            let cpu = s.spawn(P::cpu);
            let sensors = s.spawn(P::sensors);
            let gpu = s.spawn(P::gpu);
            let ownership = s.spawn(P::ownership);
            (
                join(overview),
                join(battery),
                join(storage),
                join(memory),
                join(cpu),
                join(sensors),
                join(gpu),
                join(ownership),
            )
        });

    let cpu_load = cpu.as_ref().ok().and_then(|c| c.load_percent);
    let battery_temp = battery
        .as_ref()
        .ok()
        .and_then(Option::as_ref)
        .and_then(|b| b.temperature_c);
    let cpu_max_temp = sensors
        .as_ref()
        .ok()
        .and_then(|s| s.max_celsius(SensorKind::Cpu));

    let checks = vec![
        system::evaluate(&overview).with_sources(P::sources(CheckId::System)),
        battery::evaluate(&battery).with_sources(P::sources(CheckId::Battery)),
        storage::evaluate(&storage).with_sources(P::sources(CheckId::Storage)),
        memory::evaluate(&memory).with_sources(P::sources(CheckId::Memory)),
        cpu::evaluate(&cpu).with_sources(P::sources(CheckId::Cpu)),
        temperature::evaluate(&sensors, battery_temp, cpu_load)
            .with_sources(P::sources(CheckId::Temperature)),
        fans::evaluate(&sensors, cpu_max_temp, cpu_load).with_sources(P::sources(CheckId::Fans)),
        gpu::evaluate(&gpu).with_sources(P::sources(CheckId::Gpu)),
        ownership::evaluate(&ownership).with_sources(P::sources(CheckId::Ownership)),
    ];

    DiagnosticsReport {
        overall: overall_status(&checks),
        generated_at: now_millis(),
        duration_ms: started.elapsed().as_millis() as u64,
        checks,
    }
}

/// Probe yang panik tidak boleh menjatuhkan aplikasi: diubah menjadi error.
fn join<T>(handle: ScopedJoinHandle<'_, Result<T, ProbeError>>) -> Result<T, ProbeError> {
    handle
        .join()
        .unwrap_or_else(|_| Err(ProbeError::new("pembacaan data berhenti tak terduga")))
}

/// Status keseluruhan = status terburuk dari pemeriksaan yang ikut dihitung.
/// `NotApplicable` tidak dihitung; bila tak ada yang dihitung -> `Unknown`.
pub fn overall_status(checks: &[CheckResult]) -> Status {
    checks
        .iter()
        .filter_map(|c| c.status.severity().map(|s| (s, c.status)))
        .max_by_key(|(severity, _)| *severity)
        .map(|(_, status)| status)
        .unwrap_or(Status::Unknown)
}

/// `true` bila beban CPU diketahui DAN ringan.
pub fn is_light_load(cpu_load: Option<f64>) -> bool {
    cpu_load.is_some_and(|l| l < LIGHT_LOAD_MAX_PERCENT)
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::fake;

    fn check(status: Status) -> CheckResult {
        CheckResult::new(CheckId::System, status, "")
    }

    #[test]
    fn overall_takes_worst_counted_status() {
        let checks = [
            check(Status::Healthy),
            check(Status::Warning),
            check(Status::Unknown),
        ];
        assert_eq!(overall_status(&checks), Status::Warning);

        let checks = [
            check(Status::Warning),
            check(Status::Critical),
            check(Status::Healthy),
        ];
        assert_eq!(overall_status(&checks), Status::Critical);
    }

    #[test]
    fn unknown_is_never_reported_as_healthy() {
        let checks = [check(Status::Healthy), check(Status::Unknown)];
        assert_eq!(overall_status(&checks), Status::Unknown);
    }

    #[test]
    fn overall_ignores_not_applicable() {
        let checks = [check(Status::Healthy), check(Status::NotApplicable)];
        assert_eq!(overall_status(&checks), Status::Healthy);
        assert_eq!(
            overall_status(&[check(Status::NotApplicable)]),
            Status::Unknown
        );
        assert_eq!(overall_status(&[]), Status::Unknown);
    }

    #[test]
    fn light_load_requires_known_value() {
        assert!(is_light_load(Some(29.9)));
        assert!(!is_light_load(Some(30.0)));
        assert!(!is_light_load(None));
    }

    #[test]
    fn run_all_returns_every_check_in_order() {
        let report = run_all::<fake::Healthy>();
        let ids: Vec<CheckId> = report.checks.iter().map(|c| c.id).collect();
        assert_eq!(
            ids,
            [
                CheckId::System,
                CheckId::Battery,
                CheckId::Storage,
                CheckId::Memory,
                CheckId::Cpu,
                CheckId::Temperature,
                CheckId::Fans,
                CheckId::Gpu,
                CheckId::Ownership,
            ]
        );
        for c in &report.checks {
            assert_eq!(c.status, Status::Healthy, "{:?}: {:?}", c.id, c.reasons);
            assert_eq!(c.sources, ["sumber uji"]);
        }
        assert_eq!(report.overall, Status::Healthy);
        assert!(report.generated_at > 0);
    }

    #[test]
    fn failing_probes_become_unknown_not_healthy() {
        let report = run_all::<fake::Failing>();
        assert!(report.checks.iter().all(|c| c.status == Status::Unknown));
        assert!(
            report
                .checks
                .iter()
                .all(|c| c.reasons.iter().any(|r| r.text.contains("gagal (uji)")))
        );
        assert_eq!(report.overall, Status::Unknown);
    }

    #[test]
    fn serializes_camel_case_for_frontend() {
        let report = run_all::<fake::Healthy>();
        let json = serde_json::to_value(&report).unwrap();
        assert_eq!(json["overall"], "healthy");
        assert!(json["generatedAt"].is_u64());
        assert!(json["durationMs"].is_u64());
        let first = &json["checks"][0];
        assert_eq!(first["id"], "system");
        assert!(first["reasons"].is_array());
        assert!(first["sources"].is_array());
        assert!(first["notes"].is_array());
        assert_eq!(json["checks"][8]["id"], "ownership");
        assert_eq!(json["checks"][5]["id"], "temperature");
        let not_applicable = serde_json::to_value(Status::NotApplicable).unwrap();
        assert_eq!(not_applicable, "notApplicable");
    }

    /// Menjalankan diagnostik ASLI di perangkat ini dan menyimpan laporannya
    /// (tanpa nomor seri) ke file JSON, untuk dokumentasi/verifikasi:
    /// `LHC_REPORT_OUT=/path/report.json cargo test dump_real_report -- --ignored`
    #[test]
    #[ignore = "membaca perangkat asli dan menulis file"]
    fn dump_real_report() {
        let Some(path) = std::env::var_os("LHC_REPORT_OUT") else {
            return;
        };
        let report = run_all::<crate::platform::Current>();
        std::fs::write(path, serde_json::to_string_pretty(&report).unwrap()).unwrap();
    }
}
