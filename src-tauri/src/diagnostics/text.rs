//! Pesan yang bisa diterjemahkan frontend (i18n).
//!
//! Backend tidak menerjemahkan. Setiap pesan membawa:
//! - `text`   : teks bahasa Indonesia (fallback, juga untuk log/JSON),
//! - `code`   : kunci terjemahan stabil (mis. `battery.reason.capacityLow`),
//! - `params` : nilai yang disisipkan ke template (`{pct}`), sudah diformat.
//!
//! Katalog id-ID/en-US ada di frontend (`src/i18n`). Nama hardware, nilai
//! mentah, dan perintah sumber data tidak diberi kode (tidak diterjemahkan).
//! Logika penilaian TIDAK bergantung pada teks/kode ini.

use std::collections::BTreeMap;
use std::fmt;
use std::ops::Deref;

use serde::Serialize;

pub type Params = BTreeMap<&'static str, String>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Text {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<&'static str>,
    #[serde(skip_serializing_if = "BTreeMap::is_empty")]
    pub params: Params,
}

impl Text {
    /// Teks tanpa kode (mis. nama hardware atau angka): tidak diterjemahkan.
    pub fn plain(text: impl Into<String>) -> Self {
        Self {
            text: text.into(),
            ..Self::default()
        }
    }

    pub fn coded<I>(code: &'static str, text: impl Into<String>, params: I) -> Self
    where
        I: IntoIterator<Item = (&'static str, String)>,
    {
        Self {
            text: text.into(),
            code: Some(code),
            params: params.into_iter().collect(),
        }
    }
}

impl Text {
    /// Label metrik untuk salah satu dari beberapa perangkat (mis. "disk0 ·
    /// Model"): grup disimpan di parameter `group`, frontend menampilkannya
    /// di depan label terjemahan.
    pub fn grouped(mut self, group: Option<&str>) -> Self {
        if let Some(g) = group {
            self.text = format!("{g} · {}", self.text);
            self.params.insert("group", g.to_string());
        }
        self
    }
}

impl From<String> for Text {
    fn from(text: String) -> Self {
        Self::plain(text)
    }
}

impl From<&str> for Text {
    fn from(text: &str) -> Self {
        Self::plain(text)
    }
}

impl Deref for Text {
    type Target = str;
    fn deref(&self) -> &str {
        &self.text
    }
}

impl PartialEq<&str> for Text {
    fn eq(&self, other: &&str) -> bool {
        self.text == *other
    }
}

impl PartialEq<str> for Text {
    fn eq(&self, other: &str) -> bool {
        self.text == other
    }
}

impl fmt::Display for Text {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.text)
    }
}

/// `tr!("kode", teks_indonesia, param = nilai, ...)` → [`Text`] berkode.
#[macro_export]
macro_rules! tr {
    ($code:literal, $text:expr $(,)?) => {
        $crate::diagnostics::text::Text::coded($code, $text, [])
    };
    ($code:literal, $text:expr, $($key:ident = $value:expr),+ $(,)?) => {
        $crate::diagnostics::text::Text::coded(
            $code,
            $text,
            [$((stringify!($key), ($value).to_string())),+],
        )
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coded_text_serializes_code_and_params() {
        let pct = "79.9";
        let t = tr!(
            "battery.reason.capacityWarning",
            format!("Kapasitas {pct}%"),
            pct = pct
        );
        let json = serde_json::to_value(&t).unwrap();
        assert_eq!(json["text"], "Kapasitas 79.9%");
        assert_eq!(json["code"], "battery.reason.capacityWarning");
        assert_eq!(json["params"]["pct"], "79.9");
    }

    #[test]
    fn plain_text_has_no_code_or_params() {
        let json = serde_json::to_value(Text::from("MacBookPro16,2")).unwrap();
        assert_eq!(json, serde_json::json!({ "text": "MacBookPro16,2" }));
    }

    #[test]
    fn text_behaves_like_str_for_existing_checks() {
        let t = tr!("x.y", "Tekanan memori normal.");
        assert!(t.contains("normal"));
        assert_eq!(t, "Tekanan memori normal.");
        assert_eq!(t.to_string(), "Tekanan memori normal.");
    }
}
