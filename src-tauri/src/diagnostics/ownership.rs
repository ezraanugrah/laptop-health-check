//! Penilaian kepemilikan & manajemen perangkat (lintas OS).
//!
//! macOS: Activation Lock, DEP (ABM/ASM), MDM.
//! Windows: aktivasi Windows, Autopilot, MDM, keanggotaan Entra ID/domain.
//!
//! Hasil ini BUKAN jaminan bebas penguncian atau bukti kepemilikan.
//! Keterbatasan deteksi disediakan lapisan platform dan selalu ditampilkan.
//! Nama organisasi/tenant/domain tidak pernah dibaca maupun ditampilkan (D4).

use super::findings::Findings;
use super::raw::{DirectoryJoin, OwnershipFamily, OwnershipInfo};
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

pub fn evaluate(data: &Result<OwnershipInfo, ProbeError>) -> CheckResult {
    match data {
        Ok(info) => assess(info),
        Err(err) => CheckResult::from_probe_error(CheckId::Ownership, err),
    }
}

fn label(v: Option<bool>, yes: &str, no: &str) -> String {
    match v {
        Some(true) => yes.to_string(),
        Some(false) => no.to_string(),
        None => "Tidak diketahui".to_string(),
    }
}

fn assess_mdm(info: &OwnershipInfo, f: &mut Findings) {
    match info.mdm_enrolled {
        Some(true) => f.warning("Perangkat dikelola MDM (manajemen perangkat organisasi)."),
        Some(false) => f.ok("Tidak terdaftar di MDM."),
        None => f.info("Status pendaftaran MDM tidak dapat dibaca."),
    }
}

fn assess_apple(info: &OwnershipInfo, f: &mut Findings) -> (bool, Vec<Metric>) {
    match info.activation_lock_enabled {
        Some(true) => f.warning(
            "Activation Lock AKTIF. Jika Anda membeli laptop ini, minta pemilik sebelumnya mematikan Find My dan menghapusnya dari Apple ID. Jika ini laptop Anda sendiri, status ini normal.",
        ),
        Some(false) => f.ok("Activation Lock tidak aktif menurut macOS."),
        None => f.info(
            "macOS tidak melaporkan status Activation Lock (umumnya Mac tanpa chip T2/Apple Silicon).",
        ),
    }
    match info.provisioning_enrolled {
        Some(true) => f.warning(
            "Perangkat terdaftar di Apple Business/School Manager (DEP) — kemungkinan milik organisasi.",
        ),
        Some(false) => f.ok("Tidak terdaftar melalui DEP."),
        None => f.info("Status pendaftaran DEP tidak dapat dibaca."),
    }
    assess_mdm(info, f);

    let complete = info.activation_lock_enabled.is_some()
        && info.provisioning_enrolled.is_some()
        && info.mdm_enrolled.is_some();
    let metrics = vec![
        Metric::new(
            "Activation Lock",
            label(info.activation_lock_enabled, "Aktif", "Tidak aktif"),
        ),
        Metric::new(
            "Terdaftar DEP",
            label(info.provisioning_enrolled, "Ya", "Tidak"),
        ),
        Metric::new("Terdaftar MDM", label(info.mdm_enrolled, "Ya", "Tidak")),
    ];
    (complete, metrics)
}

fn assess_windows(info: &OwnershipInfo, f: &mut Findings) -> (bool, Vec<Metric>) {
    match info.os_activated {
        Some(true) => f.ok("Windows teraktivasi dan asli menurut lisensi lokal."),
        Some(false) => f.warning(
            "Windows tidak teraktivasi atau lisensinya tidak valid — periksa lisensi sebelum membeli.",
        ),
        None => f.info("Status aktivasi Windows tidak dapat dibaca."),
    }
    match info.provisioning_enrolled {
        Some(true) => f.warning(
            "Terdapat konfigurasi Windows Autopilot — kemungkinan milik organisasi dan dapat terdaftar ulang setelah reset.",
        ),
        Some(false) => f.ok("Tidak terdeteksi konfigurasi Windows Autopilot."),
        None => f.info("Status Windows Autopilot tidak dapat dibaca."),
    }
    assess_mdm(info, f);
    match info.directory_join {
        Some(DirectoryJoin::EntraId) => {
            f.warning("Perangkat tergabung ke Microsoft Entra ID (akun organisasi).")
        }
        Some(DirectoryJoin::Workplace) => {
            f.warning("Perangkat terdaftar ke akun kerja/sekolah (workplace join).")
        }
        Some(DirectoryJoin::Domain) => {
            f.warning("Perangkat tergabung ke domain Active Directory organisasi.")
        }
        Some(DirectoryJoin::None) => f.ok("Tidak tergabung ke direktori organisasi."),
        None => f.info("Status keanggotaan direktori tidak dapat dibaca."),
    }

    let complete = info.os_activated.is_some()
        && info.provisioning_enrolled.is_some()
        && info.mdm_enrolled.is_some()
        && info.directory_join.is_some();
    let directory = match info.directory_join {
        Some(DirectoryJoin::None) => "Tidak ada",
        Some(DirectoryJoin::EntraId) => "Microsoft Entra ID",
        Some(DirectoryJoin::Workplace) => "Akun kerja/sekolah",
        Some(DirectoryJoin::Domain) => "Domain",
        None => "Tidak diketahui",
    };
    let metrics = vec![
        Metric::new(
            "Aktivasi Windows",
            label(info.os_activated, "Teraktivasi", "Tidak teraktivasi"),
        ),
        Metric::new(
            "Windows Autopilot",
            label(info.provisioning_enrolled, "Terdeteksi", "Tidak terdeteksi"),
        ),
        Metric::new("Terdaftar MDM", label(info.mdm_enrolled, "Ya", "Tidak")),
        Metric::new("Keanggotaan direktori", directory),
    ];
    (complete, metrics)
}

