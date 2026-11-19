//! RAM: `sysctl` (total, swap, tekanan memori), `vm_stat` (pemakaian),
//! `system_profiler SPMemoryDataType` (modul & status).

use std::collections::HashMap;

use serde_json::Value;

use super::bin::{SYSTEM_PROFILER, VM_STAT};
use super::command::{run, run_json, sysctl};
use super::parse::{json_str, non_empty, yes_no};
use crate::diagnostics::raw::{MemoryInfo, MemoryModule, MemoryPressure};
use crate::platform::ProbeError;

pub fn probe() -> Result<MemoryInfo, ProbeError> {
    let total = sysctl("hw.memsize").ok().and_then(|s| s.parse().ok());
    let vm = run(VM_STAT, &[]).ok();
    if total.is_none() && vm.is_none() {
        return Err(ProbeError::new("hw.memsize dan vm_stat tidak dapat dibaca"));
    }
    let swap = sysctl("vm.swapusage").ok();
    let pressure = sysctl("kern.memorystatus_vm_pressure_level").ok();
    let profiler = run_json(SYSTEM_PROFILER, &["SPMemoryDataType", "-json"]).ok();
    Ok(assemble(
        total,
        vm.as_deref(),
        swap.as_deref(),
        pressure.as_deref(),
        profiler.as_ref(),
    ))
}

pub fn assemble(
    total: Option<u64>,
    vm_stat: Option<&str>,
    swapusage: Option<&str>,
    pressure: Option<&str>,
    profiler: Option<&Value>,
) -> MemoryInfo {
    let vm = vm_stat.and_then(parse_vm_stat);
    let pages = |name: &str| vm.as_ref().and_then(|v| v.bytes(name));
    let app = match (pages("Anonymous pages"), pages("Pages purgeable")) {
        (Some(anon), Some(purgeable)) => Some(anon.saturating_sub(purgeable)),
        (anon, _) => anon,
    };
    let (swap_total, swap_used) = swapusage.and_then(parse_swapusage).unzip();
    let (memory_type, modules, upgradeable) = profiler.map(parse_profiler).unwrap_or_default();

    MemoryInfo {
        total_bytes: total,
        app_bytes: app,
        wired_bytes: pages("Pages wired down"),
        compressed_bytes: pages("Pages occupied by compressor"),
        swap_used_bytes: swap_used,
        swap_total_bytes: swap_total,
        pressure: pressure.and_then(parse_pressure),
        memory_type,
        modules,
        upgradeable,
        // Beban/commit/log error memori: khusus Windows.
        ..Default::default()
    }
}

pub struct VmStat {
    page_size: u64,
    pages: HashMap<String, u64>,
}

impl VmStat {
    pub fn bytes(&self, name: &str) -> Option<u64> {
        self.pages
            .get(name)
            .map(|p| p.saturating_mul(self.page_size))
    }
}

pub fn parse_vm_stat(text: &str) -> Option<VmStat> {
    let page_size = text
        .split("page size of ")
        .nth(1)?
        .split_whitespace()
        .next()?
        .parse()
        .ok()?;
    let pages = text
        .lines()
        .skip(1)
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            let value = value.trim().trim_end_matches('.').parse().ok()?;
            Some((name.trim().trim_matches('"').to_string(), value))
        })
        .collect();
    Some(VmStat { page_size, pages })
}

/// "total = 2048.00M  used = 371.25M  free = ..." -> (total, used) dalam byte.
pub fn parse_swapusage(text: &str) -> Option<(u64, u64)> {
    let value_after = |key: &str| -> Option<u64> {
        let mut tokens = text.split_whitespace();
        tokens.find(|t| *t == key)?;
        tokens.next().filter(|t| *t == "=")?;
        parse_size(tokens.next()?)
    };
    Some((value_after("total")?, value_after("used")?))
}

fn parse_size(token: &str) -> Option<u64> {
    let (number, unit) = token.split_at(token.find(|c: char| c.is_ascii_alphabetic())?);
    let number: f64 = number.parse().ok()?;
    let factor = match unit {
        "K" => 1024.0,
        "M" => 1024.0 * 1024.0,
        "G" => 1024.0 * 1024.0 * 1024.0,
        _ => return None,
    };
    Some((number * factor).round() as u64)
}

