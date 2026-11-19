//! Profil perangkat untuk tes interaktif (Fase 3): model dan Touch Bar.
//!
//! Touch Bar hanya ada di sejumlah MacBook Pro tertentu dan produknya sudah
//! dihentikan, sehingga daftarnya tetap. Model yang tidak dikenal dikembalikan
//! sebagai `None` ("tidak diketahui") — pengguna yang memilih, bukan ditebak.

use serde::Serialize;

/// Model ber-Touch Bar (2016–2022).
const TOUCH_BAR_MODELS: &[&str] = &[
    "MacBookPro13,2",
    "MacBookPro13,3",
    "MacBookPro14,2",
    "MacBookPro14,3",
    "MacBookPro15,1",
    "MacBookPro15,2",
    "MacBookPro15,3",
    "MacBookPro15,4",
    "MacBookPro16,1",
    "MacBookPro16,2",
    "MacBookPro16,3",
    "MacBookPro16,4",
    "MacBookPro17,1",
    "Mac14,7",
];

/// MacBook Pro tanpa Touch Bar yang pasti: 13" dua port 2016/2017 dan 14"/16" 2021.
const NO_TOUCH_BAR_PRO: &[(u32, u32)] = &[(13, 1), (14, 1)];
const NO_TOUCH_BAR_PRO_MAJOR: u32 = 18;
/// MacBook Pro sebelum 2016 (seri ≤ 12) selalu memakai baris fungsi fisik.
const LAST_PRO_MAJOR_WITHOUT_TOUCH_BAR: u32 = 12;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DeviceProfile {
    /// Identifier model dari `sysctl hw.model`, mis. "MacBookPro16,2".
    pub model_identifier: Option<String>,
    /// `Some(true)` ada Touch Bar, `Some(false)` tidak ada, `None` tidak diketahui.
    pub touch_bar: Option<bool>,
}

pub fn profile(model_identifier: Option<String>) -> DeviceProfile {
    let touch_bar = model_identifier.as_deref().and_then(touch_bar_for_model);
    DeviceProfile {
        model_identifier,
        touch_bar,
    }
}

pub fn touch_bar_for_model(model: &str) -> Option<bool> {
    let model = model.trim();
    if TOUCH_BAR_MODELS.contains(&model) {
        return Some(true);
    }
    if model.starts_with("MacBookAir") {
        return Some(false);
    }
    if let Some(rest) = model.strip_prefix("MacBookPro") {
        let (major, minor) = parse_version(rest)?;
        if major <= LAST_PRO_MAJOR_WITHOUT_TOUCH_BAR
            || major == NO_TOUCH_BAR_PRO_MAJOR
            || NO_TOUCH_BAR_PRO.contains(&(major, minor))
        {
            return Some(false);
        }
        return None;
    }
    // MacBook 12" (MacBook8,1–10,1): baris fungsi fisik.
    if let Some(rest) = model.strip_prefix("MacBook")
        && parse_version(rest).is_some()
    {
        return Some(false);
    }
    None
}

fn parse_version(s: &str) -> Option<(u32, u32)> {
    let (major, minor) = s.split_once(',')?;
    Some((major.parse().ok()?, minor.parse().ok()?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_touch_bar_models() {
        for m in TOUCH_BAR_MODELS {
            assert_eq!(touch_bar_for_model(m), Some(true), "{m}");
        }
        // Mesin pengembangan.
        assert_eq!(touch_bar_for_model("MacBookPro16,2"), Some(true));
    }

    #[test]
    fn known_models_without_touch_bar() {
        for m in [
            "MacBookPro12,1",
            "MacBookPro11,5",
            "MacBookPro13,1",
            "MacBookPro14,1",
            "MacBookPro18,1",
            "MacBookPro18,4",
            "MacBookAir10,1",
            "MacBookAir8,2",
            "MacBook10,1",
        ] {
            assert_eq!(touch_bar_for_model(m), Some(false), "{m}");
        }
    }

    #[test]
    fn unknown_models_are_not_guessed() {
        for m in [
            "Mac14,2",
            "Mac15,6",
            "Mac16,1",
            "MacBookPro19,1",
            "iMac21,1",
            "",
            "x",
        ] {
            assert_eq!(touch_bar_for_model(m), None, "{m}");
        }
    }

    #[test]
    fn profile_without_model_is_unknown() {
        assert_eq!(profile(None).touch_bar, None);
        let p = profile(Some("MacBookPro16,2".into()));
        assert_eq!(p.touch_bar, Some(true));
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("modelIdentifier") && json.contains("touchBar"));
    }
}
