//! Penilaian temperatur (CPU, GPU, baterai, zona termal ACPI), lintas OS.

use super::findings::Findings;
use super::format::{format_celsius, format_percent};
use super::is_light_load;
use super::raw::{SensorKind, SensorReadings};
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

/// Ambang suhu CPU saat beban ringan (°C).
pub const CPU_LIGHT_WARNING_C: f64 = 80.0;
pub const CPU_LIGHT_CRITICAL_C: f64 = 95.0;
/// Ambang suhu CPU saat beban tinggi/tidak diketahui (°C).
pub const CPU_LOADED_WARNING_C: f64 = 95.0;
pub const CPU_LOADED_CRITICAL_C: f64 = 105.0;
/// Ambang suhu GPU saat beban ringan (°C).
pub const GPU_LIGHT_WARNING_C: f64 = 85.0;
/// Ambang suhu baterai (°C).
pub const BATTERY_WARNING_C: f64 = 45.0;
/// Ambang zona termal ACPI (°C). Konservatif karena maknanya berbeda antar-OEM.
pub const ZONE_WARNING_C: f64 = 95.0;
pub const ZONE_CRITICAL_C: f64 = 105.0;

pub fn evaluate(
    data: &Result<SensorReadings, ProbeError>,
    battery_temp: Option<f64>,
    cpu_load: Option<f64>,
) -> CheckResult {
    match data {
        Ok(readings) => assess(readings, battery_temp, cpu_load),
        Err(err) => {
            let mut r = CheckResult::from_probe_error(CheckId::Temperature, err);
            if let Some(t) = battery_temp {
                r.metrics.push(Metric::new("Baterai", format_celsius(t)));
            }
            r
        }
    }
}

fn stats(readings: &SensorReadings, kind: SensorKind) -> Option<(f64, f64, usize)> {
    let values: Vec<f64> = readings
        .temperatures
        .iter()
        .filter(|t| t.kind == kind)
        .map(|t| t.celsius)
        .collect();
    if values.is_empty() {
        return None;
    }
    let max = values.iter().copied().fold(f64::MIN, f64::max);
    let avg = values.iter().sum::<f64>() / values.len() as f64;
    Some((max, avg, values.len()))
}

