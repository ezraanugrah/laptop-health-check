//! Bukti hardware Touch Bar (bukan tabel nama model).
//!
//! - IORegistry: perangkat bernama "Touch Bar Display" / "Touch Bar Backlight"
//!   (Mac Intel dengan chip T1/T2; terlihat di bawah "Apple T2 Bus"). Dicek
//!   lewat pencocokan NAMA saja (`IOServiceNameMatching`); tidak ada properti
//!   yang dibaca, jadi nomor seri perangkat USB tidak pernah tersentuh.
//! - Proses sistem `TouchBarServer` (`pgrep -x`, hanya kode keluar yang dipakai).
//!
//! Jalur Apple Silicon belum diverifikasi di perangkat asli.

use std::ffi::{CStr, c_char, c_void};

use super::bin::PGREP;
use super::command::run_exit_code;
use crate::diagnostics::raw::TouchBarEvidence;
use crate::platform::ProbeError;

type KernReturn = i32;
type MachPort = u32;

/// `kIOMainPortDefault`.
const MAIN_PORT_DEFAULT: MachPort = 0;

#[link(name = "IOKit", kind = "framework")]
unsafe extern "C" {
    fn IOServiceNameMatching(name: *const c_char) -> *mut c_void;
    fn IOServiceGetMatchingService(main_port: MachPort, matching: *mut c_void) -> u32;
    fn IOObjectRelease(object: u32) -> KernReturn;
}

pub const DISPLAY_NAME: &CStr = c"Touch Bar Display";
pub const BACKLIGHT_NAME: &CStr = c"Touch Bar Backlight";

pub fn probe() -> Result<TouchBarEvidence, ProbeError> {
    let evidence = TouchBarEvidence {
        display_device: registry_has_name(DISPLAY_NAME),
        backlight_device: registry_has_name(BACKLIGHT_NAME),
        server_running: server_running().ok(),
    };
    if evidence.display_device.is_none()
        && evidence.backlight_device.is_none()
        && evidence.server_running.is_none()
    {
        return Err(ProbeError::new(
            "Touch Bar: IORegistry dan pgrep tidak dapat dibaca",
        ));
    }
    Ok(evidence)
}

/// Ada objek IORegistry dengan nama persis ini? `None` = tidak bisa diperiksa.
fn registry_has_name(name: &CStr) -> Option<bool> {
    // SAFETY: `name` adalah C string valid. `IOServiceGetMatchingService`
    // mengonsumsi satu referensi `matching`; objek yang ditemukan dilepas lagi.
    unsafe {
        let matching = IOServiceNameMatching(name.as_ptr());
        if matching.is_null() {
            return None;
        }
        let service = IOServiceGetMatchingService(MAIN_PORT_DEFAULT, matching);
        if service == 0 {
            return Some(false);
        }
        IOObjectRelease(service);
        Some(true)
    }
}

fn server_running() -> Result<bool, ProbeError> {
    let (code, _pids) = run_exit_code(PGREP, &["-x", "TouchBarServer"])?;
    pgrep_result(code)
}

/// Kode keluar `pgrep`: 0 = ada proses, 1 = tidak ada, lainnya = error.
pub fn pgrep_result(code: Option<i32>) -> Result<bool, ProbeError> {
    match code {
        Some(0) => Ok(true),
        Some(1) => Ok(false),
        other => Err(ProbeError::new(format!("pgrep: kode keluar {other:?}"))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pgrep_codes() {
        assert_eq!(pgrep_result(Some(0)), Ok(true));
        assert_eq!(pgrep_result(Some(1)), Ok(false));
        assert!(pgrep_result(Some(2)).is_err());
        assert!(pgrep_result(None).is_err());
    }

    #[test]
    fn unknown_registry_name_is_absent_not_error() {
        assert_eq!(
            registry_has_name(c"LHC Tidak Ada Perangkat Ini"),
            Some(false)
        );
    }

    /// Integrasi ringan: hasil boleh berbeda antar-Mac, tetapi probe tidak boleh gagal total.
    #[test]
    fn probe_runs_on_this_mac() {
        let e = probe().expect("minimal salah satu sumber terbaca");
        assert!(e.display_device.is_some() || e.server_running.is_some());
    }

    /// `cargo test real_touch_bar -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn real_touch_bar_probe() {
        println!("touch bar: {:?}", probe());
    }
}
