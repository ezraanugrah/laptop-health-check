//! Identitas sistem dan nomor seri (opt-in).

use super::bin::{IOREG, SW_VERS};
use super::command::{run, sysctl};
use super::parse::{ioreg_string, non_empty};
use crate::diagnostics::types::SystemOverview;
use crate::platform::ProbeError;

pub fn probe() -> Result<SystemOverview, ProbeError> {
    let sw = |flag: &str| run(SW_VERS, &[flag]).ok().and_then(|s| non_empty(&s));
    Ok(SystemOverview {
        os_name: sw("-productName").unwrap_or_else(|| "macOS".into()),
        os_version: sw("-productVersion"),
        os_build: sw("-buildVersion"),
        arch: std::env::consts::ARCH.to_string(),
        model: sysctl("hw.model").ok(),
        // Tersedia di Intel ("Intel(R) Core(TM) ...") dan Apple Silicon ("Apple M1").
        cpu: sysctl("machdep.cpu.brand_string").ok(),
        logical_cpus: std::thread::available_parallelism().ok().map(|n| n.get()),
        memory_bytes: sysctl("hw.memsize").ok().and_then(|s| s.parse().ok()),
    })
}

/// Nomor seri dibaca HANYA saat pengguna memilih "Tampilkan".
/// Nilainya tidak disimpan maupun dicatat di log.
pub fn serial_number() -> Result<Option<String>, ProbeError> {
    let text = run(IOREG, &["-rd1", "-c", "IOPlatformExpertDevice"])?;
    Ok(parse_serial(&text))
}

pub fn parse_serial(ioreg: &str) -> Option<String> {
    ioreg_string(ioreg, "IOPlatformSerialNumber")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform::Platform;
    use crate::platform::macos::MacOs;

    #[test]
    fn parses_serial_from_ioreg() {
        let text = "+-o J680AP  <class IOPlatformExpertDevice>\n    {\n      \"IOPlatformSerialNumber\" = \"TESTSERIAL01\"\n    }";
        assert_eq!(parse_serial(text).as_deref(), Some("TESTSERIAL01"));
        assert_eq!(parse_serial("{}"), None);
    }

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
    fn reads_real_serial_without_printing_it() {
        // Nilai tidak dicetak; hanya memastikan pembacaan berhasil & tidak kosong.
        let serial = MacOs::serial_number().expect("ioreg harus terbaca");
        if let Some(s) = serial {
            assert!(!s.is_empty());
        }
    }
}
