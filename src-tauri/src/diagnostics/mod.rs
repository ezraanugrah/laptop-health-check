//! Logika diagnostik: menilai data mentah dari lapisan `platform` (tanpa API OS).
//!
//! Alur: lapisan [`crate::platform`] membaca data mentah ([`raw`]) secara
//! paralel, lalu setiap modul pemeriksaan menilainya menjadi
//! [`types::CheckResult`]. Modul di sini TIDAK memanggil API OS.

pub mod device_profile;
pub mod format;
pub mod raw;
pub mod text;
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
use types::{
    CheckCategory, CheckId, CheckResult, DiagnosticsReport, HardwareStatus, HardwareSummary, Status,
};

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

    // Sumber data & keterbatasan berasal dari lapisan platform.
    let finish = |r: CheckResult| {
        let id = r.id;
        r.with_sources(P::sources(id)).with_notes(P::notes(id))
    };

    let checks = vec![
        finish(system::evaluate(&overview)),
        finish(battery::evaluate(&battery)),
        finish(storage::evaluate(&storage)),
        finish(memory::evaluate(&memory)),
        finish(cpu::evaluate(&cpu)),
        finish(temperature::evaluate(&sensors, battery_temp, cpu_load)),
        finish(fans::evaluate(&sensors, cpu_max_temp, cpu_load)),
        finish(gpu::evaluate(&gpu)),
        finish(ownership::evaluate(&ownership)),
    ];

    DiagnosticsReport {
        hardware: hardware_summary(&checks),
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

/// Kesimpulan kesehatan hardware (lihat ARCHITECTURE.md §4):
/// - Hanya pemeriksaan hardware yang dihitung; identitas, keamanan OS, dan
///   kepemilikan (`DeviceSecurity`) tidak memengaruhi kesimpulan ini.
/// - Temuan Kritis/Peringatan selalu ditampilkan walau data lain belum lengkap.
/// - Bila ada pemeriksaan INTI yang "Tidak diketahui", hasilnya
///   "Pemeriksaan belum lengkap" — tidak pernah disimpulkan sehat.
/// - Pemeriksaan pelengkap yang tidak terukur hanya dicatat di cakupan.
pub fn hardware_summary(checks: &[CheckResult]) -> HardwareSummary {
    let hardware: Vec<&CheckResult> = checks
        .iter()
        .filter(|c| c.category != CheckCategory::DeviceSecurity)
        .collect();
    let missing = |category: CheckCategory| -> Vec<CheckId> {
        hardware
            .iter()
            .filter(|c| c.category == category && c.status == Status::Unknown)
            .map(|c| c.id)
            .collect()
    };
    let missing_core = missing(CheckCategory::CoreHardware);
    let missing_supplementary = missing(CheckCategory::SupplementaryHardware);
    let has_core = hardware
        .iter()
        .any(|c| c.category == CheckCategory::CoreHardware);
    let any = |status: Status| hardware.iter().any(|c| c.status == status);

    let status = if any(Status::Critical) {
        HardwareStatus::Critical
    } else if any(Status::Warning) {
        HardwareStatus::Warning
    } else if !missing_core.is_empty() || !has_core {
        HardwareStatus::Incomplete
    } else {
        HardwareStatus::Healthy
    };

    HardwareSummary {
        status,
        measured: hardware
            .iter()
            .filter(|c| c.status != Status::Unknown)
            .count(),
        total: hardware.len(),
        missing_core,
        missing_supplementary,
    }
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

    const ALL: [CheckId; 9] = [
        CheckId::System,
        CheckId::Battery,
        CheckId::Storage,
        CheckId::Memory,
        CheckId::Cpu,
        CheckId::Temperature,
        CheckId::Fans,
        CheckId::Gpu,
        CheckId::Ownership,
    ];

    /// Semua pemeriksaan Sehat, kecuali yang di-override.
    fn checks(overrides: &[(CheckId, Status)]) -> Vec<CheckResult> {
        ALL.iter()
            .map(|&id| {
                let status = overrides
                    .iter()
                    .find(|(o, _)| *o == id)
                    .map_or(Status::Healthy, |(_, s)| *s);
                CheckResult::new(id, status, "")
            })
            .collect()
    }

    #[test]
    fn categories_follow_d1() {
        use CheckCategory::*;
        assert_eq!(CheckId::Battery.category(), CoreHardware);
        assert_eq!(CheckId::Storage.category(), CoreHardware);
        assert_eq!(CheckId::Memory.category(), CoreHardware);
        assert_eq!(CheckId::Cpu.category(), CoreHardware);
        assert_eq!(CheckId::Temperature.category(), SupplementaryHardware);
        assert_eq!(CheckId::Fans.category(), SupplementaryHardware);
        assert_eq!(CheckId::Gpu.category(), SupplementaryHardware);
        assert_eq!(CheckId::System.category(), DeviceSecurity);
        assert_eq!(CheckId::Ownership.category(), DeviceSecurity);
    }

    #[test]
    fn all_healthy() {
        let s = hardware_summary(&checks(&[]));
        assert_eq!(s.status, HardwareStatus::Healthy);
        assert_eq!((s.measured, s.total), (7, 7));
        assert!(s.missing_core.is_empty() && s.missing_supplementary.is_empty());
    }

    #[test]
    fn missing_core_is_incomplete_never_healthy() {
        let s = hardware_summary(&checks(&[(CheckId::Battery, Status::Unknown)]));
        assert_eq!(s.status, HardwareStatus::Incomplete);
        assert_eq!(s.missing_core, [CheckId::Battery]);
        assert_eq!(s.measured, 6);
    }

    #[test]
    fn missing_supplementary_keeps_conclusion_but_reports_coverage() {
        let s = hardware_summary(&checks(&[
            (CheckId::Fans, Status::Unknown),
            (CheckId::Temperature, Status::Unknown),
        ]));
        assert_eq!(s.status, HardwareStatus::Healthy);
        assert_eq!(
            s.missing_supplementary,
            [CheckId::Temperature, CheckId::Fans]
        );
        assert_eq!((s.measured, s.total), (5, 7));
    }

    #[test]
    fn findings_are_shown_even_when_incomplete() {
        let s = hardware_summary(&checks(&[
            (CheckId::Cpu, Status::Unknown),
            (CheckId::Storage, Status::Warning),
        ]));
        assert_eq!(s.status, HardwareStatus::Warning);
        assert_eq!(s.missing_core, [CheckId::Cpu]);

        let s = hardware_summary(&checks(&[
            (CheckId::Memory, Status::Unknown),
            (CheckId::Gpu, Status::Critical),
        ]));
        assert_eq!(s.status, HardwareStatus::Critical);
    }

    #[test]
    fn os_security_and_ownership_do_not_affect_hardware_health() {
        let s = hardware_summary(&checks(&[
            (CheckId::System, Status::Warning),
            (CheckId::Ownership, Status::Warning),
        ]));
        assert_eq!(s.status, HardwareStatus::Healthy);
        assert_eq!(s.total, 7);
    }

    #[test]
    fn not_applicable_counts_as_measured() {
        let s = hardware_summary(&checks(&[
            (CheckId::Battery, Status::NotApplicable),
            (CheckId::Fans, Status::NotApplicable),
        ]));
        assert_eq!(s.status, HardwareStatus::Healthy);
        assert_eq!(s.measured, 7);
    }

    #[test]
    fn no_hardware_checks_is_incomplete() {
        let only_device = [CheckResult::new(CheckId::System, Status::Healthy, "")];
        assert_eq!(
            hardware_summary(&only_device).status,
            HardwareStatus::Incomplete
        );
    }

    #[test]
    fn light_load_requires_known_value() {
        assert!(is_light_load(Some(29.9)));
        assert!(!is_light_load(Some(30.0)));
        assert!(!is_light_load(None));
    }

    #[test]
    fn run_all_returns_every_check_in_order_with_platform_sources_and_notes() {
        let report = run_all::<fake::Healthy>();
        let ids: Vec<CheckId> = report.checks.iter().map(|c| c.id).collect();
        assert_eq!(ids, ALL);
        for c in &report.checks {
            assert_eq!(c.status, Status::Healthy, "{:?}: {:?}", c.id, c.reasons);
            assert_eq!(c.category, c.id.category());
            assert_eq!(c.sources, ["sumber uji"]);
            assert_eq!(c.notes, ["catatan uji"]);
        }
        assert_eq!(report.hardware.status, HardwareStatus::Healthy);
        assert!(report.generated_at > 0);
    }

    #[test]
    fn failing_probes_become_unknown_and_incomplete() {
        let report = run_all::<fake::Failing>();
        assert!(report.checks.iter().all(|c| c.status == Status::Unknown));
        assert!(
            report
                .checks
                .iter()
                .all(|c| c.reasons.iter().any(|r| r.text.contains("gagal (uji)")))
        );
        assert_eq!(report.hardware.status, HardwareStatus::Incomplete);
        assert_eq!(report.hardware.missing_core.len(), 4);
        assert_eq!(report.hardware.measured, 0);
    }

    #[test]
    fn serializes_camel_case_for_frontend() {
        let report = run_all::<fake::Healthy>();
        let json = serde_json::to_value(&report).unwrap();
        assert_eq!(json["hardware"]["status"], "healthy");
        assert!(json["hardware"]["missingCore"].is_array());
        assert!(json["hardware"]["missingSupplementary"].is_array());
        assert_eq!(json["hardware"]["total"], 7);
        assert!(json["generatedAt"].is_u64());
        assert!(json["durationMs"].is_u64());
        let first = &json["checks"][0];
        assert_eq!(first["id"], "system");
        assert_eq!(first["category"], "deviceSecurity");
        assert_eq!(json["checks"][1]["category"], "coreHardware");
        assert_eq!(json["checks"][5]["category"], "supplementaryHardware");
        assert_eq!(first["metrics"][0]["experimental"], false);
        assert!(first["reasons"].is_array() && first["sources"].is_array());
        assert_eq!(json["checks"][8]["id"], "ownership");
        let incomplete = serde_json::to_value(HardwareStatus::Incomplete).unwrap();
        assert_eq!(incomplete, "incomplete");
        let na = serde_json::to_value(Status::NotApplicable).unwrap();
        assert_eq!(na, "notApplicable");
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
