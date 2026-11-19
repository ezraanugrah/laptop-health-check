//! Penilaian kipas (dibaca dari SMC, read-only).

use super::findings::Findings;
use super::format::format_rpm;
use super::is_light_load;
use super::raw::{FanReading, SensorReadings};
use super::text::Text;
use super::types::{CheckId, CheckResult, Metric, Reason, Status};
use crate::platform::ProbeError;
use crate::tr;

/// Kipas di bawah rasio ini terhadap RPM minimum = peringatan.
pub const BELOW_MIN_WARNING_RATIO: f64 = 0.8;
/// Kipas ≥ rasio ini terhadap RPM maksimum saat beban ringan = peringatan.
pub const NEAR_MAX_WARNING_RATIO: f64 = 0.9;
/// CPU di atas suhu ini (°C) tetapi kipas diam = kritis.
pub const HOT_CPU_C: f64 = 85.0;

pub fn evaluate(
    data: &Result<SensorReadings, ProbeError>,
    cpu_max_temp: Option<f64>,
    cpu_load: Option<f64>,
) -> CheckResult {
    match data {
        Err(err) => CheckResult::from_probe_error(CheckId::Fans, err),
        Ok(readings) => match &readings.fans {
            // Data tidak tersedia ≠ tidak ada kipas: tetap "Tidak diketahui".
            None => CheckResult::new(
                CheckId::Fans,
                Status::Unknown,
                tr!("fans.summary.noData", "Data kipas tidak tersedia."),
            )
            .with_reasons(vec![Reason::info(tr!(
                "fans.reason.noData",
                "OS/sensor tidak menyediakan data kipas pada perangkat ini."
            ))]),
            Some(fans) if fans.is_empty() => CheckResult::new(
                CheckId::Fans,
                Status::NotApplicable,
                tr!("fans.summary.noFans", "Perangkat ini tidak memiliki kipas."),
            )
            .with_reasons(vec![Reason::info(tr!(
                "fans.reason.zeroFans",
                "Sensor melaporkan 0 kipas (normal untuk model tanpa kipas)."
            ))]),
            Some(fans) => assess(fans, cpu_max_temp, cpu_load),
        },
    }
}

