//! Menjalankan utilitas sistem dengan batas waktu, tanpa shell.

use std::io::{Read, Write};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::Value;

use super::bin::{PLUTIL, SYSCTL};
use crate::platform::ProbeError;

/// `system_profiler` bisa lambat; batas ini mencegah UI menunggu selamanya.
pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(20);

/// Menjalankan program dan mengembalikan stdout (UTF-8, lossy).
pub fn run(program: &str, args: &[&str]) -> Result<String, ProbeError> {
    run_with_input(program, args, None, DEFAULT_TIMEOUT)
}

/// Menjalankan program lalu mem-parse stdout sebagai JSON.
pub fn run_json(program: &str, args: &[&str]) -> Result<Value, ProbeError> {
    let text = run(program, args)?;
    serde_json::from_str(&text)
        .map_err(|e| ProbeError::new(format!("{program}: JSON tidak valid ({e})")))
}

/// Konversi plist (XML) ke JSON memakai `plutil` bawaan macOS.
pub fn plist_to_json(plist: &str) -> Result<Value, ProbeError> {
    let text = run_with_input(
        PLUTIL,
        &["-convert", "json", "-o", "-", "-"],
        Some(plist.as_bytes()),
        DEFAULT_TIMEOUT,
    )?;
    serde_json::from_str(&text).map_err(|e| ProbeError::new(format!("plutil: {e}")))
}

/// `sysctl -n <key>`: nilai yang sudah di-trim; kosong dianggap tidak tersedia.
pub fn sysctl(key: &str) -> Result<String, ProbeError> {
    let value = run(SYSCTL, &["-n", key])?.trim().to_string();
    if value.is_empty() {
        Err(ProbeError::new(format!("sysctl {key}: tidak tersedia")))
    } else {
        Ok(value)
    }
}

pub fn sysctl_u32(key: &str) -> Option<u32> {
    sysctl(key).ok()?.parse().ok()
}

pub fn run_with_input(
    program: &str,
    args: &[&str],
    input: Option<&[u8]>,
    timeout: Duration,
) -> Result<String, ProbeError> {
    let label = || format!("{program} {}", args.join(" "));

    let mut child = Command::new(program)
        .args(args)
        .stdin(if input.is_some() {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| ProbeError::new(format!("{}: {e}", label())))?;

    if let (Some(data), Some(mut stdin)) = (input, child.stdin.take()) {
        let data = data.to_vec();
        // Ditulis di thread terpisah agar tidak deadlock saat output besar.
        std::thread::spawn(move || {
            let _ = stdin.write_all(&data);
        });
    }

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| ProbeError::new(format!("{}: stdout tidak tersedia", label())))?;
    let reader = std::thread::spawn(move || {
        let mut buf = Vec::new();
        stdout.read_to_end(&mut buf).map(|_| buf)
    });

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(ProbeError::new(format!(
                    "{}: melebihi batas waktu {} detik",
                    label(),
                    timeout.as_secs()
                )));
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(20)),
            Err(e) => return Err(ProbeError::new(format!("{}: {e}", label()))),
        }
    };

    let bytes = reader
        .join()
        .map_err(|_| ProbeError::new(format!("{}: gagal membaca output", label())))?
        .map_err(|e| ProbeError::new(format!("{}: {e}", label())))?;

    if !status.success() {
        return Err(ProbeError::new(format!("{} gagal ({status})", label())));
    }
    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_program_is_an_error() {
        assert!(run("/usr/bin/tidak-ada-program-ini", &[]).is_err());
    }

    #[test]
    fn non_zero_exit_is_an_error() {
        assert!(run("/usr/bin/false", &[]).is_err());
    }

    #[test]
    fn timeout_kills_slow_process() {
        let started = Instant::now();
        let result = run_with_input("/bin/sleep", &["5"], None, Duration::from_millis(200));
        assert!(result.unwrap_err().to_string().contains("batas waktu"));
        assert!(started.elapsed() < Duration::from_secs(3));
    }

    #[test]
    fn plist_is_converted_with_plutil() {
        let plist = r#"<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>SMARTStatus</key><string>Verified</string><key>Size</key><integer>42</integer></dict></plist>"#;
        let json = plist_to_json(plist).unwrap();
        assert_eq!(json["SMARTStatus"], "Verified");
        assert_eq!(json["Size"], 42);
    }
}