/// `kern.memorystatus_vm_pressure_level`: 1 normal, 2 peringatan, 4 kritis.
pub fn parse_pressure(text: &str) -> Option<MemoryPressure> {
    match text.trim() {
        "1" => Some(MemoryPressure::Normal),
        "2" => Some(MemoryPressure::Warning),
        "4" => Some(MemoryPressure::Critical),
        _ => None,
    }
}

/// Intel: daftar modul di `_items`. Apple Silicon: hanya total & tipe.
pub fn parse_profiler(profiler: &Value) -> (Option<String>, Vec<MemoryModule>, Option<bool>) {
    let Some(entry) = profiler
        .get("SPMemoryDataType")
        .and_then(Value::as_array)
        .and_then(|a| a.first())
    else {
        return (None, Vec::new(), None);
    };
    let text = |v: &Value, key: &str| json_str(v, key).and_then(non_empty);

    let modules: Vec<MemoryModule> = entry
        .get("_items")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(|m| MemoryModule {
                    slot: text(m, "_name"),
                    size: text(m, "dimm_size"),
                    kind: text(m, "dimm_type"),
                    speed: text(m, "dimm_speed"),
                    status: text(m, "dimm_status"),
                })
                .collect()
        })
        .unwrap_or_default();

    let memory_type =
        text(entry, "dimm_type").or_else(|| modules.iter().find_map(|m| m.kind.clone()));
    let upgradeable = json_str(entry, "is_memory_upgradeable").and_then(yes_no);
    (memory_type, modules, upgradeable)
}

#[cfg(test)]
mod tests {
    use super::*;

    const GIB: u64 = 1024 * 1024 * 1024;

    fn real() -> MemoryInfo {
        let profiler: Value = serde_json::from_str(fixture!("sp_memory.json")).unwrap();
        assemble(
            Some(16 * GIB),
            Some(fixture!("vm_stat.txt")),
            Some("total = 2048.00M  used = 371.25M  free = 1676.75M  (encrypted)"),
            Some("1"),
            Some(&profiler),
        )
    }

    #[test]
    fn parses_real_intel_fixture() {
        let m = real();
        assert_eq!(m.total_bytes, Some(16 * GIB));
        assert_eq!(m.app_bytes, Some((1_483_369 - 60_632) * 4096));
        assert_eq!(m.wired_bytes, Some(844_275 * 4096));
        assert_eq!(m.compressed_bytes, Some(721_018 * 4096));
        assert_eq!(m.pressure, Some(MemoryPressure::Normal));
        assert_eq!(m.memory_type.as_deref(), Some("LPDDR4X"));
        assert_eq!(m.upgradeable, Some(false));
        assert_eq!(m.modules.len(), 2);
        assert!(m.modules.iter().all(|x| x.status.as_deref() == Some("ok")));
        assert_eq!(m.modules[0].size.as_deref(), Some("8 GB"));
    }

    #[test]
    fn swapusage_units() {
        let (total, used) =
            parse_swapusage("total = 2048.00M  used = 371.25M  free = 1676.75M").unwrap();
        assert_eq!(total, 2048 * 1024 * 1024);
        assert_eq!(used, (371.25 * 1024.0 * 1024.0) as u64);
        assert_eq!(
            parse_swapusage("total = 1.00G  used = 0.00M  free = 1.00G")
                .unwrap()
                .0,
            GIB
        );
        assert_eq!(parse_swapusage("rusak"), None);
    }

    #[test]
    fn pressure_levels() {
        assert_eq!(parse_pressure("1"), Some(MemoryPressure::Normal));
        assert_eq!(parse_pressure("2"), Some(MemoryPressure::Warning));
        assert_eq!(parse_pressure("4"), Some(MemoryPressure::Critical));
        assert_eq!(parse_pressure("9"), None);
    }

    /// Format Apple Silicon (contoh format, BUKAN data perangkat asli).
    #[test]
    fn apple_silicon_profiler_without_modules() {
        let v = serde_json::json!({"SPMemoryDataType": [{"SPMemoryDataType": "16 GB", "dimm_type": "LPDDR5"}]});
        let (kind, modules, upgradeable) = parse_profiler(&v);
        assert_eq!(kind.as_deref(), Some("LPDDR5"));
        assert!(modules.is_empty());
        assert_eq!(upgradeable, None);
    }

    #[test]
    fn page_size_16k() {
        let vm = parse_vm_stat(
            "Mach Virtual Memory Statistics: (page size of 16384 bytes)\nPages wired down: 10.\n",
        )
        .unwrap();
        assert_eq!(vm.bytes("Pages wired down"), Some(10 * 16384));
    }
}
