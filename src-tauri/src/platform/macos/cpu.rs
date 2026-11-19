//! CPU: `sysctl` (model, core, frekuensi), beban via Mach `host_statistics`
//! (dua sampel berjarak 1 detik), status termal via `pmset -g therm`.

use std::time::Duration;

use super::bin::PMSET;
use super::command::{run, sysctl, sysctl_u32};
use crate::diagnostics::raw::{CpuInfo, ThermalStatus};
use crate::platform::ProbeError;

/// Lama jendela pengukuran beban CPU.
const LOAD_SAMPLE: Duration = Duration::from_secs(1);

pub fn probe() -> Result<CpuInfo, ProbeError> {
    let first = cpu_ticks();
    std::thread::sleep(LOAD_SAMPLE);
    let second = cpu_ticks();
    let load_percent = match (first, second) {
        (Some(a), Some(b)) => load_between(a, b),
        _ => None,
    };

    // Apple Silicon: perflevel0 = core performa, perflevel1 = core efisiensi.
    let (performance_cores, efficiency_cores) = if sysctl_u32("hw.nperflevels").unwrap_or(1) >= 2 {
        (
            sysctl_u32("hw.perflevel0.physicalcpu"),
            sysctl_u32("hw.perflevel1.physicalcpu"),
        )
    } else {
        (None, None)
    };

    Ok(CpuInfo {
        model: sysctl("machdep.cpu.brand_string").ok(),
        physical_cores: sysctl_u32("hw.physicalcpu"),
        logical_cores: sysctl_u32("hw.logicalcpu"),
        performance_cores,
        efficiency_cores,
        // Hanya tersedia di Intel.
        base_frequency_hz: sysctl("hw.cpufrequency").ok().and_then(|s| s.parse().ok()),
        load_percent,
        thermal: run(PMSET, &["-g", "therm"])
            .ok()
            .map(|t| parse_pmset_therm(&t)),
    })
}

/// Persentase waktu sibuk di antara dua sampel tick (user, system, idle, nice).
pub fn load_between(a: [u32; 4], b: [u32; 4]) -> Option<f64> {
    let delta: Vec<u64> = (0..4).map(|i| u64::from(b[i].wrapping_sub(a[i]))).collect();
    let total: u64 = delta.iter().sum();
    if total == 0 {
        return None;
    }
    let busy = delta[0] + delta[1] + delta[3];
    Some(busy as f64 / total as f64 * 100.0)
}

pub fn parse_pmset_therm(text: &str) -> ThermalStatus {
    let lower = text.to_lowercase();
    let recorded = |kind: &str| -> Option<bool> {
        if lower.contains(&format!("no {kind} warning level has been recorded")) {
            return Some(false);
        }
        lower
            .lines()
            .filter(|l| l.contains(&format!("{kind} warning level")))
            .filter_map(|l| l.rsplit(['=', ':']).next()?.trim().parse::<u32>().ok())
            .next_back()
            .map(|level| level > 0)
    };
    ThermalStatus {
        speed_limit_percent: pmset_value(text, "CPU_Speed_Limit"),
        scheduler_limit_percent: pmset_value(text, "CPU_Scheduler_Limit"),
        available_cpus: pmset_value(text, "CPU_Available_CPUs"),
        thermal_warning_recorded: recorded("thermal"),
        performance_warning_recorded: recorded("performance"),
        // Passive limit / performance limit / MHz limit: khusus Windows.
        ..Default::default()
    }
}

/// Nilai terakhir `KEY = N` (pmset bisa mencetak beberapa blok riwayat).
fn pmset_value(text: &str, key: &str) -> Option<u32> {
    text.lines()
        .filter_map(|line| {
            let (k, v) = line.split_once('=')?;
            if k.trim() == key {
                v.trim().parse().ok()
            } else {
                None
            }
        })
        .next_back()
}

/// Tick CPU kumulatif dari kernel (Mach). Read-only.
fn cpu_ticks() -> Option<[u32; 4]> {
    const HOST_CPU_LOAD_INFO: i32 = 3;
    const HOST_CPU_LOAD_INFO_COUNT: u32 = 4;

    unsafe extern "C" {
        static mach_task_self_: u32;
        fn mach_host_self() -> u32;
        fn host_statistics(host: u32, flavor: i32, info: *mut i32, count: *mut u32) -> i32;
        fn mach_port_deallocate(task: u32, name: u32) -> i32;
    }

    let mut ticks = [0u32; 4];
    let mut count = HOST_CPU_LOAD_INFO_COUNT;
    // SAFETY: `ticks` berukuran tepat HOST_CPU_LOAD_INFO_COUNT integer, sesuai
    // kontrak host_statistics; port host dilepas kembali setelah dipakai.
    let result = unsafe {
        let host = mach_host_self();
        let kr = host_statistics(
            host,
            HOST_CPU_LOAD_INFO,
            ticks.as_mut_ptr().cast::<i32>(),
            &mut count,
        );
        mach_port_deallocate(mach_task_self_, host);
        kr
    };
    (result == 0 && count == HOST_CPU_LOAD_INFO_COUNT).then_some(ticks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_intel_pmset_fixture() {
        let t = parse_pmset_therm(fixture!("pmset_therm.txt"));
        assert_eq!(t.speed_limit_percent, Some(100));
        assert_eq!(t.scheduler_limit_percent, Some(100));
        assert_eq!(t.available_cpus, Some(8));
        assert_eq!(t.thermal_warning_recorded, Some(false));
        assert_eq!(t.performance_warning_recorded, Some(false));
    }

    /// Contoh format saat pembatasan terjadi (BUKAN data perangkat asli).
    #[test]
    fn throttled_and_recorded_warning() {
        let text = "Thermal warning level = 2\nNote: No performance warning level has been recorded\nCPU Power notify\n\tCPU_Speed_Limit \t= 100\nCPU Power notify\n\tCPU_Speed_Limit \t= 62\n";
        let t = parse_pmset_therm(text);
        assert_eq!(t.speed_limit_percent, Some(62), "ambil blok terakhir");
        assert_eq!(t.thermal_warning_recorded, Some(true));
        assert_eq!(t.performance_warning_recorded, Some(false));
    }

    /// Apple Silicon umumnya tidak mencetak CPU_Speed_Limit.
    #[test]
    fn missing_limits_stay_none() {
        let t = parse_pmset_therm("Note: No thermal warning level has been recorded\n");
        assert_eq!(t.speed_limit_percent, None);
        assert_eq!(t.thermal_warning_recorded, Some(false));
        assert_eq!(t.performance_warning_recorded, None);
    }

    #[test]
    fn load_math() {
        assert_eq!(load_between([0, 0, 0, 0], [10, 10, 80, 0]), Some(20.0));
        assert_eq!(load_between([5, 5, 5, 5], [5, 5, 5, 5]), None);
        // Wrap-around counter tetap benar.
        assert_eq!(load_between([u32::MAX, 0, 0, 0], [9, 0, 10, 0]), Some(50.0));
    }

    #[test]
    fn reads_real_cpu_ticks() {
        let a = cpu_ticks().expect("host_statistics harus berhasil");
        assert!(a.iter().any(|&t| t > 0));
    }
}
