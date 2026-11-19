//! Penilaian RAM: informasi modul & tekanan memori (lintas OS).
//!
//! macOS memakai tingkat tekanan memori dari OS; Windows memakai beban memori
//! fisik dan commit charge. Bukti dari log Windows (WHEA, Memory Diagnostic)
//! bersifat eksperimental dan tidak mengubah status (D5).

use super::findings::Findings;
use super::format::{format_binary_bytes, format_gib, yes_no_id};
use super::raw::{MemoryInfo, MemoryPressure};
use super::types::{CheckId, CheckResult, Metric, Status};
use crate::platform::ProbeError;

/// Beban memori/commit ≥ nilai ini (%) = peringatan (kondisi beban).
pub const LOAD_WARNING_PERCENT: f64 = 90.0;
/// Beban memori/commit ≥ nilai ini (%) = kritis (kondisi beban).
pub const LOAD_CRITICAL_PERCENT: f64 = 98.0;

fn assess_load(label: &str, percent: f64, f: &mut Findings) {
    let text = format!("{label} {percent:.0}% saat pemeriksaan");
    if percent >= LOAD_CRITICAL_PERCENT {
        f.critical(format!("{text} (kondisi beban, bukan kerusakan fisik)."));
    } else if percent >= LOAD_WARNING_PERCENT {
        f.warning(format!("{text} (kondisi beban, bukan kerusakan fisik)."));
    } else {
        f.ok(format!("{text}."));
    }
}

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
                "{} modul RAM berstatus \"ok\" menurut OS.",
                reported.len()
            ));
        }
    }

    let commit_percent = match (info.commit_used_bytes, info.commit_limit_bytes) {
        (Some(used), Some(limit)) if limit > 0 => Some(used as f64 * 100.0 / limit as f64),
        _ => None,
    };
    match info.pressure {
        Some(MemoryPressure::Normal) => f.ok("Tekanan memori normal."),
        Some(MemoryPressure::Warning) => f.warning(
            "Tekanan memori tinggi saat pemeriksaan (kondisi beban, bukan kerusakan fisik).",
        ),
        Some(MemoryPressure::Critical) => f.critical(
            "Tekanan memori kritis saat pemeriksaan (kondisi beban, bukan kerusakan fisik).",
        ),
        None => {
            if let Some(load) = info.memory_load_percent {
                assess_load("Beban memori fisik", f64::from(load), &mut f);
            }
            if let Some(c) = commit_percent {
                assess_load("Pemakaian commit memori", c, &mut f);
            }
            if info.memory_load_percent.is_none() && commit_percent.is_none() {
                f.info("Tingkat tekanan memori tidak dilaporkan.");
            }
        }
    }

    // Bukti eksperimental dari log Windows: hanya informasi (D5).
    if let Some(n) = info.hardware_error_events_30d {
        f.info(format!(
            "Log Windows mencatat {n} error memori terkoreksi (WHEA) dalam 30 hari terakhir. Data eksperimental, belum terverifikasi dan tidak memengaruhi status."
        ));
    }
    if let Some(d) = &info.memory_diagnostic_last {
        let result = if d.passed {
            "tidak menemukan kesalahan"
        } else {
            "MENEMUKAN kesalahan memori"
        };
        let date = d
            .date
            .as_deref()
            .map(|x| format!(" ({x})"))
            .unwrap_or_default();
        f.info(format!(
            "Windows Memory Diagnostic terakhir{date} {result}. Data eksperimental, belum terverifikasi dan tidak memengaruhi status."
        ));
    }

    let core_evidence = info.pressure.is_some()
        || info.memory_load_percent.is_some()
        || commit_percent.is_some()
        || modules_ok;
    let status = f.status(core_evidence);
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
    if let Some(load) = info.memory_load_percent {
        metrics.push(Metric::new("Beban memori", format!("{load}%")));
    }
    if let (Some(used), Some(limit)) = (info.commit_used_bytes, info.commit_limit_bytes) {
        metrics.push(Metric::new(
            "Commit",
            format!(
                "{} dari {}",
                format_binary_bytes(used),
                format_binary_bytes(limit)
            ),
        ));
    }
    if let Some(u) = info.upgradeable {
        metrics.push(Metric::new("Dapat di-upgrade", yes_no_id(u)));
    }
    if let Some(n) = info.hardware_error_events_30d {
        metrics.push(Metric::experimental(
            "Error memori (30 hari)",
            n.to_string(),
        ));
    }
    if let Some(d) = &info.memory_diagnostic_last {
        metrics.push(Metric::experimental(
            "Memory Diagnostic terakhir",
            if d.passed { "Lulus" } else { "Ada kesalahan" },
        ));
    }

    CheckResult::new(CheckId::Memory, status, summary)
        .with_reasons(f.into_reasons())
        .with_metrics(metrics)
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

    /// Data bergaya Windows (contoh format, BUKAN data perangkat asli).
    fn win(load: u8) -> MemoryInfo {
        MemoryInfo {
            memory_load_percent: Some(load),
            ..Default::default()
        }
    }

    #[test]
    fn windows_memory_load_boundaries() {
        assert_eq!(assess(&win(89)).status, Status::Healthy);
        assert_eq!(assess(&win(90)).status, Status::Warning);
        assert_eq!(assess(&win(97)).status, Status::Warning);
        assert_eq!(assess(&win(98)).status, Status::Critical);
    }

    #[test]
    fn windows_commit_boundaries() {
        let commit = |used: u64| MemoryInfo {
            commit_used_bytes: Some(used),
            commit_limit_bytes: Some(1000),
            ..win(50)
        };
        assert_eq!(assess(&commit(899)).status, Status::Healthy);
        assert_eq!(assess(&commit(900)).status, Status::Warning);
        assert_eq!(assess(&commit(980)).status, Status::Critical);
    }

    #[test]
    fn experimental_log_evidence_never_changes_status() {
        let info = MemoryInfo {
            hardware_error_events_30d: Some(3),
            memory_diagnostic_last: Some(crate::diagnostics::raw::MemoryDiagnosticResult {
                passed: false,
                date: Some("2026-11-01".into()),
            }),
            ..win(40)
        };
        let r = assess(&info);
        assert_eq!(
            r.status,
            Status::Healthy,
            "data eksperimental tidak mengubah status"
        );
        assert!(r.reasons.iter().any(|x| x.text.contains("WHEA")));
        assert!(r.reasons.iter().any(|x| x.text.contains("MENEMUKAN")));
        assert_eq!(r.metrics.iter().filter(|m| m.experimental).count(), 2);
    }
}
