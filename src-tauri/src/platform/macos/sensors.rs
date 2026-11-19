//! Suhu & kipas dari SMC (read-only, lihat `smc.rs`).
//!
//! Nama sensor SMC tidak didokumentasikan Apple. Hanya sensor yang cocok
//! dengan pola yang dikenal DAN bernilai masuk akal yang dilaporkan; sisanya
//! diabaikan (tidak ditebak). Pola Apple Silicon belum diverifikasi di
//! perangkat asli.

use super::smc::{Smc, decode};
use crate::diagnostics::raw::{FanReading, SensorKind, SensorReadings, TemperatureReading};
use crate::platform::ProbeError;

/// Batas aman enumerasi kunci SMC.
const MAX_KEYS: u32 = 4096;
const MAX_FANS: u32 = 8;

pub fn probe() -> Result<SensorReadings, ProbeError> {
    let smc = Smc::open()?;
    let apple_silicon = cfg!(target_arch = "aarch64");

    let mut temperatures = Vec::new();
    for index in 0..smc.key_count()?.min(MAX_KEYS) {
        let Ok(key) = smc.key_at(index) else { continue };
        let Some(kind) = classify(&key, apple_silicon) else {
            continue;
        };
        let Some(celsius) = smc.read(&key).ok().as_ref().and_then(decode) else {
            continue;
        };
        if is_plausible_celsius(celsius) {
            temperatures.push(TemperatureReading { key, kind, celsius });
        }
    }

    Ok(SensorReadings {
        temperatures,
        fans: read_fans(&smc),
    })
}

/// `None` bila SMC tidak menyediakan kunci jumlah kipas (`FNum`).
fn read_fans(smc: &Smc) -> Option<Vec<FanReading>> {
    let count = smc.read("FNum").ok().as_ref().and_then(decode)? as u32;
    let rpm = |key: String| {
        smc.read(&key)
            .ok()
            .as_ref()
            .and_then(decode)
            .filter(|r| is_plausible_rpm(*r))
    };
    Some(
        (0..count.min(MAX_FANS))
            .map(|i| FanReading {
                index: i,
                actual_rpm: rpm(format!("F{i}Ac")),
                min_rpm: rpm(format!("F{i}Mn")),
                max_rpm: rpm(format!("F{i}Mx")),
            })
            .collect(),
    )
}

/// Klasifikasi kunci suhu SMC. `None` = tidak dikenal (diabaikan).
pub fn classify(key: &str, apple_silicon: bool) -> Option<SensorKind> {
    let b = key.as_bytes();
    if b.len() != 4 || b[0] != b'T' {
        return None;
    }
    let (c1, c2, c3) = (b[1], b[2], b[3]);
    let alnum = |c: u8| c.is_ascii_alphanumeric();

    if apple_silicon {
        // Apple Silicon (belum diverifikasi): Tp/Te = core CPU, Tg = GPU.
        return match c1 {
            b'p' | b'e' if alnum(c2) && alnum(c3) => Some(SensorKind::Cpu),
            b'g' if alnum(c2) && alnum(c3) => Some(SensorKind::Gpu),
            b'B' if c2.is_ascii_digit() && c3 == b'T' => Some(SensorKind::Battery),
            _ => None,
        };
    }

    // Intel: TC0P/TC0D/TC0E/TC0F/TC0H (CPU), TCnC (core), TCXC (PECI),
    // TG0P/TG0D/TG0H (GPU), TBnT (baterai).
    match (c1, c2, c3) {
        (b'C', b'0', b'P' | b'D' | b'E' | b'F' | b'H') => Some(SensorKind::Cpu),
        (b'C', d, b'C') if d.is_ascii_digit() => Some(SensorKind::Cpu),
        (b'C', b'X', b'C') => Some(SensorKind::Cpu),
        (b'G', b'0', b'P' | b'D' | b'H') => Some(SensorKind::Gpu),
        (b'B', d, b'T') if d.is_ascii_digit() => Some(SensorKind::Battery),
        _ => None,
    }
}

/// Menyaring nilai sensor yang tidak aktif/rusak (0, negatif, -127, dll.).
pub fn is_plausible_celsius(c: f64) -> bool {
    c.is_finite() && c > 5.0 && c < 125.0
}

pub fn is_plausible_rpm(r: f64) -> bool {
    r.is_finite() && (0.0..20_000.0).contains(&r)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_intel_keys() {
        assert_eq!(classify("TC0P", false), Some(SensorKind::Cpu));
        assert_eq!(classify("TC1C", false), Some(SensorKind::Cpu));
        assert_eq!(classify("TCXC", false), Some(SensorKind::Cpu));
        assert_eq!(classify("TG0D", false), Some(SensorKind::Gpu));
        assert_eq!(classify("TB1T", false), Some(SensorKind::Battery));
        // Bukan sensor CPU/GPU/baterai yang dikenal -> diabaikan.
        assert_eq!(classify("TCHP", false), None);
        assert_eq!(
            classify("Tp0P", false),
            None,
            "pola Apple Silicon tidak dipakai di Intel"
        );
        assert_eq!(classify("FNum", false), None);
        assert_eq!(classify("TC0", false), None);
    }

    #[test]
    fn classifies_apple_silicon_keys() {
        assert_eq!(classify("Tp01", true), Some(SensorKind::Cpu));
        assert_eq!(classify("Te05", true), Some(SensorKind::Cpu));
        assert_eq!(classify("Tg0f", true), Some(SensorKind::Gpu));
        assert_eq!(classify("TB0T", true), Some(SensorKind::Battery));
        assert_eq!(classify("TC0P", true), None);
    }

    #[test]
    fn plausibility_filters() {
        assert!(is_plausible_celsius(45.0));
        assert!(!is_plausible_celsius(0.0));
        assert!(!is_plausible_celsius(-127.0));
        assert!(!is_plausible_celsius(130.0));
        assert!(!is_plausible_celsius(f64::NAN));
        assert!(is_plausible_rpm(0.0));
        assert!(is_plausible_rpm(6200.0));
        assert!(!is_plausible_rpm(-1.0));
        assert!(!is_plausible_rpm(65535.0));
    }

    /// Uji perangkat asli (butuh SMC; dilewati di CI/VM). Jalankan:
    /// `cargo test -- --ignored smc --nocapture` (mencetak sensor yang terbaca).
    #[test]
    #[ignore = "butuh SMC perangkat asli"]
    fn smc_reads_real_sensors() {
        let readings = probe().expect("SMC harus bisa dibuka di Mac asli");
        for t in &readings.temperatures {
            eprintln!("suhu {} {:?} = {:.1} °C", t.key, t.kind, t.celsius);
        }
        eprintln!("kipas: {:?}", readings.fans);
        assert!(
            readings
                .temperatures
                .iter()
                .any(|t| t.kind == SensorKind::Cpu),
            "minimal satu sensor suhu CPU harus terbaca"
        );
        assert!(readings.fans.is_some(), "FNum harus terbaca");
    }
}
