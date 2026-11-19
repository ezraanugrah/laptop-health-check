//! Format angka untuk tampilan (teks Indonesia, desimal titik).

const GIB: f64 = 1024.0 * 1024.0 * 1024.0;
const MIB: f64 = 1024.0 * 1024.0;

/// RAM: byte -> GB basis 1024, mis. `8589934592` -> `"8 GB"`.
pub fn format_gib(bytes: u64) -> String {
    let gib = bytes as f64 / GIB;
    if (gib - gib.round()).abs() < 0.05 {
        format!("{} GB", gib.round() as u64)
    } else {
        format!("{gib:.1} GB")
    }
}

/// Ukuran kecil/menengah basis 1024 (swap, memori terpakai).
pub fn format_binary_bytes(bytes: u64) -> String {
    let b = bytes as f64;
    if b >= GIB {
        format!("{:.1} GB", b / GIB)
    } else {
        format!("{} MB", (b / MIB).round() as u64)
    }
}

/// Disk: byte -> satuan desimal seperti Finder, mis. `500277792768` -> `"500 GB"`.
pub fn format_disk_bytes(bytes: u64) -> String {
    let gb = bytes as f64 / 1e9;
    if gb >= 1000.0 {
        format!("{:.1} TB", gb / 1000.0)
    } else if gb >= 100.0 {
        format!("{} GB", gb.round() as u64)
    } else if gb >= 1.0 {
        format!("{gb:.1} GB")
    } else {
        format!("{} MB", (bytes as f64 / 1e6).round() as u64)
    }
}

pub fn format_percent(value: f64) -> String {
    format!("{}%", value.round() as i64)
}

pub fn format_celsius(value: f64) -> String {
    format!("{value:.1} °C")
}

pub fn format_rpm(value: f64) -> String {
    format!("{} RPM", value.round() as u64)
}

pub fn format_ghz(hz: u64) -> String {
    format!("{:.1} GHz", hz as f64 / 1e9)
}

use super::text::Text;
use crate::tr;

pub fn yes_no_id(value: bool) -> Text {
    if value {
        tr!("value.yes", "Ya")
    } else {
        tr!("value.no", "Tidak")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn gib_rounds_sensibly() {
        assert_eq!(format_gib(8 * 1024 * 1024 * 1024), "8 GB");
        assert_eq!(format_gib(16 * 1024 * 1024 * 1024), "16 GB");
        assert_eq!(format_gib(1_610_612_736), "1.5 GB");
    }

    #[test]
    fn binary_bytes() {
        assert_eq!(format_binary_bytes(371 * 1024 * 1024), "371 MB");
        assert_eq!(format_binary_bytes(2 * 1024 * 1024 * 1024), "2.0 GB");
    }

    #[test]
    fn disk_bytes_use_decimal_units() {
        assert_eq!(format_disk_bytes(500_277_792_768), "500 GB");
        assert_eq!(format_disk_bytes(27_480_072_192), "27.5 GB");
        assert_eq!(format_disk_bytes(2_000_398_934_016), "2.0 TB");
        assert_eq!(format_disk_bytes(512_000_000), "512 MB");
    }

    #[test]
    fn small_formatters() {
        assert_eq!(format_percent(77.4), "77%");
        assert_eq!(format_percent(77.6), "78%");
        assert_eq!(format_celsius(31.26), "31.3 °C");
        assert_eq!(format_rpm(1799.6), "1800 RPM");
        assert_eq!(format_ghz(2_000_000_000), "2.0 GHz");
        assert_eq!(yes_no_id(true), "Ya");
    }
}