pub fn assess(
    fans: &[FanReading],
    cpu_max_temp: Option<f64>,
    cpu_load: Option<f64>,
) -> CheckResult {
    let mut f = Findings::default();
    let light = is_light_load(cpu_load);
    let cpu_normal = cpu_max_temp.is_some_and(|t| t < HOT_CPU_C);
    let mut evidence = false;

    for fan in fans {
        let n = fan.index + 1;
        let name = format!("Kipas {n}");
        let Some(actual) = fan.actual_rpm else {
            f.info(tr!(
                "fans.reason.rpmUnreadable",
                format!("{name}: RPM aktual tidak terbaca."),
                fan = n
            ));
            continue;
        };
        evidence = true;
        match fan.min_rpm.filter(|m| *m > 0.0) {
            Some(min) if actual <= 0.0 => {
                let min = format_rpm(min);
                f.critical(tr!(
                    "fans.reason.stopped",
                    format!(
                        "{name} tidak berputar padahal minimum {min} — kemungkinan macet/rusak."
                    ),
                    fan = n,
                    min = min
                ))
            }
            Some(min) if actual < min * BELOW_MIN_WARNING_RATIO => {
                let (rpm, min) = (format_rpm(actual), format_rpm(min));
                f.warning(tr!(
                    "fans.reason.belowMin",
                    format!("{name} berputar {rpm} di bawah minimum {min}."),
                    fan = n,
                    rpm = rpm,
                    min = min
                ))
            }
            _ => {}
        }
        if let Some(max) = fan.max_rpm.filter(|m| *m > 0.0)
            && light
            && cpu_normal
            && actual >= max * NEAR_MAX_WARNING_RATIO
        {
            let (rpm, max) = (format_rpm(actual), format_rpm(max));
            f.warning(tr!(
                "fans.reason.nearMaxLightLoad",
                format!("{name} berputar {rpm} (mendekati maksimum {max}) saat beban CPU ringan. Bisa karena beban berat sebelumnya; bila menetap setelah beberapa menit, periksa debu/ventilasi."),
                fan = n,
                rpm = rpm,
                max = max
            ));
        }
        let rpm = format_rpm(actual);
        f.ok(tr!(
            "fans.reason.spinning",
            format!("{name} terbaca berputar {rpm}."),
            fan = n,
            rpm = rpm
        ));
    }

    let all_stopped = fans.iter().all(|x| x.actual_rpm.is_some_and(|a| a <= 0.0));
    if let Some(t) = cpu_max_temp.filter(|t| *t >= HOT_CPU_C)
        && all_stopped
    {
        let temp = format!("{t:.1}");
        f.critical(tr!(
            "fans.reason.hotAllStopped",
            format!("Suhu CPU {temp} °C tetapi semua kipas berhenti."),
            temp = temp
        ));
    }

    let status = f.status(evidence);
    let summary = match status {
        Status::Healthy => tr!("fans.summary.healthy", "Kipas bekerja normal."),
        Status::Warning => tr!("fans.summary.warning", "Kipas perlu perhatian."),
        Status::Critical => tr!("fans.summary.critical", "Kipas bermasalah."),
        _ => tr!(
            "fans.summary.unknown",
            "Kondisi kipas tidak dapat dipastikan."
        ),
    };

    let metrics = fans
        .iter()
        .map(|fan| {
            let n = fan.index + 1;
            let range = fan.min_rpm.zip(fan.max_rpm);
            let value: Text = match (fan.actual_rpm.map(format_rpm), range) {
                (Some(rpm), Some((min, max))) => {
                    let (min, max) = (min.round(), max.round());
                    tr!(
                        "fans.value.rpmRange",
                        format!("{rpm} (min {min} · maks {max})"),
                        rpm = rpm,
                        min = min,
                        max = max
                    )
                }
                (Some(rpm), None) => rpm.into(),
                (None, Some((min, max))) => {
                    let (min, max) = (min.round(), max.round());
                    tr!(
                        "fans.value.unreadableRange",
                        format!("Tidak terbaca (min {min} · maks {max})"),
                        min = min,
                        max = max
                    )
                }
                (None, None) => tr!("value.unreadable", "Tidak terbaca"),
            };
            Metric::new(tr!("fans.metric.fan", format!("Kipas {n}"), n = n), value)
        })
        .collect();

    CheckResult::new(CheckId::Fans, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fan(actual: Option<f64>, min: f64, max: f64) -> FanReading {
        FanReading {
            index: 0,
            actual_rpm: actual,
            min_rpm: Some(min),
            max_rpm: Some(max),
        }
    }

    const LIGHT: Option<f64> = Some(10.0);

    #[test]
    fn normal_fan_is_healthy() {
        let r = assess(&[fan(Some(1800.0), 1200.0, 7200.0)], Some(55.0), LIGHT);
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(r.metrics[0].value, "1800 RPM (min 1200 · maks 7200)");
    }

    #[test]
    fn below_minimum_boundaries() {
        // 0.8 × 1200 = 960
        assert_eq!(
            assess(&[fan(Some(960.0), 1200.0, 7200.0)], Some(55.0), LIGHT).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&[fan(Some(959.0), 1200.0, 7200.0)], Some(55.0), LIGHT).status,
            Status::Warning
        );
        assert_eq!(
            assess(&[fan(Some(0.0), 1200.0, 7200.0)], Some(55.0), LIGHT).status,
            Status::Critical
        );
    }

    #[test]
    fn apple_silicon_fan_may_stop_at_idle() {
        // Minimum 0 RPM: kipas diam saat dingin adalah normal.
        assert_eq!(
            assess(&[fan(Some(0.0), 0.0, 5000.0)], Some(45.0), LIGHT).status,
            Status::Healthy
        );
    }

    #[test]
    fn hot_cpu_with_stopped_fans_is_critical() {
        assert_eq!(
            assess(&[fan(Some(0.0), 0.0, 5000.0)], Some(85.0), LIGHT).status,
            Status::Critical
        );
    }

    #[test]
    fn near_max_at_light_load_boundaries() {
        // 0.9 × 7200 = 6480
        assert_eq!(
            assess(&[fan(Some(6479.0), 1200.0, 7200.0)], Some(55.0), LIGHT).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&[fan(Some(6480.0), 1200.0, 7200.0)], Some(55.0), LIGHT).status,
            Status::Warning
        );
        // Saat beban tinggi, kipas kencang itu wajar.
        assert_eq!(
            assess(&[fan(Some(6480.0), 1200.0, 7200.0)], Some(55.0), Some(90.0)).status,
            Status::Healthy
        );
    }

    #[test]
    fn unreadable_rpm_is_unknown() {
        assert_eq!(
            assess(&[fan(None, 1200.0, 7200.0)], Some(55.0), LIGHT).status,
            Status::Unknown
        );
    }

    #[test]
    fn fanless_and_unavailable() {
        let none = SensorReadings {
            temperatures: vec![],
            fans: Some(vec![]),
        };
        assert_eq!(
            evaluate(&Ok(none), None, None).status,
            Status::NotApplicable
        );
        let missing = SensorReadings {
            temperatures: vec![],
            fans: None,
        };
        assert_eq!(evaluate(&Ok(missing), None, None).status, Status::Unknown);
        assert_eq!(
            evaluate(&Err(ProbeError::new("x")), None, None).status,
            Status::Unknown
        );
    }
}
