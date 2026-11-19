//! Penilaian kesehatan baterai.

use super::findings::Findings;
use super::format::{format_celsius, format_percent};
use super::raw::BatteryInfo;
#[cfg(test)]
use super::raw::CapacityUnit;
use super::types::{CheckId, CheckResult, Metric, Reason, Status};
use crate::platform::ProbeError;

/// Kapasitas ≥ nilai ini (% dari desain) = sehat.
pub const CAPACITY_HEALTHY_MIN: f64 = 80.0;
/// Kapasitas < nilai ini (% dari desain) = kritis.
pub const CAPACITY_CRITICAL_BELOW: f64 = 60.0;
/// Peringatan bila siklus ≥ rasio ini terhadap batas siklus desain.
pub const CYCLE_WARNING_RATIO: f64 = 0.9;
/// Peringatan bila suhu baterai ≥ nilai ini (°C).
pub const TEMPERATURE_WARNING_C: f64 = 45.0;

pub fn evaluate(data: &Result<Option<BatteryInfo>, ProbeError>) -> CheckResult {
    match data {
        Err(err) => CheckResult::from_probe_error(CheckId::Battery, err),
        Ok(None) => CheckResult::new(
            CheckId::Battery,
            Status::NotApplicable,
            "Perangkat ini tidak memiliki baterai.",
        )
        .with_reasons(vec![Reason::info("OS tidak melaporkan baterai terpasang.")]),
        Ok(Some(info)) => assess(info),
    }
}

/// Kapasitas penuh saat ini sebagai % dari kapasitas desain.
/// `None` bila firmware hanya melaporkan kapasitas relatif (tidak bisa dibandingkan).
pub fn capacity_percent(info: &BatteryInfo) -> Option<f64> {
    if info.capacity_is_relative == Some(true) {
        return None;
    }
    match (info.full_charge_capacity, info.design_capacity) {
        // Dikali 100 dulu agar batas (mis. 600/1000 = 60%) tepat tanpa galat pembulatan.
        (Some(full), Some(design)) if design > 0 => {
            Some(f64::from(full) * 100.0 / f64::from(design))
        }
        _ => info.os_max_capacity_percent.map(f64::from),
    }
}

#[derive(Debug, PartialEq)]
enum OsCondition {
    Good,
    Fair,
    Service,
    Other,
}

fn classify_condition(text: &str) -> OsCondition {
    let l = text.to_lowercase();
    if ["service", "replace", "poor", "check"]
        .iter()
        .any(|w| l.contains(w))
    {
        OsCondition::Service
    } else if l.contains("fair") {
        OsCondition::Fair
    } else if l == "good" || l == "normal" {
        OsCondition::Good
    } else {
        OsCondition::Other
    }
}

pub fn assess(info: &BatteryInfo) -> CheckResult {
    let mut f = Findings::default();
    let capacity = capacity_percent(info);

    match capacity {
        Some(c) if c < CAPACITY_CRITICAL_BELOW => f.critical(format!(
            "Kapasitas tinggal {} dari desain (di bawah {CAPACITY_CRITICAL_BELOW}%).",
            format_percent(c)
        )),
        Some(c) if c < CAPACITY_HEALTHY_MIN => f.warning(format!(
            "Kapasitas tinggal {} dari desain (di bawah {CAPACITY_HEALTHY_MIN}%).",
            format_percent(c)
        )),
        Some(c) => f.ok(format!(
            "Kapasitas {} dari desain (minimal {CAPACITY_HEALTHY_MIN}%).",
            format_percent(c)
        )),
        None if info.capacity_is_relative == Some(true) => f.info(
            "Firmware baterai hanya melaporkan kapasitas relatif, sehingga kesehatan kapasitas tidak dapat dihitung.",
        ),
        None => f.info("Kapasitas desain/aktual tidak dilaporkan."),
    }

    if info.permanent_failure == Some(true) {
        f.critical("Baterai melaporkan kegagalan permanen (PermanentFailureStatus).");
    }

    let mut os_says_good = false;
    if let Some(cond) = &info.os_condition {
        let text = format!("macOS melaporkan kondisi baterai \"{cond}\".");
        match classify_condition(cond) {
            OsCondition::Service => f.critical(text),
            OsCondition::Fair => f.warning(text),
            OsCondition::Good => {
                os_says_good = true;
                f.ok(text);
            }
            OsCondition::Other => f.info(text),
        }
    }

    if let (Some(cycles), Some(design)) = (info.cycle_count, info.design_cycle_count) {
        if cycles >= design {
            f.warning(format!(
                "Siklus pengisian {cycles} sudah mencapai batas desain {design}."
            ));
        } else if f64::from(cycles) >= f64::from(design) * CYCLE_WARNING_RATIO {
            f.warning(format!(
                "Siklus pengisian {cycles} sudah ≥{}% dari batas desain {design}.",
                (CYCLE_WARNING_RATIO * 100.0) as u32
            ));
        } else {
            f.ok(format!(
                "Siklus pengisian {cycles} dari batas desain {design}."
            ));
        }
    }

    if let Some(t) = info.temperature_c.filter(|t| *t >= TEMPERATURE_WARNING_C) {
        f.warning(format!(
            "Suhu baterai {} (≥{TEMPERATURE_WARNING_C} °C).",
            format_celsius(t)
        ));
    }

    let status = f.status(capacity.is_some() || os_says_good);
    let summary = match status {
        Status::Healthy => "Baterai dalam kondisi baik.",
        Status::Warning => "Kondisi baterai menurun — perlu perhatian.",
        Status::Critical => "Baterai perlu diservis atau diganti.",
        _ => "Kondisi baterai tidak dapat dipastikan.",
    };

    CheckResult::new(CheckId::Battery, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics(info, capacity))
}

