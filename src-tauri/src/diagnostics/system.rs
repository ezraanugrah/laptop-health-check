//! Pemeriksaan identitas sistem + status dukungan keamanan OS (D3).
//!
//! Kategori `DeviceSecurity`: peringatan keamanan OS di sini TIDAK
//! memengaruhi kesimpulan kesehatan hardware.

use super::findings::Findings;
use super::format::format_gib;
use super::raw::{OsSupport, OsSupportState, SystemOverview};
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

pub fn evaluate(data: &Result<SystemOverview, ProbeError>) -> CheckResult {
    match data {
        Ok(overview) => assess(overview),
        Err(err) => CheckResult::from_probe_error(CheckId::System, err),
    }
}

fn date_suffix(prefix: &str, date: &Option<String>) -> String {
    date.as_deref()
        .map(|d| format!(" {prefix} {d}"))
        .unwrap_or_default()
}

fn assess_os_support(support: &OsSupport, f: &mut Findings) -> String {
    let date = &support.end_date;
    match support.state {
        OsSupportState::Supported => {
            f.ok(format!(
                "Keamanan OS: masih menerima pembaruan keamanan{}.",
                date_suffix("hingga", date)
            ));
            format!("Didukung{}", date_suffix("hingga", date))
        }
        OsSupportState::ExtendedSecurityUpdates => {
            f.ok(format!(
                "Keamanan OS: menerima pembaruan keamanan melalui ESU{}.",
                date_suffix("hingga", date)
            ));
            format!("ESU aktif{}", date_suffix("hingga", date))
        }
        OsSupportState::EndedEsuUnverified => {
            f.warning(format!(
                "Keamanan OS: masa dukungan berakhir{}; status ESU tidak dapat diverifikasi, sehingga pembaruan keamanan mungkin tidak lagi diterima.",
                date_suffix("pada", date)
            ));
            format!(
                "Berakhir{} (ESU tidak terverifikasi)",
                date_suffix("", date)
            )
        }
        OsSupportState::Ended => {
            f.warning(format!(
                "Keamanan OS: tidak lagi menerima pembaruan keamanan{}.",
                date_suffix("sejak", date)
            ));
            format!("Berakhir{}", date_suffix("", date))
        }
    }
}

