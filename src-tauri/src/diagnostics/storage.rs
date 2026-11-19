//! Penilaian kesehatan SSD/HDD internal (macOS).
//!
//! Bukti yang dipakai: ringkasan SMART dari macOS dan ruang kosong volume
//! sistem. Disk eksternal (mis. flashdisk tempat aplikasi portable) tidak dinilai.

use super::findings::Findings;
use super::format::{format_disk_bytes, format_percent, yes_no_id};
use super::raw::DiskInfo;
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;
use crate::tr;

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

/// Menilai satu disk; `true` bila ada bukti positif kesehatan.
fn assess_disk(d: &DiskInfo, f: &mut Findings) -> bool {
    let name = d.model.clone().unwrap_or_else(|| d.id.clone());
    let mut evidence = false;

    match smart(d.smart_status.as_deref()) {
        Smart::Verified => {
            evidence = true;
            f.ok(tr!(
                "storage.reason.smartVerified",
                format!("{name}: status SMART \"Verified\" menurut macOS."),
                disk = name
            ));
        }
        Smart::Failing => {
            let smart = d.smart_status.as_deref().unwrap_or("Failing");
            f.critical(tr!(
                "storage.reason.smartFailing",
                format!(
                    "{name}: status SMART \"{smart}\" — disk berisiko rusak, segera cadangkan data."
                ),
                disk = name,
                smart = smart
            ))
        }
        Smart::Unavailable => match d.smart_status.as_deref() {
            Some(smart) => f.info(tr!(
                "storage.reason.smartUnavailable",
                format!("{name}: status SMART tidak tersedia ({smart})."),
                disk = name,
                smart = smart
            )),
            None => f.info(tr!(
                "storage.reason.smartNotReported",
                format!("{name}: status SMART tidak tersedia (tidak dilaporkan)."),
                disk = name
            )),
        },
    }

    if let Some(v) = d.system_volume {
        let free_pct = v.free_bytes as f64 * 100.0 / v.total_bytes as f64;
        let pct = format_percent(free_pct);
        let free = format_disk_bytes(v.free_bytes);
        let total = format_disk_bytes(v.total_bytes);
        let text = format!("Ruang kosong volume sistem {pct} ({free} dari {total}).");
        if free_pct < FREE_SPACE_WARNING_BELOW {
            f.warning(tr!(
                "storage.reason.freeSpaceLow",
                format!("{text} Di bawah {FREE_SPACE_WARNING_BELOW}% dapat mengganggu pembaruan macOS dan kinerja."),
                pct = pct,
                free = free,
                total = total,
                limit = FREE_SPACE_WARNING_BELOW
            ));
        } else {
            f.ok(tr!(
                "storage.reason.freeSpaceOk",
                text,
                pct = pct,
                free = free,
                total = total
            ));
        }
    }
    evidence
}

pub fn assess(disks: &[DiskInfo]) -> CheckResult {
    let (internal, external): (Vec<&DiskInfo>, Vec<&DiskInfo>) =
        disks.iter().partition(|d| d.internal != Some(false));

    let mut f = Findings::default();
    let mut healthy_evidence = 0;
    for d in &internal {
        if assess_disk(d, &mut f) {
            healthy_evidence += 1;
        }
    }
    if internal.is_empty() {
        f.info(tr!(
            "storage.reason.noInternal",
            "Tidak ada disk internal yang dilaporkan oleh macOS."
        ));
    }
    if !external.is_empty() {
        let n = external.len();
        f.info(tr!(
            "storage.reason.externalIgnored",
            format!("{n} disk eksternal terdeteksi dan tidak dinilai."),
            n = n
        ));
    }

    let status = f.status(healthy_evidence > 0);
    let summary = match status {
        Status::Healthy => tr!(
            "storage.summary.healthy",
            "Penyimpanan internal dalam kondisi baik."
        ),
        Status::Warning => tr!("storage.summary.warning", "Penyimpanan perlu perhatian."),
        Status::Critical => tr!("storage.summary.critical", "Disk melaporkan masalah SMART."),
        _ => tr!(
            "storage.summary.unknown",
            "Kondisi penyimpanan tidak dapat dipastikan."
        ),
    };

    CheckResult::new(CheckId::Storage, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics(&internal))
}

fn metrics(internal: &[&DiskInfo]) -> Vec<Metric> {
    let mut metrics = Vec::new();
    let multiple = internal.len() > 1;
    for d in internal {
        let group = multiple.then_some(d.id.as_str());
        if let Some(m) = &d.model {
            metrics.push(Metric::new(
                tr!("metric.model", "Model").grouped(group),
                m.clone(),
            ));
        }
        if let Some(ssd) = d.solid_state {
            metrics.push(Metric::new(
                tr!("storage.metric.type", "Jenis").grouped(group),
                if ssd { "SSD" } else { "HDD" },
            ));
        }
        if let Some(p) = &d.protocol {
            metrics.push(Metric::new(
                tr!("storage.metric.interface", "Antarmuka").grouped(group),
                p.clone(),
            ));
        }
        if let Some(s) = d.size_bytes {
            metrics.push(Metric::new(
                tr!("storage.metric.capacity", "Kapasitas").grouped(group),
                format_disk_bytes(s),
            ));
        }
        metrics.push(Metric::new(
            tr!("storage.metric.smart", "Status SMART").grouped(group),
            match &d.smart_status {
                Some(s) => s.clone().into(),
                None => tr!("value.unavailable", "Tidak tersedia"),
            },
        ));
        if let Some(t) = d.trim {
            metrics.push(Metric::new(
                tr!("storage.metric.trim", "TRIM").grouped(group),
                yes_no_id(t),
            ));
        }
        if let Some(v) = d.system_volume {
            let free = format_disk_bytes(v.free_bytes);
            let total = format_disk_bytes(v.total_bytes);
            metrics.push(Metric::new(
                tr!("storage.metric.freeSpace", "Ruang kosong (sistem)").grouped(group),
                tr!(
                    "value.freeOfTotal",
                    format!("{free} dari {total}"),
                    free = free,
                    total = total
                ),
            ));
        }
    }
    metrics
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

    #[test]
    fn metrics_are_never_experimental_yet() {
        let r = assess(&[disk("Verified", 500, 1000)]);
        assert!(r.metrics.iter().all(|m| !m.experimental));
    }
}
