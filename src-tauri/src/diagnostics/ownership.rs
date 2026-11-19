//! Penilaian Activation Lock, DEP, & MDM (macOS).
//!
//! Hasil ini BUKAN jaminan bebas penguncian atau bukti kepemilikan.
//! Keterbatasan deteksi disediakan lapisan platform dan selalu ditampilkan.

use super::findings::Findings;
use super::format::yes_no_id;
use super::raw::OwnershipInfo;
use super::text::Text;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;
use crate::tr;

pub fn evaluate(data: &Result<OwnershipInfo, ProbeError>) -> CheckResult {
    match data {
        Ok(info) => assess(info),
        Err(err) => CheckResult::from_probe_error(CheckId::Ownership, err),
    }
}

pub fn assess(info: &OwnershipInfo) -> CheckResult {
    let mut f = Findings::default();

    match info.activation_lock_enabled {
        Some(true) => f.warning(tr!(
            "ownership.reason.activationLockOn",
            "Activation Lock AKTIF. Jika Anda membeli laptop ini, minta pemilik sebelumnya mematikan Find My dan menghapusnya dari Apple ID. Jika ini laptop Anda sendiri, status ini normal."
        )),
        Some(false) => f.ok(tr!(
            "ownership.reason.activationLockOff",
            "Activation Lock tidak aktif menurut macOS."
        )),
        None => f.info(tr!(
            "ownership.reason.activationLockUnknown",
            "macOS tidak melaporkan status Activation Lock (umumnya Mac tanpa chip T2/Apple Silicon)."
        )),
    }
    match info.provisioning_enrolled {
        Some(true) => f.warning(tr!(
            "ownership.reason.depEnrolled",
            "Perangkat terdaftar di Apple Business/School Manager (DEP) — kemungkinan milik organisasi."
        )),
        Some(false) => f.ok(tr!("ownership.reason.depNotEnrolled", "Tidak terdaftar melalui DEP.")),
        None => f.info(tr!(
            "ownership.reason.depUnknown",
            "Status pendaftaran DEP tidak dapat dibaca."
        )),
    }
    match info.mdm_enrolled {
        Some(true) => f.warning(tr!(
            "ownership.reason.mdmEnrolled",
            "Perangkat dikelola MDM (manajemen perangkat organisasi)."
        )),
        Some(false) => f.ok(tr!(
            "ownership.reason.mdmNotEnrolled",
            "Tidak terdaftar di MDM."
        )),
        None => f.info(tr!(
            "ownership.reason.mdmUnknown",
            "Status pendaftaran MDM tidak dapat dibaca."
        )),
    }

    let complete = info.activation_lock_enabled.is_some()
        && info.provisioning_enrolled.is_some()
        && info.mdm_enrolled.is_some();
    let status = f.status(complete);
    let summary = match status {
        Status::Healthy => tr!(
            "ownership.summary.healthy",
            "Tidak terdeteksi Activation Lock atau MDM (lihat keterbatasan)."
        ),
        Status::Warning => tr!(
            "ownership.summary.warning",
            "Terdeteksi penguncian atau pengelolaan perangkat — periksa sebelum membeli."
        ),
        _ => tr!(
            "ownership.summary.unknown",
            "Status penguncian/pengelolaan tidak dapat dipastikan sepenuhnya."
        ),
    };

    let label = |v: Option<bool>, yes: Text, no: Text| match v {
        Some(true) => yes,
        Some(false) => no,
        None => tr!("value.unknown", "Tidak diketahui"),
    };
    let metrics = vec![
        Metric::new(
            tr!("ownership.metric.activationLock", "Activation Lock"),
            label(
                info.activation_lock_enabled,
                tr!("value.on", "Aktif"),
                tr!("value.off", "Tidak aktif"),
            ),
        ),
        Metric::new(
            tr!("ownership.metric.dep", "Terdaftar DEP"),
            label(
                info.provisioning_enrolled,
                yes_no_id(true),
                yes_no_id(false),
            ),
        ),
        Metric::new(
            tr!("ownership.metric.mdm", "Terdaftar MDM"),
            label(info.mdm_enrolled, yes_no_id(true), yes_no_id(false)),
        ),
    ];

    CheckResult::new(CheckId::Ownership, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(al: Option<bool>, dep: Option<bool>, mdm: Option<bool>) -> OwnershipInfo {
        OwnershipInfo {
            activation_lock_enabled: al,
            provisioning_enrolled: dep,
            mdm_enrolled: mdm,
        }
    }

    #[test]
    fn clean_device_is_healthy() {
        let r = assess(&info(Some(false), Some(false), Some(false)));
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(r.metrics[0].label, "Activation Lock");
    }

    #[test]
    fn any_lock_or_management_is_a_warning() {
        assert_eq!(
            assess(&info(Some(true), Some(false), Some(false))).status,
            Status::Warning
        );
        assert_eq!(
            assess(&info(Some(false), Some(true), Some(false))).status,
            Status::Warning
        );
        assert_eq!(
            assess(&info(Some(false), Some(false), Some(true))).status,
            Status::Warning
        );
    }

    #[test]
    fn partial_data_is_unknown() {
        assert_eq!(
            assess(&info(None, Some(false), Some(false))).status,
            Status::Unknown
        );
        assert_eq!(
            assess(&info(Some(false), None, None)).status,
            Status::Unknown
        );
    }

    #[test]
    fn error_is_unknown() {
        assert_eq!(evaluate(&Err(ProbeError::new("x"))).status, Status::Unknown);
    }
}
