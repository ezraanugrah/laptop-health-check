//! Helper parsing murni untuk output utilitas macOS (bisa dites dengan fixture).

use serde_json::Value;

/// Nilai mentah properti tingkat atas dari output `ioreg`, mis. `"CycleCount" = 925`.
/// Properti bersarang (di dalam `{...}`) sengaja tidak dicocokkan.
pub fn ioreg_raw<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    let needle = format!("\"{key}\" = ");
    text.lines().find_map(|line| {
        line.trim_start_matches([' ', '|', '\t'])
            .strip_prefix(needle.as_str())
            .map(str::trim)
    })
}

pub fn ioreg_u64(text: &str, key: &str) -> Option<u64> {
    ioreg_raw(text, key)?.parse().ok()
}

pub fn ioreg_u32(text: &str, key: &str) -> Option<u32> {
    ioreg_raw(text, key)?.parse().ok()
}

pub fn ioreg_bool(text: &str, key: &str) -> Option<bool> {
    match ioreg_raw(text, key)? {
        "Yes" => Some(true),
        "No" => Some(false),
        _ => None,
    }
}

pub fn ioreg_string(text: &str, key: &str) -> Option<String> {
    let raw = ioreg_raw(text, key)?;
    non_empty(raw.strip_prefix('"')?.strip_suffix('"')?)
}

pub fn json_str<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key)?.as_str()
}

pub fn json_u64(value: &Value, key: &str) -> Option<u64> {
    let v = value.get(key)?;
    v.as_u64().or_else(|| v.as_str()?.trim().parse().ok())
}

pub fn json_bool(value: &Value, key: &str) -> Option<bool> {
    value.get(key)?.as_bool()
}

/// "Yes"/"No" (juga "TRUE"/"FALSE") -> bool.
pub fn yes_no(text: &str) -> Option<bool> {
    match text.trim().to_ascii_lowercase().as_str() {
        "yes" | "true" => Some(true),
        "no" | "false" => Some(false),
        _ => None,
    }
}

/// "87%" -> 87.
pub fn percent(text: &str) -> Option<u8> {
    text.trim().strip_suffix('%')?.trim().parse().ok()
}

pub fn non_empty(text: &str) -> Option<String> {
    let t = text.trim();
    (!t.is_empty()).then(|| t.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    const IOREG: &str = r#"+-o AppleSmartBattery  <class AppleSmartBattery>
    {
      "CycleCount" = 925
      "BatteryData" = {"CycleCount"=1,"DesignCapacity"=1}
      "IsCharging" = No
      "Manufacturer" = "SWD"
      "Empty" = ""
    }"#;

    #[test]
    fn ioreg_reads_top_level_values_only() {
        assert_eq!(ioreg_u64(IOREG, "CycleCount"), Some(925));
        assert_eq!(
            ioreg_u64(IOREG, "DesignCapacity"),
            None,
            "nilai bersarang diabaikan"
        );
        assert_eq!(ioreg_bool(IOREG, "IsCharging"), Some(false));
        assert_eq!(ioreg_string(IOREG, "Manufacturer").as_deref(), Some("SWD"));
        assert_eq!(ioreg_string(IOREG, "Empty"), None);
        assert_eq!(ioreg_raw(IOREG, "TidakAda"), None);
    }

    #[test]
    fn small_parsers() {
        assert_eq!(yes_no("Yes"), Some(true));
        assert_eq!(yes_no("FALSE"), Some(false));
        assert_eq!(yes_no("Mungkin"), None);
        assert_eq!(percent("87%"), Some(87));
        assert_eq!(percent("87"), None);
        assert_eq!(non_empty("  "), None);
        let v: Value = serde_json::json!({"a": "12", "b": 7, "c": true});
        assert_eq!(json_u64(&v, "a"), Some(12));
        assert_eq!(json_u64(&v, "b"), Some(7));
        assert_eq!(json_bool(&v, "c"), Some(true));
    }
}
