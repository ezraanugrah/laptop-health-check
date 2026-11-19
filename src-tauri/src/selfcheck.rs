//! Mode pemeriksaan izin media (alat verifikasi Fase 3.0).
//!
//! Aktif hanya bila aplikasi dijalankan dengan variabel lingkungan
//! `LHC_SELFCHECK` (dari Terminal; tidak pernah aktif saat dibuka dari Finder):
//!
//! - `media-passive`     : cek *secure context*, ketersediaan `mediaDevices`,
//!   status izin, dan jumlah perangkat (tanpa label). Tidak memanggil
//!   `getUserMedia` sama sekali.
//! - `media-deny`        : seperti di atas, ditambah API global yang dikunci dan
//!   `getUserMedia` asli saat gerbang **tertutup** — keduanya harus ditolak.
//!   PERHATIAN: WebKit menanyakan TCC macOS *sebelum* handler izin, jadi bila
//!   izin kamera/mikrofon aplikasi belum pernah diputuskan, dialog macOS tetap
//!   muncul (terbukti 19 Nov 2026). Hanya dijalankan pemilik, lewat `open`.
//! - `media-camera` / `media-microphone` : untuk dijalankan pemilik, satu per
//!   satu, setelah pemilik menekan tombol Mulai di jendela. Membuka gerbang
//!   hanya untuk jenis itu, mengaktifkan perangkat paling lama 10 dtk (bisa
//!   dihentikan lebih awal), lalu memastikan semua *track* berhenti dan
//!   permintaan ulang setelah gerbang ditutup ditolak.
//!
//! - `media-isolation`   : OTOMATIS, tanpa kamera/mikrofon. Memastikan jendela
//!   utama tidak bisa membuka gerbang, jendela media dibuat lalu dihancurkan,
//!   pembatalan dari jendela utama bekerja, dan data store tidak dibagi.
//! - `media-dryrun`      : latihan tombol "Hentikan sekarang" di jendela media
//!   tanpa meminta kamera/mikrofon (pemilik menekan tombol).
//!
//! Kamera/mikrofon hanya diminta dari jendela tes media terpisah
//! (`media_window.rs`), bukan dari jendela utama.
//!
//! Hasilnya dicetak satu baris `[selfcheck] {json}` ke stdout, lalu aplikasi
//! keluar. Laporan hanya berisi jumlah dan status, tanpa nama perangkat.

use serde::Serialize;

pub const ENV_VAR: &str = "LHC_SELFCHECK";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LaunchMode {
    Normal,
    MediaPassive,
    MediaDeny,
    MediaCamera,
    MediaMicrophone,
    MediaIsolation,
    MediaDryRun,
}

pub fn parse(value: Option<&str>) -> LaunchMode {
    match value.map(str::trim) {
        Some("media-passive") => LaunchMode::MediaPassive,
        Some("media-deny") => LaunchMode::MediaDeny,
        Some("media-camera") => LaunchMode::MediaCamera,
        Some("media-microphone") => LaunchMode::MediaMicrophone,
        Some("media-isolation") => LaunchMode::MediaIsolation,
        Some("media-dryrun") => LaunchMode::MediaDryRun,
        _ => LaunchMode::Normal,
    }
}

pub fn current() -> LaunchMode {
    parse(std::env::var(ENV_VAR).ok().as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_exact_values_enable_selfcheck() {
        assert_eq!(parse(None), LaunchMode::Normal);
        assert_eq!(parse(Some("")), LaunchMode::Normal);
        assert_eq!(parse(Some("1")), LaunchMode::Normal);
        assert_eq!(parse(Some("media")), LaunchMode::Normal);
        assert_eq!(parse(Some("media-passive")), LaunchMode::MediaPassive);
        assert_eq!(parse(Some(" media-deny ")), LaunchMode::MediaDeny);
        assert_eq!(parse(Some("media-camera")), LaunchMode::MediaCamera);
        assert_eq!(parse(Some("media-microphone")), LaunchMode::MediaMicrophone);
        assert_eq!(parse(Some("media-isolation")), LaunchMode::MediaIsolation);
        assert_eq!(parse(Some("media-dryrun")), LaunchMode::MediaDryRun);
        // Mode gabungan lama tidak lagi diterima: setiap tes dijalankan terpisah.
        assert_eq!(parse(Some("media-interactive")), LaunchMode::Normal);
    }

    #[test]
    fn serializes_camel_case() {
        assert_eq!(
            serde_json::to_string(&LaunchMode::MediaDeny).unwrap(),
            "\"mediaDeny\""
        );
        assert_eq!(
            serde_json::to_string(&LaunchMode::Normal).unwrap(),
            "\"normal\""
        );
    }
}
