//! Activation Lock & MDM: `system_profiler SPHardwareDataType` (hanya kunci
//! `activation_lock_status` yang diambil — nomor seri di output yang sama
//! langsung dibuang) dan `profiles status -type enrollment` (tanpa root).

use serde_json::Value;

use super::bin::{PROFILES, SYSTEM_PROFILER};
use super::command::{run, run_json};
use super::parse::json_str;
use crate::diagnostics::raw::OwnershipInfo;
use crate::platform::ProbeError;

pub fn probe() -> Result<OwnershipInfo, ProbeError> {
    let hardware = run_json(SYSTEM_PROFILER, &["SPHardwareDataType", "-json"]);
    let profiles = run(PROFILES, &["status", "-type", "enrollment"]);
    if let (Err(a), Err(b)) = (&hardware, &profiles) {
        return Err(ProbeError::new(format!("{a}; {b}")));
    }
    Ok(parse(hardware.ok().as_ref(), profiles.ok().as_deref()))
}

pub fn parse(hardware: Option<&Value>, profiles: Option<&str>) -> OwnershipInfo {
    let activation_lock_enabled = hardware
        .and_then(|h| h.get("SPHardwareDataType")?.as_array()?.first())
        .and_then(|h| json_str(h, "activation_lock_status"))
        .and_then(|s| {
            if s.ends_with("_enabled") {
                Some(true)
            } else if s.ends_with("_disabled") {
                Some(false)
            } else {
                None
            }
        });
    let (dep_enrolled, mdm_enrolled) = profiles.map(parse_enrollment).unwrap_or_default();
    OwnershipInfo {
        activation_lock_enabled,
        dep_enrolled,
        mdm_enrolled,
    }
}

/// "Enrolled via DEP: No" / "MDM enrollment: Yes (User Approved)".
pub fn parse_enrollment(text: &str) -> (Option<bool>, Option<bool>) {
    let value = |label: &str| -> Option<bool> {
        text.lines().find_map(|line| {
            let (k, v) = line.split_once(':')?;
            if !k.trim().eq_ignore_ascii_case(label) {
                return None;
            }
            let v = v.trim().to_ascii_lowercase();
            if v.starts_with("yes") {
                Some(true)
            } else if v.starts_with("no") {
                Some(false)
            } else {
                None
            }
        })
    };
    (value("Enrolled via DEP"), value("MDM enrollment"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_intel_fixture() {
        let hw: Value = serde_json::from_str(fixture!("sp_hardware.json")).unwrap();
        let o = parse(Some(&hw), Some(fixture!("profiles_enrollment.txt")));
        assert_eq!(o.activation_lock_enabled, Some(false));
        assert_eq!(o.dep_enrolled, Some(false));
        assert_eq!(o.mdm_enrolled, Some(false));
    }

    /// Contoh format perangkat terkelola (BUKAN data perangkat asli).
    #[test]
    fn managed_device() {
        let hw = serde_json::json!({"SPHardwareDataType": [{"activation_lock_status": "activation_lock_enabled"}]});
        let o = parse(
            Some(&hw),
            Some("Enrolled via DEP: Yes\nMDM enrollment: Yes (User Approved)\n"),
        );
        assert_eq!(o.activation_lock_enabled, Some(true));
        assert_eq!(o.dep_enrolled, Some(true));
        assert_eq!(o.mdm_enrolled, Some(true));
    }

    #[test]
    fn missing_data_stays_none() {
        let hw = serde_json::json!({"SPHardwareDataType": [{"machine_model": "X"}]});
        assert_eq!(parse(Some(&hw), None), OwnershipInfo::default());
        assert_eq!(parse(None, Some("teks lain")), OwnershipInfo::default());
    }
}
