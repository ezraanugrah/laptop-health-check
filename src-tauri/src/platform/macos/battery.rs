//! Baterai: `ioreg AppleSmartBattery` (kapasitas mAh, siklus, suhu) +
//! `system_profiler SPPowerDataType` (kondisi menurut macOS, persen muatan).

use serde_json::Value;

use super::bin::{IOREG, SYSTEM_PROFILER};
use super::command::{run, run_json};
use super::parse::{ioreg_bool, ioreg_u32, ioreg_u64, json_str, json_u64, non_empty, percent};
use crate::diagnostics::raw::{BatteryInfo, CapacityUnit};
use crate::platform::ProbeError;

pub fn probe() -> Result<Option<BatteryInfo>, ProbeError> {
    let ioreg = run(IOREG, &["-rn", "AppleSmartBattery"])?;
    let power = run_json(SYSTEM_PROFILER, &["SPPowerDataType", "-json"]).ok();
    Ok(parse(&ioreg, power.as_ref()))
}

/// `None` bila macOS tidak melaporkan baterai (mis. Mac desktop).
pub fn parse(ioreg: &str, power: Option<&Value>) -> Option<BatteryInfo> {
    if ioreg.trim().is_empty() || ioreg_bool(ioreg, "BatteryInstalled") == Some(false) {
        return None;
    }

    let entry = power
        .and_then(|p| p.get("SPPowerDataType")?.as_array())
        .and_then(|items| {
            items
                .iter()
                .find(|e| e.get("sppower_battery_health_info").is_some())
        });
    let health = entry.and_then(|e| e.get("sppower_battery_health_info"));
    let charge = entry.and_then(|e| e.get("sppower_battery_charge_info"));

    // Apple Silicon: MaxCapacity berupa persen (100), jadi pakai nilai mentah mAh.
    let full = ioreg_u32(ioreg, "AppleRawMaxCapacity")
        .or_else(|| ioreg_u32(ioreg, "MaxCapacity").filter(|&v| v > 100))
        .filter(|&v| v > 0);

    Some(BatteryInfo {
        design_capacity: ioreg_u32(ioreg, "DesignCapacity").filter(|&v| v > 0),
        full_charge_capacity: full,
        capacity_unit: Some(CapacityUnit::MilliampHours),
        cycle_count: ioreg_u32(ioreg, "CycleCount").or_else(|| {
            health
                .and_then(|h| json_u64(h, "sppower_battery_cycle_count"))
                .and_then(|v| u32::try_from(v).ok())
        }),
        design_cycle_count: ioreg_u32(ioreg, "DesignCycleCount9C").filter(|&v| v > 0),
        // Satuan ioreg: 1/100 °C.
        temperature_c: ioreg_u64(ioreg, "Temperature")
            .map(|v| v as f64 / 100.0)
            .filter(|t| *t > 0.0 && *t < 90.0),
        charge_percent: charge
            .and_then(|c| json_u64(c, "sppower_battery_state_of_charge"))
            .map(|v| v.min(100) as u8),
        is_charging: ioreg_bool(ioreg, "IsCharging"),
        external_power: ioreg_bool(ioreg, "ExternalConnected"),
        permanent_failure: ioreg_u64(ioreg, "PermanentFailureStatus").map(|v| v != 0),
        os_condition: health
            .and_then(|h| json_str(h, "sppower_battery_health"))
            .and_then(non_empty),
        os_max_capacity_percent: health
            .and_then(|h| json_str(h, "sppower_battery_health_maximum_capacity"))
            .and_then(percent),
        // Field khusus Windows (jumlah baterai, kimia, kapasitas relatif).
        ..Default::default()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_intel_fixture() {
        let power: Value = serde_json::from_str(fixture!("sp_power.json")).unwrap();
        let b = parse(fixture!("ioreg_battery.txt"), Some(&power)).expect("baterai ada");
        assert_eq!(b.design_capacity, Some(5088));
        assert_eq!(b.full_charge_capacity, Some(3938));
        assert_eq!(b.cycle_count, Some(925));
        assert_eq!(b.design_cycle_count, Some(1000));
        assert_eq!(b.temperature_c, Some(31.25));
        assert_eq!(b.charge_percent, Some(100));
        assert_eq!(b.is_charging, Some(false));
        assert_eq!(b.external_power, Some(true));
        assert_eq!(b.permanent_failure, Some(false));
        assert_eq!(b.os_condition.as_deref(), Some("Good"));
        assert_eq!(b.os_max_capacity_percent, None, "Intel tidak melaporkannya");
    }

    #[test]
    fn no_battery_means_none() {
        assert_eq!(parse("", None), None);
        assert_eq!(parse("  \"BatteryInstalled\" = No\n", None), None);
    }

    /// Format Apple Silicon (contoh format, BUKAN data perangkat asli):
    /// MaxCapacity berupa persen, kapasitas mAh ada di AppleRawMaxCapacity.
    #[test]
    fn apple_silicon_style_uses_raw_capacity() {
        let ioreg = "  \"MaxCapacity\" = 100\n  \"AppleRawMaxCapacity\" = 4200\n  \"DesignCapacity\" = 4382\n";
        let power = serde_json::json!({"SPPowerDataType": [{
            "sppower_battery_health_info": {
                "sppower_battery_health": "Normal",
                "sppower_battery_health_maximum_capacity": "96%"
            }
        }]});
        let b = parse(ioreg, Some(&power)).unwrap();
        assert_eq!(b.full_charge_capacity, Some(4200));
        assert_eq!(b.os_max_capacity_percent, Some(96));
        assert_eq!(b.os_condition.as_deref(), Some("Normal"));
    }

    #[test]
    fn percent_max_capacity_is_not_treated_as_mah() {
        let b = parse(
            "  \"MaxCapacity\" = 100\n  \"DesignCapacity\" = 4382\n",
            None,
        )
        .unwrap();
        assert_eq!(b.full_charge_capacity, None);
    }
}
