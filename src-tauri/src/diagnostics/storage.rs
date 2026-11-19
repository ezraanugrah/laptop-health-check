//! Penilaian kesehatan SSD/HDD internal.

use super::findings::Findings;
use super::format::{format_disk_bytes, format_percent, yes_no_id};
use super::raw::DiskInfo;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

/// Ruang kosong volume sistem di bawah nilai ini (%) = peringatan.
pub const FREE_SPACE_WARNING_BELOW: f64 = 10.0;

pub fn evaluate(data: &Result<Vec<DiskInfo>, ProbeError>) -> CheckResult {
    match data {
        Ok(disks) => assess(disks),
        Err(err) => CheckResult::from_probe_error(CheckId::Storage, err),
    }
}

enum Smart {
    Verified,
    Failing,
    Unavailable,
}

fn smart(status: Option<&str>) -> Smart {
    match status.map(str::to_lowercase).as_deref() {
        Some("verified") => Smart::Verified,
        Some(s) if s.contains("fail") => Smart::Failing,
        _ => Smart::Unavailable,
    }
}

pub fn assess(disks: &[DiskInfo]) -> CheckResult {
    // Disk eksternal (mis. flashdisk tempat aplikasi portable) tidak dinilai.
    let (internal, external): (Vec<&DiskInfo>, Vec<&DiskInfo>) =
        disks.iter().partition(|d| d.internal != Some(false));

    let mut f = Findings::default();
    let mut verified = 0;
    for d in &internal {
        let name = d.model.clone().unwrap_or_else(|| d.id.clone());
        match smart(d.smart_status.as_deref()) {
            Smart::Verified => {
                verified += 1;
                f.ok(format!("{name}: status SMART \"Verified\" menurut macOS."));
            }
            Smart::Failing => f.critical(format!(
                "{name}: status SMART \"{}\" — disk berisiko rusak, segera cadangkan data.",
                d.smart_status.as_deref().unwrap_or("Failing")
            )),
            Smart::Unavailable => f.info(format!(
                "{name}: status SMART tidak tersedia ({}).",
                d.smart_status.as_deref().unwrap_or("tidak dilaporkan")
            )),
        }
        if let Some(v) = d.system_volume {
            let free_pct = v.free_bytes as f64 * 100.0 / v.total_bytes as f64;
            let text = format!(
                "Ruang kosong volume sistem {} ({} dari {}).",
                format_percent(free_pct),
                format_disk_bytes(v.free_bytes),
                format_disk_bytes(v.total_bytes)
            );
            if free_pct < FREE_SPACE_WARNING_BELOW {
                f.warning(format!(
                    "{text} Di bawah {FREE_SPACE_WARNING_BELOW}% dapat mengganggu pembaruan macOS dan kinerja."
                ));
            } else {
                f.ok(text);
            }
        }
    }
    if internal.is_empty() {
        f.info("Tidak ada disk internal yang dilaporkan oleh OS.");
    }
    if !external.is_empty() {
        f.info(format!(
            "{} disk eksternal terdeteksi dan tidak dinilai.",
            external.len()
        ));
    }

    let status = f.status(verified > 0);
    let summary = match status {
        Status::Healthy => "Penyimpanan internal dalam kondisi baik.",
        Status::Warning => "Penyimpanan perlu perhatian.",
        Status::Critical => "Disk melaporkan masalah SMART.",
        _ => "Kondisi penyimpanan tidak dapat dipastikan.",
    };

    let mut metrics = Vec::new();
    let multiple = internal.len() > 1;
    for d in &internal {
        let prefix = if multiple {
            format!("{} · ", d.id)
        } else {
            String::new()
        };
        let mut push = |label: &str, value: String| {
            metrics.push(Metric::new(format!("{prefix}{label}"), value));
        };
        if let Some(m) = &d.model {
            push("Model", m.clone());
        }
        if let Some(ssd) = d.solid_state {
            push("Jenis", if ssd { "SSD" } else { "HDD" }.to_string());
        }
        if let Some(p) = &d.protocol {
            push("Antarmuka", p.clone());
        }
        if let Some(s) = d.size_bytes {
            push("Kapasitas", format_disk_bytes(s));
        }
        push(
            "Status SMART",
            d.smart_status
                .clone()
                .unwrap_or_else(|| "Tidak tersedia".into()),
        );
        if let Some(t) = d.trim {
            push("TRIM", yes_no_id(t).to_string());
        }
        if let Some(v) = d.system_volume {
            push(
                "Ruang kosong (sistem)",
                format!(
                    "{} dari {}",
                    format_disk_bytes(v.free_bytes),
                    format_disk_bytes(v.total_bytes)
                ),
            );
        }
    }

    CheckResult::new(CheckId::Storage, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
        .with_notes(vec![
            "Status SMART dari macOS hanya berupa ringkasan lulus/gagal. Persentase keausan SSD, total data tertulis (TBW), dan jam pemakaian tidak tersedia tanpa hak administrator.".into(),
        ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::raw::VolumeSpace;

    fn disk(smart: &str, free: u64, total: u64) -> DiskInfo {
        DiskInfo {
            id: "disk0".into(),
            model: Some("Test SSD".into()),
            internal: Some(true),
            smart_status: Some(smart.into()),
            system_volume: Some(VolumeSpace {
                free_bytes: free,
                total_bytes: total,
            }),
            ..Default::default()
        }
    }

    #[test]
    fn free_space_boundary() {
        assert_eq!(
            assess(&[disk("Verified", 100, 1000)]).status,
            Status::Healthy
        ); // 10%
        assert_eq!(
            assess(&[disk("Verified", 99, 1000)]).status,
            Status::Warning
        ); // 9.9%
    }

    #[test]
    fn real_intel_free_space_is_a_warning() {
        // Nilai asli fixture: 27.48 GB kosong dari 441 GB (6.2%).
        let r = assess(&[disk("Verified", 27_478_630_400, 441_000_632_320)]);
        assert_eq!(r.status, Status::Warning);
        assert!(r.reasons.iter().any(|x| x.text.contains("6%")));
    }

    #[test]
    fn smart_states() {
        assert_eq!(
            assess(&[disk("Failing", 500, 1000)]).status,
            Status::Critical
        );
        assert_eq!(
            assess(&[disk("Not Supported", 500, 1000)]).status,
            Status::Unknown
        );
        let mut no_smart = disk("x", 500, 1000);
        no_smart.smart_status = None;
        assert_eq!(assess(&[no_smart]).status, Status::Unknown);
    }

    #[test]
    fn external_disks_are_ignored() {
        let mut usb = disk("Not Supported", 1, 1000);
        usb.internal = Some(false);
        let r = assess(&[disk("Verified", 500, 1000), usb]);
        assert_eq!(r.status, Status::Healthy);
        assert!(r.reasons.iter().any(|x| x.text.contains("eksternal")));
    }

    #[test]
    fn nothing_internal_is_unknown() {
        assert_eq!(assess(&[]).status, Status::Unknown);
    }
}
