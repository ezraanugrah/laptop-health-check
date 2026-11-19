//! Penilaian kesehatan SSD/HDD internal (lintas OS).
//!
//! Bukti yang dipakai: ringkasan SMART macOS, status kesehatan disk dari OS
//! (Windows), dan prediksi kegagalan SMART (Windows). Data eksperimental
//! (keausan, jam pakai, suhu) hanya ditampilkan berlabel dan TIDAK mengubah
//! status sampai terverifikasi di hardware asli (D5).

use super::findings::Findings;
use super::format::{format_celsius, format_disk_bytes, format_percent, yes_no_id};
use super::raw::{DiskHealth, DiskInfo};
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

/// Ruang kosong volume sistem di bawah nilai ini (%) = peringatan.
pub const FREE_SPACE_WARNING_BELOW: f64 = 10.0;
/// Batas informasi keausan SSD (eksperimental, tidak mengubah status).
pub const WEAR_NOTICE_PERCENT: u8 = 90;

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

fn health_label(h: DiskHealth) -> &'static str {
    match h {
        DiskHealth::Healthy => "Sehat (Healthy)",
        DiskHealth::Warning => "Peringatan (Warning)",
        DiskHealth::Unhealthy => "Tidak sehat (Unhealthy)",
    }
}

/// Menilai satu disk; mengembalikan `true` bila ada bukti positif kesehatan.
fn assess_disk(d: &DiskInfo, f: &mut Findings) -> bool {
    let name = d.model.clone().unwrap_or_else(|| d.id.clone());
    let mut evidence = false;

    match smart(d.smart_status.as_deref()) {
        Smart::Verified => {
            evidence = true;
            f.ok(format!("{name}: status SMART \"Verified\" menurut macOS."));
        }
        Smart::Failing => f.critical(format!(
            "{name}: status SMART \"{}\" — disk berisiko rusak, segera cadangkan data.",
            d.smart_status.as_deref().unwrap_or("Failing")
        )),
        Smart::Unavailable => {
            if let Some(s) = &d.smart_status {
                f.info(format!("{name}: status SMART tidak tersedia ({s})."));
            }
        }
    }

    match d.os_health {
        Some(DiskHealth::Healthy) => {
            evidence = true;
            f.ok(format!(
                "{name}: OS melaporkan status kesehatan disk Healthy."
            ));
        }
        Some(DiskHealth::Warning) => f.warning(format!(
            "{name}: OS melaporkan status kesehatan disk Warning."
        )),
        Some(DiskHealth::Unhealthy) => f.critical(format!(
            "{name}: OS melaporkan status kesehatan disk Unhealthy — segera cadangkan data."
        )),
        None => {}
    }

    match d.predicted_failure {
        Some(true) => f.critical(format!(
            "{name}: driver melaporkan prediksi kegagalan SMART (Pred Fail) — segera cadangkan data."
        )),
        Some(false) if d.os_health.is_none() => {
            evidence = true;
            f.ok(format!("{name}: tidak ada prediksi kegagalan SMART."));
        }
        _ => {}
    }

    if d.smart_status.is_none() && d.os_health.is_none() && d.predicted_failure.is_none() {
        f.info(format!(
            "{name}: tidak ada data kesehatan disk yang dilaporkan OS."
        ));
    }

    if let Some(w) = d.wear_percent {
        let note = if w >= WEAR_NOTICE_PERCENT {
            " Nilai ini tinggi, tetapi bersifat eksperimental"
        } else {
            " Data eksperimental"
        };
        f.info(format!(
            "{name}: perkiraan umur terpakai {w}%.{note}, belum terverifikasi dan tidak memengaruhi status."
        ));
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
                "{text} Di bawah {FREE_SPACE_WARNING_BELOW}% dapat mengganggu pembaruan sistem operasi dan kinerja."
            ));
        } else {
            f.ok(text);
        }
    }
    evidence
}

pub fn assess(disks: &[DiskInfo]) -> CheckResult {
    // Disk eksternal (mis. flashdisk tempat aplikasi portable) tidak dinilai.
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
        f.info("Tidak ada disk internal yang dilaporkan oleh OS.");
    }
    if !external.is_empty() {
        f.info(format!(
            "{} disk eksternal terdeteksi dan tidak dinilai.",
            external.len()
        ));
    }

    let status = f.status(healthy_evidence > 0);
    let summary = match status {
        Status::Healthy => "Penyimpanan internal dalam kondisi baik.",
        Status::Warning => "Penyimpanan perlu perhatian.",
        Status::Critical => "Disk melaporkan masalah kesehatan.",
        _ => "Kondisi penyimpanan tidak dapat dipastikan.",
    };

    CheckResult::new(CheckId::Storage, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics(&internal))
}

