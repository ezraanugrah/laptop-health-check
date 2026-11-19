//! Preferensi pengguna: tema dan bahasa.
//!
//! Disimpan LOKAL sebagai JSON kecil di folder konfigurasi aplikasi
//! (`~/Library/Application Support/com.ezraanugrah.laptophealthcheck/settings.json`).
//! Tidak pernah dikirim ke mana pun. Jendela utama memakai penyimpanan WebKit
//! sementara (incognito), jadi preferensi tidak bisa disimpan di localStorage.
//! Nilai yang rusak/tidak dikenal jatuh ke default per field.

use std::fs;
use std::io;
use std::path::Path;

use serde::{Deserialize, Serialize};

pub const FILE_NAME: &str = "settings.json";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    /// Default saat belum ada preferensi (keputusan pemilik).
    #[default]
    Dark,
    Light,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
pub enum Language {
    #[default]
    #[serde(rename = "id-ID")]
    Indonesian,
    #[serde(rename = "en-US")]
    English,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub theme: Theme,
    pub language: Language,
}

/// Membaca JSON preferensi. Field yang hilang/tidak valid memakai default,
/// field lain yang valid tetap dipakai.
pub fn parse(json: &str) -> Settings {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(json) else {
        return Settings::default();
    };
    let field = |name: &str| value.get(name).cloned().unwrap_or(serde_json::Value::Null);
    Settings {
        theme: serde_json::from_value(field("theme")).unwrap_or_default(),
        language: serde_json::from_value(field("language")).unwrap_or_default(),
    }
}

pub fn load(dir: &Path) -> Settings {
    fs::read_to_string(dir.join(FILE_NAME))
        .map(|s| parse(&s))
        .unwrap_or_default()
}

/// Menulis atomik: file sementara lalu `rename`, agar tidak pernah setengah tertulis.
pub fn save(dir: &Path, settings: &Settings) -> io::Result<()> {
    fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(settings).map_err(io::Error::other)?;
    let tmp = dir.join(format!("{FILE_NAME}.tmp"));
    fs::write(&tmp, json)?;
    fs::rename(&tmp, dir.join(FILE_NAME))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_are_dark_and_indonesian() {
        let d = Settings::default();
        assert_eq!(d.theme, Theme::Dark);
        assert_eq!(d.language, Language::Indonesian);
        assert_eq!(parse(""), d);
        assert_eq!(parse("bukan json"), d);
        assert_eq!(parse("{}"), d);
    }

    #[test]
    fn valid_values_are_read() {
        let s = parse(r#"{"theme":"light","language":"en-US"}"#);
        assert_eq!(s.theme, Theme::Light);
        assert_eq!(s.language, Language::English);
    }

    #[test]
    fn invalid_field_falls_back_without_losing_valid_field() {
        let s = parse(r#"{"theme":"ungu","language":"en-US","lain":1}"#);
        assert_eq!(s.theme, Theme::Dark);
        assert_eq!(s.language, Language::English);
    }

    #[test]
    fn serializes_frontend_shape() {
        let json = serde_json::to_value(Settings {
            theme: Theme::Light,
            language: Language::English,
        })
        .unwrap();
        assert_eq!(
            json,
            serde_json::json!({ "theme": "light", "language": "en-US" })
        );
    }

    #[test]
    fn save_then_load_roundtrip_in_temp_dir() {
        let dir = std::env::temp_dir().join(format!("lhc-settings-test-{}", std::process::id()));
        let wanted = Settings {
            theme: Theme::Light,
            language: Language::English,
        };
        save(&dir, &wanted).unwrap();
        assert_eq!(load(&dir), wanted);
        assert!(!dir.join(format!("{FILE_NAME}.tmp")).exists());
        fs::remove_dir_all(&dir).unwrap();
        assert_eq!(load(&dir), Settings::default(), "tanpa file = default");
    }
}
