//! Penilaian Activation Lock & MDM.
//!
//! Hasil ini BUKAN jaminan bebas penguncian atau bukti kepemilikan; setiap
//! hasil selalu disertai keterbatasan deteksi.

use super::findings::Findings;
use super::raw::OwnershipInfo;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

pub fn limitations() -> Vec<String> {
    vec![
        "Status dibaca dari macOS di perangkat ini dan bisa berbeda dengan status di server Apple. Kepastian hanya didapat bila pemilik sebelumnya mematikan Find My dan menghapus perangkat dari Apple ID-nya.".into(),
        "Mac yang terdaftar di Apple Business/School Manager dapat terdaftar ulang ke MDM setelah macOS dihapus dan diinstal ulang, walaupun saat ini tidak terdeteksi.".into(),
        "Hasil ini bukan jaminan bebas penguncian dan bukan bukti kepemilikan.".into(),
    ]
}

pub fn evaluate(data: &Result<OwnershipInfo, ProbeError>) -> CheckResult {
    match data {
        Ok(info) => assess(info),
        Err(err) => {
            CheckResult::from_probe_error(CheckId::Ownership, err).with_notes(limitations())
        }
    }
}

pub fn assess(info: &OwnershipInfo) -> CheckResult {
    let mut f = Findings::default();

    match info.activation_lock_enabled {
        Some(true) => f.warning(
            "Activation Lock AKTIF. Jika Anda membeli laptop ini, minta pemilik sebelumnya mematikan Find My dan menghapusnya dari Apple ID. Jika ini laptop Anda sendiri, status ini normal.",
        ),
        Some(false) => f.ok("Activation Lock tidak aktif menurut macOS."),
        None => f.info(
            "macOS tidak melaporkan status Activation Lock (umumnya Mac tanpa chip T2/Apple Silicon).",
        ),
    }
    match info.dep_enrolled {
        Some(true) => f.warning(
            "Perangkat terdaftar di Apple Business/School Manager (DEP) — kemungkinan milik organisasi.",
        ),
        Some(false) => f.ok("Tidak terdaftar melalui DEP."),
        None => f.info("Status pendaftaran DEP tidak dapat dibaca."),
    }
    match info.mdm_enrolled {
        Some(true) => f.warning("Perangkat dikelola MDM (manajemen perangkat organisasi)."),
        Some(false) => f.ok("Tidak terdaftar di MDM."),
        None => f.info("Status pendaftaran MDM tidak dapat dibaca."),
    }

    let complete = info.activation_lock_enabled.is_some()
        && info.dep_enrolled.is_some()
        && info.mdm_enrolled.is_some();
    let status = f.status(complete);
    let summary = match status {
        Status::Healthy => "Tidak terdeteksi Activation Lock atau MDM (lihat keterbatasan).",
        Status::Warning => {
            "Terdeteksi penguncian atau pengelolaan perangkat — periksa sebelum membeli."
        }
        _ => "Status penguncian/pengelolaan tidak dapat dipastikan sepenuhnya.",
    };

    let label = |v: Option<bool>, yes: &str, no: &str| match v {
        Some(true) => yes.to_string(),
        Some(false) => no.to_string(),
        None => "Tidak diketahui".to_string(),
    };
    let metrics = vec![
        Metric::new(
            "Activation Lock",
            label(info.activation_lock_enabled, "Aktif", "Tidak aktif"),
        ),
        Metric::new("Terdaftar DEP", label(info.dep_enrolled, "Ya", "Tidak")),
        Metric::new("Terdaftar MDM", label(info.mdm_enrolled, "Ya", "Tidak")),
    ];

    CheckResult::new(CheckId::Ownership, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
        .with_notes(limitations())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn info(al: Option<bool>, dep: Option<bool>, mdm: Option<bool>) -> OwnershipInfo {
        OwnershipInfo {
            activation_lock_enabled: al,
            dep_enrolled: dep,
            mdm_enrolled: mdm,
        }
    }

    #[test]
    fn clean_device_is_healthy_but_always_has_limitations() {
        let r = assess(&info(Some(false), Some(false), Some(false)));
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(r.notes.len(), 3);
        assert!(r.notes.iter().any(|n| n.contains("bukan jaminan")));
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
    fn error_keeps_limitations() {
        let r = evaluate(&Err(ProbeError::new("x")));
        assert_eq!(r.status, Status::Unknown);
        assert_eq!(r.notes.len(), 3);
    }
}