fn metrics(internal: &[&DiskInfo]) -> Vec<Metric> {
    let mut metrics = Vec::new();
    let multiple = internal.len() > 1;
    for d in internal {
        let prefix = if multiple {
            format!("{} · ", d.id)
        } else {
            String::new()
        };
        let label = |l: &str| format!("{prefix}{l}");
        if let Some(m) = &d.model {
            metrics.push(Metric::new(label("Model"), m.clone()));
        }
        if let Some(ssd) = d.solid_state {
            metrics.push(Metric::new(label("Jenis"), if ssd { "SSD" } else { "HDD" }));
        }
        if let Some(p) = &d.protocol {
            metrics.push(Metric::new(label("Antarmuka"), p.clone()));
        }
        if let Some(s) = d.size_bytes {
            metrics.push(Metric::new(label("Kapasitas"), format_disk_bytes(s)));
        }
        if let Some(s) = &d.smart_status {
            metrics.push(Metric::new(label("Status SMART"), s.clone()));
        }
        if let Some(h) = d.os_health {
            metrics.push(Metric::new(label("Kesehatan menurut OS"), health_label(h)));
        }
        if let Some(p) = d.predicted_failure {
            metrics.push(Metric::new(label("Prediksi kegagalan SMART"), yes_no_id(p)));
        }
        if d.smart_status.is_none() && d.os_health.is_none() && d.predicted_failure.is_none() {
            metrics.push(Metric::new(label("Status kesehatan"), "Tidak tersedia"));
        }
        if let Some(t) = d.trim {
            metrics.push(Metric::new(label("TRIM"), yes_no_id(t)));
        }
        if let Some(v) = d.system_volume {
            metrics.push(Metric::new(
                label("Ruang kosong (sistem)"),
                format!(
                    "{} dari {}",
                    format_disk_bytes(v.free_bytes),
                    format_disk_bytes(v.total_bytes)
                ),
            ));
        }
        if let Some(w) = d.wear_percent {
            metrics.push(Metric::experimental(
                label("Umur terpakai (perkiraan)"),
                format!("{w}%"),
            ));
        }
        if let Some(h) = d.power_on_hours {
            metrics.push(Metric::experimental(
                label("Jam pemakaian"),
                format!("{h} jam"),
            ));
        }
        if let Some(t) = d.temperature_c {
            metrics.push(Metric::experimental(label("Suhu disk"), format_celsius(t)));
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

    /// Disk bergaya Windows (contoh format, BUKAN data perangkat asli).
    fn win_disk(health: Option<DiskHealth>, pred_fail: Option<bool>) -> DiskInfo {
        DiskInfo {
            id: "PhysicalDrive0".into(),
            model: Some("Contoh NVMe".into()),
            internal: Some(true),
            os_health: health,
            predicted_failure: pred_fail,
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
    fn windows_os_health_states() {
        assert_eq!(
            assess(&[win_disk(Some(DiskHealth::Healthy), Some(false))]).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&[win_disk(Some(DiskHealth::Warning), None)]).status,
            Status::Warning
        );
        assert_eq!(
            assess(&[win_disk(Some(DiskHealth::Unhealthy), None)]).status,
            Status::Critical
        );
    }

    #[test]
    fn windows_predicted_failure() {
        assert_eq!(
            assess(&[win_disk(Some(DiskHealth::Healthy), Some(true))]).status,
            Status::Critical
        );
        // Tanpa HealthStatus, "OK" dari driver tetap bukti positif.
        assert_eq!(
            assess(&[win_disk(None, Some(false))]).status,
            Status::Healthy
        );
        assert_eq!(assess(&[win_disk(None, None)]).status, Status::Unknown);
    }

    #[test]
    fn experimental_wear_never_changes_status() {
        let mut d = win_disk(Some(DiskHealth::Healthy), Some(false));
        d.wear_percent = Some(97);
        d.power_on_hours = Some(1234);
        d.temperature_c = Some(41.0);
        let r = assess(&[d]);
        assert_eq!(
            r.status,
            Status::Healthy,
            "data eksperimental tidak mengubah status"
        );
        assert!(r.reasons.iter().any(|x| x.text.contains("eksperimental")));
        let experimental: Vec<_> = r.metrics.iter().filter(|m| m.experimental).collect();
        assert_eq!(experimental.len(), 3);
        assert!(
            r.metrics
                .iter()
                .filter(|m| !m.experimental)
                .all(|m| !m.label.contains("Umur"))
        );
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
