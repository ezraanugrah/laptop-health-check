//! Penilaian CPU: informasi & status termal (*throttling*).

use super::findings::Findings;
use super::format::{format_ghz, format_percent};
use super::raw::CpuInfo;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

/// Batas kecepatan CPU di bawah nilai ini (%) = kritis.
pub const SPEED_LIMIT_CRITICAL_BELOW: u32 = 50;

pub fn evaluate(data: &Result<CpuInfo, ProbeError>) -> CheckResult {
    match data {
        Ok(info) => assess(info),
        Err(err) => CheckResult::from_probe_error(CheckId::Cpu, err),
    }
}

pub fn assess(info: &CpuInfo) -> CheckResult {
    let mut f = Findings::default();
    let load_text = info
        .load_percent
        .map(|l| format!(" (beban saat diperiksa {})", format_percent(l)))
        .unwrap_or_default();

    let mut core_evidence = false;
    match &info.thermal {
        None => f.info("Status termal CPU tidak dapat dibaca (pmset)."),
        Some(t) => {
            if let (Some(available), Some(logical)) = (t.available_cpus, info.logical_cores)
                && available < logical
            {
                f.critical(format!(
                    "macOS menonaktifkan sebagian CPU karena kondisi termal ({available} dari {logical} aktif)."
                ));
            }
            match t.speed_limit_percent {
                Some(limit) if limit < SPEED_LIMIT_CRITICAL_BELOW => {
                    core_evidence = true;
                    f.critical(format!("Kecepatan CPU dibatasi ke {limit}%{load_text}."));
                }
                Some(limit) if limit < 100 => {
                    core_evidence = true;
                    f.warning(format!(
                        "Kecepatan CPU dibatasi ke {limit}% (thermal throttling){load_text}."
                    ));
                }
                Some(_) => {
                    core_evidence = true;
                    f.ok("Tidak ada pembatasan kecepatan CPU (CPU_Speed_Limit 100%).");
                }
                None => {}
            }
            if let Some(limit) = t.scheduler_limit_percent.filter(|l| *l < 100) {
                f.warning(format!("Penjadwal CPU dibatasi ke {limit}%."));
            }
            match t.thermal_warning_recorded {
                Some(true) => f.warning("macOS mencatat peringatan termal."),
                Some(false) => {
                    core_evidence = true;
                    f.ok("macOS tidak mencatat peringatan termal.");
                }
                None => {}
            }
            if t.performance_warning_recorded == Some(true) {
                f.warning("macOS mencatat peringatan performa.");
            }
        }
    }

    let status = f.status(core_evidence);
    let summary = match status {
        Status::Healthy => "CPU bekerja tanpa pembatasan termal.",
        Status::Warning => "CPU mengalami pembatasan termal — perlu perhatian.",
        Status::Critical => "CPU dibatasi berat karena kondisi termal.",
        _ => "Status termal CPU tidak dapat dipastikan.",
    };

    let mut metrics = Vec::new();
    if let Some(m) = &info.model {
        metrics.push(Metric::new("Model", m.clone()));
    }
    let cores = match (info.physical_cores, info.logical_cores) {
        (Some(p), Some(l)) => Some(format!("{p} fisik / {l} logis")),
        (Some(p), None) => Some(format!("{p} fisik")),
        (None, Some(l)) => Some(format!("{l} logis")),
        _ => None,
    };
    if let Some(c) = cores {
        let split = match (info.performance_cores, info.efficiency_cores) {
            (Some(p), Some(e)) => format!(" · {p} performa + {e} efisiensi"),
            _ => String::new(),
        };
        metrics.push(Metric::new("Core", format!("{c}{split}")));
    }
    if let Some(hz) = info.base_frequency_hz {
        metrics.push(Metric::new("Frekuensi dasar", format_ghz(hz)));
    }
    if let Some(l) = info.load_percent {
        metrics.push(Metric::new("Beban saat diperiksa", format_percent(l)));
    }
    if let Some(t) = &info.thermal {
        if let Some(limit) = t.speed_limit_percent {
            metrics.push(Metric::new("Batas kecepatan CPU", format!("{limit}%")));
        }
        if let Some(w) = t.thermal_warning_recorded {
            metrics.push(Metric::new(
                "Peringatan termal",
                if w { "Tercatat" } else { "Tidak tercatat" },
            ));
        }
    }

    CheckResult::new(CheckId::Cpu, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
        .with_notes(vec![
            "Status termal dibaca dari catatan macOS (pmset). Uji beban CPU belum tersedia di versi ini.".into(),
        ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::raw::ThermalStatus;

    fn cpu(speed: Option<u32>, warning: Option<bool>) -> CpuInfo {
        CpuInfo {
            logical_cores: Some(8),
            load_percent: Some(12.0),
            thermal: Some(ThermalStatus {
                speed_limit_percent: speed,
                available_cpus: Some(8),
                thermal_warning_recorded: warning,
                ..Default::default()
            }),
            ..Default::default()
        }
    }

    #[test]
    fn speed_limit_boundaries() {
        assert_eq!(assess(&cpu(Some(100), None)).status, Status::Healthy);
        assert_eq!(assess(&cpu(Some(99), None)).status, Status::Warning);
        assert_eq!(assess(&cpu(Some(50), None)).status, Status::Warning);
        assert_eq!(assess(&cpu(Some(49), None)).status, Status::Critical);
    }

    #[test]
    fn recorded_thermal_warning() {
        assert_eq!(assess(&cpu(Some(100), Some(true))).status, Status::Warning);
        // Apple Silicon: tanpa CPU_Speed_Limit, cukup catatan "tidak ada peringatan".
        assert_eq!(assess(&cpu(None, Some(false))).status, Status::Healthy);
    }

    #[test]
    fn disabled_cpus_are_critical() {
        let mut info = cpu(Some(100), Some(false));
        info.thermal.as_mut().unwrap().available_cpus = Some(6);
        assert_eq!(assess(&info).status, Status::Critical);
    }

    #[test]
    fn no_thermal_data_is_unknown() {
        assert_eq!(assess(&cpu(None, None)).status, Status::Unknown);
        let info = CpuInfo {
            thermal: None,
            ..Default::default()
        };
        assert_eq!(assess(&info).status, Status::Unknown);
    }

    #[test]
    fn apple_silicon_core_split_metric() {
        let info = CpuInfo {
            physical_cores: Some(8),
            logical_cores: Some(8),
            performance_cores: Some(4),
            efficiency_cores: Some(4),
            ..cpu(None, Some(false))
        };
        let r = assess(&info);
        let core = r.metrics.iter().find(|m| m.label == "Core").unwrap();
        assert_eq!(core.value, "8 fisik / 8 logis · 4 performa + 4 efisiensi");
    }
}