fn metrics(info: &BatteryInfo, capacity: Option<f64>) -> Vec<Metric> {
    let mut m = Vec::new();
    if let Some(n) = info.battery_count.filter(|&n| n > 1) {
        m.push(Metric::new("Jumlah baterai", n.to_string()));
    }
    if let Some(c) = capacity {
        let unit = info
            .capacity_unit
            .map(|u| format!(" {}", u.symbol()))
            .unwrap_or_default();
        let detail = match (info.full_charge_capacity, info.design_capacity) {
            (Some(full), Some(design)) => {
                format!("{} ({full} / {design}{unit})", format_percent(c))
            }
            _ => format!("{} (menurut OS)", format_percent(c)),
        };
        m.push(Metric::new("Kapasitas kesehatan", detail));
    }
    if let Some(chem) = &info.chemistry {
        m.push(Metric::new("Kimia baterai", chem.clone()));
    }
    match (info.cycle_count, info.design_cycle_count) {
        (Some(c), Some(d)) => m.push(Metric::new(
            "Siklus pengisian",
            format!("{c} dari {d} (batas desain)"),
        )),
        (Some(c), None) => m.push(Metric::new("Siklus pengisian", c.to_string())),
        _ => {}
    }
    if let Some(cond) = &info.os_condition {
        m.push(Metric::new("Kondisi menurut macOS", cond.clone()));
    }
    if let Some(t) = info.temperature_c {
        m.push(Metric::new("Suhu baterai", format_celsius(t)));
    }
    if let Some(p) = info.charge_percent {
        m.push(Metric::new("Muatan", format!("{p}%")));
    }
    let power = match (info.external_power, info.is_charging) {
        (Some(true), Some(true)) => Some("Adaptor terhubung · mengisi"),
        (Some(true), _) => Some("Adaptor terhubung · tidak mengisi"),
        (Some(false), _) => Some("Memakai baterai"),
        _ => None,
    };
    if let Some(p) = power {
        m.push(Metric::new("Daya", p));
    }
    m
}

#[cfg(test)]
mod tests {
    use super::*;

    fn battery(full: u32, design: u32) -> BatteryInfo {
        BatteryInfo {
            design_capacity: Some(design),
            full_charge_capacity: Some(full),
            ..Default::default()
        }
    }

    #[test]
    fn capacity_boundaries() {
        assert_eq!(assess(&battery(800, 1000)).status, Status::Healthy); // 80.0%
        assert_eq!(assess(&battery(799, 1000)).status, Status::Warning); // 79.9%
        assert_eq!(assess(&battery(600, 1000)).status, Status::Warning); // 60.0%
        assert_eq!(assess(&battery(599, 1000)).status, Status::Critical); // 59.9%
    }

