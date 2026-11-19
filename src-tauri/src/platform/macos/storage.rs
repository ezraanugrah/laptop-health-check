//! SSD/HDD: `diskutil` (SMART, jenis, kapasitas, ruang kosong) +
//! `system_profiler SPNVMeDataType/SPSerialATADataType` (TRIM, model).
//! Plist `diskutil` dikonversi ke JSON dengan `plutil` bawaan macOS.

use serde_json::Value;

use super::bin::{DISKUTIL, SYSTEM_PROFILER};
use super::command::{plist_to_json, run, run_json};
use super::parse::{json_bool, json_str, json_u64, non_empty, yes_no};
use crate::diagnostics::raw::{DiskInfo, VolumeSpace};
use crate::platform::ProbeError;

pub fn probe() -> Result<Vec<DiskInfo>, ProbeError> {
    let list = plist_to_json(&run(DISKUTIL, &["list", "-plist", "physical"])?)?;
    let root = run(DISKUTIL, &["info", "-plist", "/"])
        .and_then(|t| plist_to_json(&t))
        .ok();
    let profiler = run_json(
        SYSTEM_PROFILER,
        &["SPNVMeDataType", "SPSerialATADataType", "-json"],
    )
    .ok();

    let mut disks = Vec::new();
    for id in whole_disks(&list) {
        let info = plist_to_json(&run(DISKUTIL, &["info", "-plist", &id])?)?;
        disks.push(parse_disk(&id, &info, profiler.as_ref(), root.as_ref()));
    }
    Ok(disks)
}

pub fn whole_disks(list: &Value) -> Vec<String> {
    list.get("WholeDisks")
        .and_then(Value::as_array)
        .map(|ids| {
            ids.iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default()
}

pub fn parse_disk(
    id: &str,
    info: &Value,
    profiler: Option<&Value>,
    root: Option<&Value>,
) -> DiskInfo {
    let item = profiler.and_then(|p| profiler_item(p, id));
    let from_item = |key: &str| item.and_then(|i| json_str(i, key)).and_then(non_empty);

    DiskInfo {
        id: id.to_string(),
        model: json_str(info, "MediaName")
            .and_then(non_empty)
            .or_else(|| from_item("device_model")),
        size_bytes: json_u64(info, "TotalSize")
            .or_else(|| json_u64(info, "Size"))
            .filter(|&s| s > 0),
        solid_state: json_bool(info, "SolidState"),
        protocol: json_str(info, "BusProtocol").and_then(non_empty),
        internal: json_bool(info, "Internal"),
        smart_status: json_str(info, "SMARTStatus")
            .and_then(non_empty)
            .or_else(|| from_item("smart_status")),
        trim: from_item("spnvme_trim_support")
            .or_else(|| from_item("spsata_trim_support"))
            .and_then(|s| yes_no(&s)),
        system_volume: root.and_then(|r| system_volume_for(id, r)),
    }
}

fn profiler_item<'a>(profiler: &'a Value, id: &str) -> Option<&'a Value> {
    ["SPNVMeDataType", "SPSerialATADataType"]
        .iter()
        .filter_map(|k| profiler.get(*k)?.as_array())
        .flatten()
        .filter_map(|controller| controller.get("_items")?.as_array())
        .flatten()
        .find(|item| json_str(item, "bsd_name") == Some(id))
}

/// Ruang volume sistem, bila volume itu tersimpan di disk `id`.
pub fn system_volume_for(id: &str, root: &Value) -> Option<VolumeSpace> {
    let on_this_disk = match root.get("APFSPhysicalStores").and_then(Value::as_array) {
        Some(stores) => stores
            .iter()
            .filter_map(|s| json_str(s, "APFSPhysicalStore"))
            .any(|p| whole_disk_of(p) == id),
        None => json_str(root, "ParentWholeDisk") == Some(id),
    };
    if !on_this_disk {
        return None;
    }
    let (free, total) = match (
        json_u64(root, "APFSContainerFree"),
        json_u64(root, "APFSContainerSize"),
    ) {
        (Some(free), Some(total)) => (free, total),
        _ => (json_u64(root, "FreeSpace")?, json_u64(root, "TotalSize")?),
    };
    (total > 0 && free <= total).then_some(VolumeSpace {
        free_bytes: free,
        total_bytes: total,
    })
}

/// "disk0s2" -> "disk0"; "disk10s1" -> "disk10"; "disk0" -> "disk0".
pub fn whole_disk_of(partition: &str) -> &str {
    match partition.rfind('s') {
        Some(i)
            if i > 4
                && i + 1 < partition.len()
                && partition[i + 1..].chars().all(|c| c.is_ascii_digit()) =>
        {
            &partition[..i]
        }
        _ => partition,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn json(text: &str) -> Value {
        serde_json::from_str(text).unwrap()
    }

    #[test]
    fn parses_real_intel_fixture() {
        let list = json(fixture!("diskutil_list_physical.json"));
        assert_eq!(whole_disks(&list), ["disk0"]);

        let info = json(fixture!("diskutil_info_disk0.json"));
        let root = json(fixture!("diskutil_info_root.json"));
        let profiler = json(fixture!("sp_storage.json"));
        let d = parse_disk("disk0", &info, Some(&profiler), Some(&root));

        assert_eq!(d.model.as_deref(), Some("APPLE SSD AP0512N"));
        assert_eq!(d.size_bytes, Some(500_277_792_768));
        assert_eq!(d.solid_state, Some(true));
        assert_eq!(d.protocol.as_deref(), Some("PCI-Express"));
        assert_eq!(d.internal, Some(true));
        assert_eq!(d.smart_status.as_deref(), Some("Verified"));
        assert_eq!(d.trim, Some(true));
        assert_eq!(
            d.system_volume,
            Some(VolumeSpace {
                free_bytes: 27_478_630_400,
                total_bytes: 441_000_632_320
            })
        );
    }

    #[test]
    fn system_volume_only_on_matching_disk() {
        let root = json(fixture!("diskutil_info_root.json"));
        assert!(system_volume_for("disk2", &root).is_none());
    }

    #[test]
    fn hfs_volume_uses_parent_whole_disk() {
        let root =
            serde_json::json!({"ParentWholeDisk": "disk1", "FreeSpace": 10, "TotalSize": 100});
        assert_eq!(
            system_volume_for("disk1", &root),
            Some(VolumeSpace {
                free_bytes: 10,
                total_bytes: 100
            })
        );
    }

    #[test]
    fn whole_disk_names() {
        assert_eq!(whole_disk_of("disk0s2"), "disk0");
        assert_eq!(whole_disk_of("disk10s1"), "disk10");
        assert_eq!(whole_disk_of("disk0"), "disk0");
        assert_eq!(whole_disk_of("disk3s"), "disk3s");
    }

    #[test]
    fn missing_fields_stay_none() {
        let d = parse_disk("disk9", &serde_json::json!({}), None, None);
        assert_eq!(d.smart_status, None);
        assert_eq!(d.solid_state, None);
        assert_eq!(d.system_volume, None);
    }
}