pub fn assess(
    readings: &SensorReadings,
    battery_temp: Option<f64>,
    cpu_load: Option<f64>,
) -> CheckResult {
    let mut f = Findings::default();
    let light = is_light_load(cpu_load);
    let load_text = match cpu_load {
        Some(l) => format!("beban CPU {}", format_percent(l)),
        None => "beban CPU tidak diketahui".to_string(),
    };
    let (cpu_warn, cpu_crit) = if light {
        (CPU_LIGHT_WARNING_C, CPU_LIGHT_CRITICAL_C)
    } else {
        (CPU_LOADED_WARNING_C, CPU_LOADED_CRITICAL_C)
    };

    let cpu = stats(readings, SensorKind::Cpu);
    match cpu {
        Some((max, _, _)) if max >= cpu_crit => f.critical(format!(
            "Suhu CPU {} (≥{cpu_crit} °C, {load_text}).",
            format_celsius(max)
        )),
        Some((max, _, _)) if max >= cpu_warn => f.warning(format!(
            "Suhu CPU {} (≥{cpu_warn} °C, {load_text}).",
            format_celsius(max)
        )),
        Some((max, _, _)) => f.ok(format!(
            "Suhu CPU tertinggi {} — normal untuk {load_text}.",
            format_celsius(max)
        )),
        None => {
            f.info("Suhu die CPU tidak tersedia dari sensor yang dikenali di perangkat/OS ini.")
        }
    }

    let zones = stats(readings, SensorKind::ThermalZone);
    match zones {
        Some((max, _, _)) if max >= ZONE_CRITICAL_C => f.critical(format!(
            "Suhu zona termal sistem {} (≥{ZONE_CRITICAL_C} °C). Nilai ini bukan suhu die CPU.",
            format_celsius(max)
        )),
        Some((max, _, _)) if max >= ZONE_WARNING_C => f.warning(format!(
            "Suhu zona termal sistem {} (≥{ZONE_WARNING_C} °C). Nilai ini bukan suhu die CPU.",
            format_celsius(max)
        )),
        Some((max, _, _)) => f.ok(format!(
            "Suhu zona termal sistem tertinggi {} — dalam batas wajar. Nilai ini bukan suhu die CPU.",
            format_celsius(max)
        )),
        None => {}
    }

    let gpu = stats(readings, SensorKind::Gpu);
    if let Some((max, _, _)) = gpu
        && light
        && max >= GPU_LIGHT_WARNING_C
    {
        f.warning(format!(
            "Suhu GPU {} saat beban ringan (≥{GPU_LIGHT_WARNING_C} °C).",
            format_celsius(max)
        ));
    }

    // Suhu baterai: utamakan ioreg (resmi), lalu sensor SMC.
    let battery = battery_temp.or_else(|| stats(readings, SensorKind::Battery).map(|s| s.0));
    if let Some(t) = battery.filter(|t| *t >= BATTERY_WARNING_C) {
        f.warning(format!(
            "Suhu baterai {} (≥{BATTERY_WARNING_C} °C).",
            format_celsius(t)
        ));
    }

    let status = f.status(cpu.is_some() || zones.is_some());
    let summary = match status {
        Status::Healthy => "Suhu komponen dalam batas normal.",
        Status::Warning => "Suhu komponen tinggi — perlu perhatian.",
        Status::Critical => "Suhu komponen sangat tinggi.",
        _ => "Suhu komponen tidak dapat dibaca.",
    };

    let mut metrics = Vec::new();
    if let Some((max, avg, n)) = cpu {
        metrics.push(Metric::new("CPU tertinggi", format_celsius(max)));
        metrics.push(Metric::new(
            "CPU rata-rata",
            format!("{} ({n} sensor)", format_celsius(avg)),
        ));
    }
    if let Some((max, _, n)) = gpu {
        metrics.push(Metric::new(
            "GPU tertinggi",
            format!("{} ({n} sensor)", format_celsius(max)),
        ));
    }
    if let Some((max, _, n)) = zones {
        metrics.push(Metric::new(
            "Zona termal sistem (maks)",
            format!("{} ({n} zona)", format_celsius(max)),
        ));
    }
    if let Some(t) = battery {
        metrics.push(Metric::new("Baterai", format_celsius(t)));
    }
    if let Some(l) = cpu_load {
        metrics.push(Metric::new("Beban CPU saat diukur", format_percent(l)));
    }

    CheckResult::new(CheckId::Temperature, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::raw::TemperatureReading;

    fn readings(cpu: &[f64], gpu: &[f64]) -> SensorReadings {
        let mut temperatures = Vec::new();
        for (i, c) in cpu.iter().enumerate() {
            temperatures.push(TemperatureReading {
                key: format!("TC{i}C"),
                kind: SensorKind::Cpu,
                celsius: *c,
            });
        }
        for g in gpu {
            temperatures.push(TemperatureReading {
                key: "TG0P".into(),
                kind: SensorKind::Gpu,
                celsius: *g,
            });
        }
        SensorReadings {
            temperatures,
            fans: None,
        }
    }

    #[test]
    fn light_load_cpu_boundaries() {
        let light = Some(10.0);
        assert_eq!(
            assess(&readings(&[79.9], &[]), None, light).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&readings(&[80.0], &[]), None, light).status,
            Status::Warning
        );
        assert_eq!(
            assess(&readings(&[94.9], &[]), None, light).status,
            Status::Warning
        );
        assert_eq!(
            assess(&readings(&[95.0], &[]), None, light).status,
            Status::Critical
        );
    }

    #[test]
    fn heavy_or_unknown_load_cpu_boundaries() {
        for load in [Some(80.0), None] {
            assert_eq!(
                assess(&readings(&[94.9], &[]), None, load).status,
                Status::Healthy
            );
            assert_eq!(
                assess(&readings(&[95.0], &[]), None, load).status,
                Status::Warning
            );
            assert_eq!(
                assess(&readings(&[105.0], &[]), None, load).status,
                Status::Critical
            );
        }
    }

    #[test]
    fn gpu_and_battery_boundaries() {
        let light = Some(10.0);
        assert_eq!(
            assess(&readings(&[50.0], &[84.9]), None, light).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&readings(&[50.0], &[85.0]), None, light).status,
            Status::Warning
        );
        assert_eq!(
            assess(&readings(&[50.0], &[]), Some(44.9), light).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&readings(&[50.0], &[]), Some(45.0), light).status,
            Status::Warning
        );
    }

    #[test]
    fn no_cpu_sensor_is_unknown() {
        let r = assess(&readings(&[], &[40.0]), Some(30.0), Some(5.0));
        assert_eq!(r.status, Status::Unknown);
    }

    #[test]
    fn smc_failure_is_unknown_but_keeps_battery_metric() {
        let r = evaluate(
            &Err(ProbeError::new("SMC tidak tersedia")),
            Some(31.25),
            None,
        );
        assert_eq!(r.status, Status::Unknown);
        assert!(r.reasons[0].text.contains("SMC tidak tersedia"));
        assert_eq!(r.metrics[0].value, "31.2 °C");
    }

    #[test]
    fn metrics_show_max_and_average() {
        let r = assess(&readings(&[50.0, 60.0], &[]), None, Some(10.0));
        assert_eq!(r.metrics[0].label, "CPU tertinggi");
        assert_eq!(r.metrics[0].value, "60.0 °C");
        assert_eq!(r.metrics[1].value, "55.0 °C (2 sensor)");
    }

    /// Zona termal ACPI bergaya Windows (contoh format, BUKAN data perangkat asli).
    fn zones(values: &[f64]) -> SensorReadings {
        SensorReadings {
            temperatures: values
                .iter()
                .map(|v| TemperatureReading {
                    key: "\\_TZ.THRM".into(),
                    kind: SensorKind::ThermalZone,
                    celsius: *v,
                })
                .collect(),
            fans: None,
        }
    }

    #[test]
    fn thermal_zone_boundaries_without_cpu_sensor() {
        assert_eq!(assess(&zones(&[94.9]), None, None).status, Status::Healthy);
        assert_eq!(assess(&zones(&[95.0]), None, None).status, Status::Warning);
        assert_eq!(assess(&zones(&[104.9]), None, None).status, Status::Warning);
        assert_eq!(
            assess(&zones(&[105.0]), None, None).status,
            Status::Critical
        );
    }

    #[test]
    fn thermal_zone_is_never_labelled_as_cpu() {
        let r = assess(&zones(&[48.0, 52.0]), None, Some(10.0));
        assert!(
            r.reasons
                .iter()
                .any(|x| x.text.contains("bukan suhu die CPU"))
        );
        assert!(r.metrics.iter().all(|m| !m.label.starts_with("CPU")));
        let z = r
            .metrics
            .iter()
            .find(|m| m.label == "Zona termal sistem (maks)")
            .unwrap();
        assert_eq!(z.value, "52.0 °C (2 zona)");
    }
}
