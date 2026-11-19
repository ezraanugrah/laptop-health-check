//! Penilaian temperatur (CPU, GPU, baterai) dari SMC macOS.

use super::findings::Findings;
use super::format::{format_celsius, format_percent};
use super::is_light_load;
use super::raw::{SensorKind, SensorReadings};
use super::text::Text;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;
use crate::tr;

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
                r.metrics.push(Metric::new(
                    tr!("temperature.metric.battery", "Baterai"),
                    format_celsius(t),
                ));
            }
            r
        }
    }
}

/// Pesan suhu CPU dengan beban yang diketahui/tidak diketahui.
fn cpu_reason(
    known: (&'static str, String),
    unknown: (&'static str, String),
    temp: &str,
    limit: f64,
    load: Option<&str>,
) -> Text {
    match load {
        Some(load) => Text::coded(
            known.0,
            known.1,
            [
                ("temp", temp.to_string()),
                ("limit", limit.to_string()),
                ("load", load.to_string()),
            ],
        ),
        None => Text::coded(
            unknown.0,
            unknown.1,
            [("temp", temp.to_string()), ("limit", limit.to_string())],
        ),
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
    let load = cpu_load.map(format_percent);
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
        Some((max, _, _)) if max >= cpu_crit => {
            let temp = format_celsius(max);
            f.critical(cpu_reason(
                (
                    "temperature.reason.cpuCriticalLoad",
                    format!("Suhu CPU {temp} (≥{cpu_crit} °C, {load_text})."),
                ),
                (
                    "temperature.reason.cpuCritical",
                    format!("Suhu CPU {temp} (≥{cpu_crit} °C, {load_text})."),
                ),
                &temp,
                cpu_crit,
                load.as_deref(),
            ))
        }
        Some((max, _, _)) if max >= cpu_warn => {
            let temp = format_celsius(max);
            f.warning(cpu_reason(
                (
                    "temperature.reason.cpuWarningLoad",
                    format!("Suhu CPU {temp} (≥{cpu_warn} °C, {load_text})."),
                ),
                (
                    "temperature.reason.cpuWarning",
                    format!("Suhu CPU {temp} (≥{cpu_warn} °C, {load_text})."),
                ),
                &temp,
                cpu_warn,
                load.as_deref(),
            ))
        }
        Some((max, _, _)) => {
            let temp = format_celsius(max);
            f.ok(cpu_reason(
                (
                    "temperature.reason.cpuOkLoad",
                    format!("Suhu CPU tertinggi {temp} — normal untuk {load_text}."),
                ),
                (
                    "temperature.reason.cpuOk",
                    format!("Suhu CPU tertinggi {temp} — normal untuk {load_text}."),
                ),
                &temp,
                cpu_warn,
                load.as_deref(),
            ))
        }
        None => f.info(tr!(
            "temperature.reason.noCpuSensor",
            "Tidak ada sensor suhu CPU yang dikenali di Mac ini."
        )),
    }

    let gpu = stats(readings, SensorKind::Gpu);
    if let Some((max, _, _)) = gpu
        && light
        && max >= GPU_LIGHT_WARNING_C
    {
        let temp = format_celsius(max);
        f.warning(tr!(
            "temperature.reason.gpuHotLightLoad",
            format!("Suhu GPU {temp} saat beban ringan (≥{GPU_LIGHT_WARNING_C} °C)."),
            temp = temp,
            limit = GPU_LIGHT_WARNING_C
        ));
    }

    // Suhu baterai: utamakan ioreg (resmi), lalu sensor SMC.
    let battery = battery_temp.or_else(|| stats(readings, SensorKind::Battery).map(|s| s.0));
    if let Some(t) = battery.filter(|t| *t >= BATTERY_WARNING_C) {
        let temp = format_celsius(t);
        f.warning(tr!(
            "battery.reason.hot",
            format!("Suhu baterai {temp} (≥{BATTERY_WARNING_C} °C)."),
            temp = temp,
            limit = BATTERY_WARNING_C
        ));
    }

    let status = f.status(cpu.is_some());
    let summary = match status {
        Status::Healthy => tr!(
            "temperature.summary.healthy",
            "Suhu komponen dalam batas normal."
        ),
        Status::Warning => tr!(
            "temperature.summary.warning",
            "Suhu komponen tinggi — perlu perhatian."
        ),
        Status::Critical => tr!(
            "temperature.summary.critical",
            "Suhu komponen sangat tinggi."
        ),
        _ => tr!(
            "temperature.summary.unknown",
            "Suhu komponen tidak dapat dibaca."
        ),
    };

    let mut metrics = Vec::new();
    if let Some((max, avg, n)) = cpu {
        metrics.push(Metric::new(
            tr!("temperature.metric.cpuMax", "CPU tertinggi"),
            format_celsius(max),
        ));
        let temp = format_celsius(avg);
        metrics.push(Metric::new(
            tr!("temperature.metric.cpuAvg", "CPU rata-rata"),
            tr!(
                "temperature.value.sensors",
                format!("{temp} ({n} sensor)"),
                temp = temp,
                n = n
            ),
        ));
    }
    if let Some((max, _, n)) = gpu {
        let temp = format_celsius(max);
        metrics.push(Metric::new(
            tr!("temperature.metric.gpuMax", "GPU tertinggi"),
            tr!(
                "temperature.value.sensors",
                format!("{temp} ({n} sensor)"),
                temp = temp,
                n = n
            ),
        ));
    }
    if let Some(t) = battery {
        metrics.push(Metric::new(
            tr!("temperature.metric.battery", "Baterai"),
            format_celsius(t),
        ));
    }
    if let Some(l) = cpu_load {
        metrics.push(Metric::new(
            tr!("temperature.metric.cpuLoad", "Beban CPU saat diukur"),
            format_percent(l),
        ));
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
}