pub fn assess(o: &SystemOverview) -> CheckResult {
    let unknown = || "Tidak diketahui".to_string();
    let mut f = Findings::default();

    let os = match o.os_display_version.as_ref().or(o.os_version.as_ref()) {
        Some(v) => format!("{} {v}", o.os_name),
        None => o.os_name.clone(),
    };
    let mut metrics = vec![Metric::new("Sistem operasi", os)];
    if let Some(edition) = &o.os_edition {
        metrics.push(Metric::new("Edisi", edition.clone()));
    }
    if let Some(build) = &o.os_build {
        metrics.push(Metric::new("Build OS", build.clone()));
    }
    metrics.push(Metric::new("Arsitektur", o.arch.clone()));
    if let Some(m) = &o.manufacturer {
        metrics.push(Metric::new("Pabrikan", m.clone()));
    }
    metrics.extend([
        Metric::new("Model", o.model.clone().unwrap_or_else(unknown)),
        Metric::new("Prosesor", o.cpu.clone().unwrap_or_else(unknown)),
        Metric::new(
            "Core logis",
            o.logical_cpus
                .map(|n| n.to_string())
                .unwrap_or_else(unknown),
        ),
        Metric::new(
            "Total RAM",
            o.memory_bytes.map(format_gib).unwrap_or_else(unknown),
        ),
    ]);
    let firmware = match (&o.firmware_type, &o.firmware_version) {
        (Some(t), Some(v)) => Some(format!("{t} · {v}")),
        (Some(x), None) | (None, Some(x)) => Some(x.clone()),
        (None, None) => None,
    };
    if let Some(fw) = firmware {
        metrics.push(Metric::new("Firmware", fw));
    }

    let complete = o.os_version.is_some() && o.cpu.is_some() && o.memory_bytes.is_some();
    if complete {
        f.ok("Versi OS, prosesor, dan RAM terbaca dari sistem.");
    } else {
        f.info("Sebagian informasi sistem tidak dilaporkan oleh OS.");
    }

    if let Some(support) = &o.os_support {
        let label = assess_os_support(support, &mut f);
        metrics.push(Metric::new("Dukungan keamanan OS", label));
        f.info(format!("Sumber informasi lifecycle: {}.", support.source));
    }

    let status = f.status(complete);
    let summary = match status {
        Status::Warning => "Sistem operasi mungkin tidak lagi menerima pembaruan keamanan.",
        _ if complete => "Informasi sistem terbaca lengkap.",
        _ => "Sebagian informasi sistem tidak terbaca.",
    };

    CheckResult::new(CheckId::System, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::types::ReasonLevel;

    fn full() -> SystemOverview {
        SystemOverview {
            os_name: "macOS".into(),
            os_version: Some("15.0".into()),
            os_build: Some("24A335".into()),
            arch: "x86_64".into(),
            model: Some("MacBookPro16,2".into()),
            cpu: Some("Intel(R) Core(TM) i5".into()),
            logical_cpus: Some(8),
            memory_bytes: Some(16 * 1024 * 1024 * 1024),
            ..Default::default()
        }
    }

    fn metric<'a>(r: &'a CheckResult, label: &str) -> &'a str {
        &r.metrics.iter().find(|m| m.label == label).unwrap().value
    }

    fn with_support(state: OsSupportState, date: &str) -> SystemOverview {
        SystemOverview {
            os_support: Some(OsSupport {
                state,
                end_date: Some(date.into()),
                source: "tabel uji".into(),
            }),
            ..full()
        }
    }

    #[test]
    fn complete_overview_is_healthy() {
        let r = assess(&full());
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(metric(&r, "Sistem operasi"), "macOS 15.0");
        assert_eq!(metric(&r, "Total RAM"), "16 GB");
        assert!(r.metrics.iter().all(|m| m.label != "Dukungan keamanan OS"));
    }

    #[test]
    fn partial_overview_is_unknown() {
        let mut o = full();
        o.memory_bytes = None;
        o.os_build = None;
        let r = assess(&o);
        assert_eq!(r.status, Status::Unknown);
        assert!(r.metrics.iter().all(|m| m.label != "Build OS"));
        assert_eq!(metric(&r, "Total RAM"), "Tidak diketahui");
    }

    /// Contoh data bergaya Windows (BUKAN data perangkat asli).
    #[test]
    fn windows_style_fields_are_shown() {
        let o = SystemOverview {
            os_name: "Windows 11".into(),
            os_display_version: Some("24H2".into()),
            os_edition: Some("Professional".into()),
            manufacturer: Some("Contoh OEM".into()),
            firmware_type: Some("UEFI".into()),
            firmware_version: Some("1.2.3".into()),
            ..full()
        };
        let r = assess(&o);
        assert_eq!(metric(&r, "Sistem operasi"), "Windows 11 24H2");
        assert_eq!(metric(&r, "Edisi"), "Professional");
        assert_eq!(metric(&r, "Pabrikan"), "Contoh OEM");
        assert_eq!(metric(&r, "Firmware"), "UEFI · 1.2.3");
    }

    #[test]
    fn os_support_states() {
        let r = assess(&with_support(OsSupportState::Supported, "2027-10-12"));
        assert_eq!(r.status, Status::Healthy);
        assert_eq!(
            metric(&r, "Dukungan keamanan OS"),
            "Didukung hingga 2027-10-12"
        );

        let r = assess(&with_support(
            OsSupportState::ExtendedSecurityUpdates,
            "2026-10-13",
        ));
        assert_eq!(r.status, Status::Healthy);
        assert!(metric(&r, "Dukungan keamanan OS").starts_with("ESU aktif"));

        let r = assess(&with_support(
            OsSupportState::EndedEsuUnverified,
            "2025-10-14",
        ));
        assert_eq!(r.status, Status::Warning);
        assert!(r.reasons[0].text.contains("ESU tidak dapat diverifikasi"));

        let r = assess(&with_support(OsSupportState::Ended, "2025-10-14"));
        assert_eq!(r.status, Status::Warning);
        assert_eq!(r.reasons[0].level, ReasonLevel::Warning);
        assert!(r.reasons[0].text.contains("sejak 2025-10-14"));
        assert!(r.reasons.iter().any(|x| x.text.contains("tabel uji")));
    }

    #[test]
    fn probe_error_is_unknown_with_reason() {
        let r = evaluate(&Err(ProbeError::new("akses ditolak")));
        assert_eq!(r.status, Status::Unknown);
        assert!(r.reasons[0].text.contains("akses ditolak"));
    }
}
