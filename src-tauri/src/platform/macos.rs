//! Implementasi macOS (Intel & Apple Silicon).
//!
//! Fase 1 memakai utilitas bawaan macOS (`sw_vers`, `sysctl`) yang tersedia
//! di semua versi, tanpa dependency tambahan dan tanpa hak admin.
//! Rencana berikutnya: IOKit/`ioreg` untuk baterai & penyimpanan.

use std::process::Command;

use super::{Platform, ProbeError};
use crate::diagnostics::types::SystemOverview;

const SW_VERS: &str = "/usr/bin/sw_vers";
const SYSCTL: &str = "/usr/sbin/sysctl";

pub struct MacOs;

impl Platform for MacOs {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        Ok(SystemOverview {
            os_name: run(SW_VERS, &["-productName"]).unwrap_or_else(|_| "macOS".into()),
            os_version: run(SW_VERS, &["-productVersion"]).ok(),
            os_build: run(SW_VERS, &["-buildVersion"]).ok(),
            arch: std::env::consts::ARCH.to_string(),
            model: sysctl("hw.model").ok(),
            // Tersedia di Intel ("Intel(R) Core(TM) ...") dan Apple Silicon ("Apple M1").
            cpu: sysctl("machdep.cpu.brand_string").ok(),
            logical_cpus: std::thread::available_parallelism().ok().map(|n| n.get()),
            memory_bytes: sysctl("hw.memsize").ok().and_then(|s| s.parse().ok()),
        })
    }
}

fn sysctl(key: &str) -> Result<String, ProbeError> {
    run(SYSCTL, &["-n", key])
}

/// Menjalankan perintah sistem dan mengembalikan stdout yang sudah di-trim.
fn run(program: &str, args: &[&str]) -> Result<String, ProbeError> {
    let output = Command::new(program)
        .args(args)
        .output()
        .map_err(|e| ProbeError::new(format!("{program}: {e}")))?;

    if !output.status.success() {
        return Err(ProbeError::new(format!(
            "{program} {} gagal ({})",
            args.join(" "),
            output.status
        )));
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        Err(ProbeError::new(format!(
            "{program} {}: keluaran kosong",
            args.join(" ")
        )))
    } else {
        Ok(text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Uji integrasi ringan: membaca sistem macOS yang sedang berjalan.
    #[test]
    fn reads_real_system_overview() {
        let o = MacOs::system_overview().expect("probe macOS gagal");
        assert!(!o.os_name.is_empty());
        assert!(o.os_version.is_some(), "versi macOS harus terbaca");
        assert!(o.memory_bytes.unwrap_or(0) > 0, "hw.memsize harus terbaca");
        assert!(o.logical_cpus.unwrap_or(0) > 0);
    }

    #[test]
    fn missing_program_is_an_error() {
        assert!(run("/usr/bin/tidak-ada-program-ini", &[]).is_err());
    }
}
