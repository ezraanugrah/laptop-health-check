//! Penilaian RAM: informasi modul & tekanan memori.

use super::findings::Findings;
use super::format::{format_binary_bytes, format_gib, yes_no_id};
use super::raw::{MemoryInfo, MemoryPressure};
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

pub fn evaluate(data: &Result<MemoryInfo, ProbeError>) -> CheckResult {
    match data {
        Ok(info) => assess(info),
        Err(err) => CheckResult::from_probe_error(CheckId::Memory, err),
    }
}

pub fn assess(info: &MemoryInfo) -> CheckResult {
    let mut f = Findings::default();

    let mut modules_ok = false;
    let reported: Vec<_> = info.modules.iter().filter(|m| m.status.is_some()).collect();
    if !reported.is_empty() {
        let mut all_ok = true;
        for m in &reported {
            let status = m.status.as_deref().unwrap_or_default();
            if !status.eq_ignore_ascii_case("ok") {
                all_ok = false;
                f.critical(format!(
                    "Modul {} melaporkan status \"{status}\".",
                    m.slot.as_deref().unwrap_or("RAM")
                ));
            }
        }
        if all_ok {
            modules_ok = true;
            f.ok(format!(
                "{} modul RAM berstatus \"ok\" menurut macOS.",
                reported.len()
            ));
        }
    }

    match info.pressure {
        Some(MemoryPressure::Normal) => f.ok("Tekanan memori normal."),
        Some(MemoryPressure::Warning) => f.warning(
            "Tekanan memori tinggi saat pemeriksaan (kondisi beban, bukan kerusakan fisik).",
        ),
        Some(MemoryPressure::Critical) => f.critical(
            "Tekanan memori kritis saat pemeriksaan (kondisi beban, bukan kerusakan fisik).",
        ),
        None => f.info("Tingkat tekanan memori tidak dilaporkan."),
    }

    let status = f.status(info.pressure.is_some() || modules_ok);
    let summary = match status {
        Status::Healthy => "RAM terdeteksi normal.",
        Status::Warning => "Pemakaian memori perlu perhatian.",
        Status::Critical => "RAM atau memori dalam kondisi kritis.",
        _ => "Kondisi RAM tidak dapat dipastikan.",
    };

    let mut metrics = Vec::new();
    if let Some(t) = info.total_bytes {
        metrics.push(Metric::new("Total", format_gib(t)));
    }
    if let Some(kind) = &info.memory_type {
        metrics.push(Metric::new("Tipe", kind.clone()));
    }
    if !info.modules.is_empty() {
        let first = &info.modules[0];
        let same = info
            .modules
            .iter()
            .all(|m| m.size == first.size && m.speed == first.speed);
        let desc = if same {
            format!(
                "{} × {}{}",
                info.modules.len(),
                first.size.as_deref().unwrap_or("?"),
                first
                    .speed
                    .as_deref()
                    .map(|s| format!(" · {s}"))
                    .unwrap_or_default()
            )
        } else {
            format!("{} modul", info.modules.len())
        };
        metrics.push(Metric::new("Modul", desc));
    }
    let used: Option<u64> = match (info.app_bytes, info.wired_bytes, info.compressed_bytes) {
        (Some(a), Some(w), Some(c)) => Some(a + w + c),
        _ => None,
    };
    if let Some(u) = used {
        metrics.push(Metric::new("Terpakai", format_binary_bytes(u)));
    }
    if let (Some(used), Some(total)) = (info.swap_used_bytes, info.swap_total_bytes) {
        metrics.push(Metric::new(
            "Swap",
            format!(
                "{} dari {}",
                format_binary_bytes(used),
                format_binary_bytes(total)
            ),
        ));
    }
    if let Some(p) = info.pressure {
        let label = match p {
            MemoryPressure::Normal => "Normal",
            MemoryPressure::Warning => "Tinggi",
            MemoryPressure::Critical => "Kritis",
        };
        metrics.push(Metric::new("Tekanan memori", label));
    }
    if let Some(u) = info.upgradeable {
        metrics.push(Metric::new("Dapat di-upgrade", yes_no_id(u)));
    }

    CheckResult::new(CheckId::Memory, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
        .with_notes(vec![
            "Kerusakan fisik sel RAM tidak dapat dideteksi dari dalam macOS. Gunakan Apple Diagnostics untuk menguji perangkat keras.".into(),
        ])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::raw::MemoryModule;

    fn module(status: &str) -> MemoryModule {
        MemoryModule {
            slot: Some("BANK 0".into()),
            status: Some(status.into()),
            ..Default::default()
        }
    }

    fn with(pressure: Option<MemoryPressure>, modules: Vec<MemoryModule>) -> MemoryInfo {
        MemoryInfo {
            pressure,
            modules,
            ..Default::default()
        }
    }

    #[test]
    fn pressure_levels() {
        assert_eq!(
            assess(&with(Some(MemoryPressure::Normal), vec![])).status,
            Status::Healthy
        );
        assert_eq!(
            assess(&with(Some(MemoryPressure::Warning), vec![])).status,
            Status::Warning
        );
        assert_eq!(
            assess(&with(Some(MemoryPressure::Critical), vec![])).status,
            Status::Critical
        );
    }

    #[test]
    fn module_status() {
        let ok = with(None, vec![module("ok"), module("ok")]);
        assert_eq!(assess(&ok).status, Status::Healthy);
        let bad = with(
            Some(MemoryPressure::Normal),
            vec![module("ok"), module("failed")],
        );
        assert_eq!(assess(&bad).status, Status::Critical);
    }

    #[test]
    fn no_evidence_is_unknown() {
        assert_eq!(assess(&MemoryInfo::default()).status, Status::Unknown);
    }

    #[test]
    fn module_summary_metric() {
        let mut info = with(Some(MemoryPressure::Normal), vec![]);
        info.modules = vec![
            MemoryModule {
                size: Some("8 GB".into()),
                speed: Some("3733 MHz".into()),
                status: Some("ok".into()),
                ..Default::default()
            };
            2
        ];
        let r = assess(&info);
        let m = r.metrics.iter().find(|m| m.label == "Modul").unwrap();
        assert_eq!(m.value, "2 × 8 GB · 3733 MHz");
    }
}