pub fn assess(info: &OwnershipInfo) -> CheckResult {
    let mut f = Findings::default();
    let (complete, metrics) = match info.family {
        OwnershipFamily::Apple => assess_apple(info, &mut f),
        OwnershipFamily::Windows => assess_windows(info, &mut f),
    };

    let status = f.status(complete);
    let summary = match (status, info.family) {
        (Status::Healthy, OwnershipFamily::Apple) => {
            "Tidak terdeteksi Activation Lock atau MDM (lihat keterbatasan)."
        }
        (Status::Healthy, OwnershipFamily::Windows) => {
            "Windows teraktivasi dan tidak terdeteksi pengelolaan organisasi (lihat keterbatasan)."
        }
        (Status::Warning, _) => {
            "Terdeteksi penguncian, masalah aktivasi, atau pengelolaan organisasi — periksa sebelum membeli."
        }
        _ => "Status penguncian/pengelolaan tidak dapat dipastikan sepenuhnya.",
    };

    CheckResult::new(CheckId::Ownership, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn apple(al: Option<bool>, dep: Option<bool>, mdm: Option<bool>) -> OwnershipInfo {
        OwnershipInfo {
            family: OwnershipFamily::Apple,
            activation_lock_enabled: al,
            provisioning_enrolled: dep,
            mdm_enrolled: mdm,
            ..Default::default()
        }
    }

    /// Contoh data bergaya Windows (BUKAN data perangkat asli).
    fn windows(
        activated: Option<bool>,
        autopilot: Option<bool>,
        mdm: Option<bool>,
        dir: Option<DirectoryJoin>,
    ) -> OwnershipInfo {
        OwnershipInfo {
            family: OwnershipFamily::Windows,
            os_activated: activated,
            provisioning_enrolled: autopilot,
            mdm_enrolled: mdm,
            directory_join: dir,
            ..Default::default()
        }
    }

    #[test]
    fn apple_clean_device_is_healthy() {
        let r = assess(&apple(Some(false), Some(false), Some(false)));
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(r.metrics[0].label, "Activation Lock");
    }

    #[test]
    fn apple_any_lock_or_management_is_a_warning() {
        assert_eq!(
            assess(&apple(Some(true), Some(false), Some(false))).status,
            Status::Warning
        );
        assert_eq!(
            assess(&apple(Some(false), Some(true), Some(false))).status,
            Status::Warning
        );
        assert_eq!(
            assess(&apple(Some(false), Some(false), Some(true))).status,
            Status::Warning
        );
    }

    #[test]
    fn apple_partial_data_is_unknown() {
        assert_eq!(
            assess(&apple(None, Some(false), Some(false))).status,
            Status::Unknown
        );
        assert_eq!(
            assess(&apple(Some(false), None, None)).status,
            Status::Unknown
        );
    }

    #[test]
    fn windows_clean_device_is_healthy() {
        let r = assess(&windows(
            Some(true),
            Some(false),
            Some(false),
            Some(DirectoryJoin::None),
        ));
        assert_eq!(r.status, Status::Healthy);
        let labels: Vec<_> = r.metrics.iter().map(|m| m.label.as_str()).collect();
        assert_eq!(
            labels,
            [
                "Aktivasi Windows",
                "Windows Autopilot",
                "Terdaftar MDM",
                "Keanggotaan direktori"
            ]
        );
        assert!(r.metrics.iter().all(|m| m.label != "Activation Lock"));
    }

    #[test]
    fn windows_findings_are_warnings() {
        let clean = || {
            windows(
                Some(true),
                Some(false),
                Some(false),
                Some(DirectoryJoin::None),
            )
        };
        let mut not_activated = clean();
        not_activated.os_activated = Some(false);
        assert_eq!(assess(&not_activated).status, Status::Warning);

        let mut autopilot = clean();
        autopilot.provisioning_enrolled = Some(true);
        assert_eq!(assess(&autopilot).status, Status::Warning);

        for dir in [
            DirectoryJoin::EntraId,
            DirectoryJoin::Workplace,
            DirectoryJoin::Domain,
        ] {
            let mut joined = clean();
            joined.directory_join = Some(dir);
            assert_eq!(assess(&joined).status, Status::Warning, "{dir:?}");
        }
    }

    #[test]
    fn windows_partial_data_is_unknown() {
        assert_eq!(
            assess(&windows(
                Some(true),
                None,
                Some(false),
                Some(DirectoryJoin::None)
            ))
            .status,
            Status::Unknown
        );
    }

    #[test]
    fn no_organisation_name_is_ever_shown() {
        let r = assess(&windows(
            Some(true),
            Some(true),
            Some(true),
            Some(DirectoryJoin::EntraId),
        ));
        // Model tidak punya field nama organisasi; teks hanya menyebut jenisnya.
        assert!(r.metrics.iter().any(|m| m.value == "Microsoft Entra ID"));
    }

    #[test]
    fn error_is_unknown() {
        assert_eq!(evaluate(&Err(ProbeError::new("x"))).status, Status::Unknown);
    }
}