    #[test]
    fn real_intel_values_are_a_warning_even_if_macos_says_good() {
        // Nilai asli fixture MacBookPro16,2: 3938/5088 mAh, 925/1000 siklus, "Good".
        let info = BatteryInfo {
            design_capacity: Some(5088),
            full_charge_capacity: Some(3938),
            capacity_unit: Some(CapacityUnit::MilliampHours),
            cycle_count: Some(925),
            design_cycle_count: Some(1000),
            temperature_c: Some(31.25),
            os_condition: Some("Good".into()),
            ..Default::default()
        };
        let r = assess(&info);
        assert_eq!(r.status, Status::Warning);
        let texts: Vec<_> = r.reasons.iter().map(|x| x.text.as_str()).collect();
        assert!(texts.iter().any(|t| t.contains("77%")));
        assert!(texts.iter().any(|t| t.contains("925")));
        assert!(texts.iter().any(|t| t.contains("\"Good\"")));
        assert_eq!(
            r.metrics[0].value, "77% (3938 / 5088 mAh)",
            "angka mentah ditampilkan"
        );
    }

    #[test]
    fn cycle_boundaries() {
        let with_cycles = |c| BatteryInfo {
            cycle_count: Some(c),
            design_cycle_count: Some(1000),
            ..battery(900, 1000)
        };
        assert_eq!(assess(&with_cycles(899)).status, Status::Healthy);
        assert_eq!(assess(&with_cycles(900)).status, Status::Warning);
        assert_eq!(assess(&with_cycles(1000)).status, Status::Warning);
    }

    #[test]
    fn temperature_boundary() {
        let hot = |t| BatteryInfo {
            temperature_c: Some(t),
            ..battery(900, 1000)
        };
        assert_eq!(assess(&hot(44.9)).status, Status::Healthy);
        assert_eq!(assess(&hot(45.0)).status, Status::Warning);
    }

    #[test]
    fn os_conditions() {
        let cond = |c: &str| BatteryInfo {
            os_condition: Some(c.into()),
            ..Default::default()
        };
        assert_eq!(
            assess(&cond("Service Recommended")).status,
            Status::Critical
        );
        assert_eq!(assess(&cond("Fair")).status, Status::Warning);
        assert_eq!(assess(&cond("Normal")).status, Status::Healthy);
        assert_eq!(assess(&cond("Misterius")).status, Status::Unknown);
    }

    #[test]
    fn permanent_failure_is_critical() {
        let info = BatteryInfo {
            permanent_failure: Some(true),
            ..battery(950, 1000)
        };
        assert_eq!(assess(&info).status, Status::Critical);
    }

    #[test]
    fn no_data_is_unknown_not_healthy() {
        assert_eq!(assess(&BatteryInfo::default()).status, Status::Unknown);
    }

    #[test]
    fn os_percent_used_when_mah_missing() {
        let info = BatteryInfo {
            os_max_capacity_percent: Some(85),
            ..Default::default()
        };
        let r = assess(&info);
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(r.metrics[0].value, "85% (menurut OS)");
    }

    #[test]
    fn no_battery_is_not_applicable() {
        assert_eq!(evaluate(&Ok(None)).status, Status::NotApplicable);
    }

    /// Contoh data bergaya Windows (BUKAN data perangkat asli).
    #[test]
    fn windows_style_mwh_and_multiple_batteries() {
        let info = BatteryInfo {
            design_capacity: Some(57_000),
            full_charge_capacity: Some(51_300),
            capacity_unit: Some(CapacityUnit::MilliwattHours),
            battery_count: Some(2),
            chemistry: Some("LiP".into()),
            ..Default::default()
        };
        let r = assess(&info);
        assert_eq!(r.status, Status::Healthy);
        let value = |label: &str| {
            r.metrics
                .iter()
                .find(|m| m.label == label)
                .map(|m| m.value.clone())
        };
        assert_eq!(
            value("Kapasitas kesehatan").as_deref(),
            Some("90% (51300 / 57000 mWh)")
        );
        assert_eq!(value("Jumlah baterai").as_deref(), Some("2"));
        assert_eq!(value("Kimia baterai").as_deref(), Some("LiP"));
    }

    #[test]
    fn relative_capacity_is_unknown_not_healthy() {
        let info = BatteryInfo {
            capacity_is_relative: Some(true),
            ..battery(100, 100)
        };
        let r = assess(&info);
        assert_eq!(r.status, Status::Unknown);
        assert!(
            r.reasons
                .iter()
                .any(|x| x.text.contains("kapasitas relatif"))
        );
    }

    #[test]
    fn missing_cycle_count_is_not_shown_as_zero() {
        let info = BatteryInfo {
            cycle_count: None,
            ..battery(900, 1000)
        };
        let r = assess(&info);
        assert!(r.metrics.iter().all(|m| m.label != "Siklus pengisian"));
    }
}
