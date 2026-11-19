//! Penilaian CPU: informasi & status termal (*throttling*) dari pmset macOS.

use super::findings::Findings;
use super::format::{format_ghz, format_percent};
use super::raw::CpuInfo;
use super::text::Text;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;
use crate::tr;

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
    let load = info.load_percent.map(format_percent);

    let mut core_evidence = false;
    match &info.thermal {
        None => f.info(tr!(
            "cpu.reason.thermalUnreadable",
            "Status termal CPU tidak dapat dibaca (pmset)."
        )),
        Some(t) => {
            if let (Some(available), Some(logical)) = (t.available_cpus, info.logical_cores)
                && available < logical
            {
                f.critical(tr!(
                    "cpu.reason.cpusDisabled",
                    format!("macOS menonaktifkan sebagian CPU karena kondisi termal ({available} dari {logical} aktif)."),
                    available = available,
                    logical = logical
                ));
            }
            match t.speed_limit_percent {
                Some(limit) if limit < SPEED_LIMIT_CRITICAL_BELOW => {
                    core_evidence = true;
                    f.critical(match &load {
                        Some(l) => tr!(
                            "cpu.reason.speedLimitCriticalLoad",
                            format!(
                                "Kecepatan CPU dibatasi ke {limit}% (beban saat diperiksa {l})."
                            ),
                            limit = limit,
                            load = l
                        ),
                        None => tr!(
                            "cpu.reason.speedLimitCritical",
                            format!("Kecepatan CPU dibatasi ke {limit}%."),
                            limit = limit
                        ),
                    });
                }
                Some(limit) if limit < 100 => {
                    core_evidence = true;
                    f.warning(match &load {
                        Some(l) => tr!(
                            "cpu.reason.throttledLoad",
                            format!("Kecepatan CPU dibatasi ke {limit}% (thermal throttling) (beban saat diperiksa {l})."),
                            limit = limit,
                            load = l
                        ),
                        None => tr!(
                            "cpu.reason.throttled",
                            format!("Kecepatan CPU dibatasi ke {limit}% (thermal throttling)."),
                            limit = limit
                        ),
                    });
                }
                Some(_) => {
                    core_evidence = true;
                    f.ok(tr!(
                        "cpu.reason.noSpeedLimit",
                        "Tidak ada pembatasan kecepatan CPU (CPU_Speed_Limit 100%)."
                    ));
                }
                None => {}
            }
            if let Some(limit) = t.scheduler_limit_percent.filter(|l| *l < 100) {
                f.warning(tr!(
                    "cpu.reason.schedulerLimited",
                    format!("Penjadwal CPU dibatasi ke {limit}%."),
                    limit = limit
                ));
            }
            match t.thermal_warning_recorded {
                Some(true) => f.warning(tr!(
                    "cpu.reason.thermalWarning",
                    "macOS mencatat peringatan termal."
                )),
                Some(false) => {
                    core_evidence = true;
                    f.ok(tr!(
                        "cpu.reason.noThermalWarning",
                        "macOS tidak mencatat peringatan termal."
                    ));
                }
                None => {}
            }
            if t.performance_warning_recorded == Some(true) {
                f.warning(tr!(
                    "cpu.reason.performanceWarning",
                    "macOS mencatat peringatan performa."
                ));
            }
        }
    }

    let status = f.status(core_evidence);
    let summary = match status {
        Status::Healthy => tr!(
            "cpu.summary.healthy",
            "CPU bekerja tanpa pembatasan termal."
        ),
        Status::Warning => tr!(
            "cpu.summary.warning",
            "CPU mengalami pembatasan termal — perlu perhatian."
        ),
        Status::Critical => tr!(
            "cpu.summary.critical",
            "CPU dibatasi berat karena kondisi termal."
        ),
        _ => tr!(
            "cpu.summary.unknown",
            "Status termal CPU tidak dapat dipastikan."
        ),
    };

    let mut metrics = Vec::new();
    if let Some(m) = &info.model {
        metrics.push(Metric::new(tr!("metric.model", "Model"), m.clone()));
    }
    if let Some(c) = cores_value(info) {
        metrics.push(Metric::new(tr!("cpu.metric.cores", "Core"), c));
    }
    if let Some(hz) = info.base_frequency_hz {
        metrics.push(Metric::new(
            tr!("cpu.metric.baseFrequency", "Frekuensi dasar"),
            format_ghz(hz),
        ));
    }
    if let Some(l) = info.load_percent {
        metrics.push(Metric::new(
            tr!("cpu.metric.load", "Beban saat diperiksa"),
            format_percent(l),
        ));
    }
    if let Some(t) = &info.thermal {
        if let Some(limit) = t.speed_limit_percent {
            metrics.push(Metric::new(
                tr!("cpu.metric.speedLimit", "Batas kecepatan CPU"),
                format!("{limit}%"),
            ));
        }
        if let Some(w) = t.thermal_warning_recorded {
            metrics.push(Metric::new(
                tr!("cpu.metric.thermalWarning", "Peringatan termal"),
                if w {
                    tr!("value.recorded", "Tercatat")
                } else {
                    tr!("value.notRecorded", "Tidak tercatat")
                },
            ));
        }
    }

    CheckResult::new(CheckId::Cpu, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
}

/// Jumlah core: fisik/logis, ditambah pembagian performa/efisiensi bila ada.
fn cores_value(info: &CpuInfo) -> Option<Text> {
    let split = info.performance_cores.zip(info.efficiency_cores);
    Some(match (info.physical_cores, info.logical_cores, split) {
        (Some(p), Some(l), Some((pc, ec))) => tr!(
            "cpu.value.coresBothSplit",
            format!("{p} fisik / {l} logis · {pc} performa + {ec} efisiensi"),
            physical = p,
            logical = l,
            perf = pc,
            eff = ec
        ),
        (Some(p), Some(l), None) => tr!(
            "cpu.value.coresBoth",
            format!("{p} fisik / {l} logis"),
            physical = p,
            logical = l
        ),
        (Some(p), None, Some((pc, ec))) => tr!(
            "cpu.value.coresPhysicalSplit",
            format!("{p} fisik · {pc} performa + {ec} efisiensi"),
            physical = p,
            perf = pc,
            eff = ec
        ),
        (Some(p), None, None) => tr!(
            "cpu.value.coresPhysical",
            format!("{p} fisik"),
            physical = p
        ),
        (None, Some(l), Some((pc, ec))) => tr!(
            "cpu.value.coresLogicalSplit",
            format!("{l} logis · {pc} performa + {ec} efisiensi"),
            logical = l,
            perf = pc,
            eff = ec
        ),
        (None, Some(l), None) => tr!("cpu.value.coresLogical", format!("{l} logis"), logical = l),
        (None, None, _) => return None,
    })
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
