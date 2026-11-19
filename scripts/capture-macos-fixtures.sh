#!/bin/sh
# Mengambil output sistem macOS yang dipakai parser Laptop Health Check,
# lalu MENYANITASI semua nomor seri / UUID / EDID sebelum disimpan sebagai
# fixture test. Hanya membaca; tidak butuh hak admin; tidak mengubah sistem.
#
# Pemakaian:
#   sh scripts/capture-macos-fixtures.sh <nama-perangkat>
#   contoh: sh scripts/capture-macos-fixtures.sh apple-silicon-m2-air
#
# Hasil: src-tauri/fixtures/macos/<nama-perangkat>/
# Periksa ulang hasilnya sebelum di-commit.
set -eu

NAME="${1:?Nama perangkat wajib diisi, mis. intel-macbookpro16-2}"
case "$NAME" in *[!a-z0-9-]*) echo "Nama hanya boleh huruf kecil, angka, dan '-'"; exit 1;; esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src-tauri/fixtures/macos/$NAME"
mkdir -p "$OUT"

# Ganti nilai kunci yang mengandung serial/UUID/UDID/EDID/ID unik dengan "REDACTED".
# Bekerja untuk JSON (pretty maupun ringkas) dan teks ioreg ("Key" = value).
sanitize() {
  /usr/bin/sed -E \
    -e 's/("[^"]*([Ss]erial|SERIAL|UUID|[Uu]uid|UDID|[Uu]did|EDID|[Ee]did|GroupID|SnapshotName)[^"]*"[[:space:]]*[:=][[:space:]]*)("[^"]*"|<[^>]*>|[0-9]+)/\1"REDACTED"/g'
}

plist_json() { /usr/bin/plutil -convert json -o - -; }

echo "Menyimpan fixture ke $OUT"

# Baterai: hanya baris tingkat atas bernilai sederhana (tanpa blob data).
/usr/sbin/ioreg -rn AppleSmartBattery \
  | /usr/bin/grep -E '^[[:space:]]*\| *"[A-Za-z0-9]+" = ("[^"]*"|[0-9-]+|Yes|No)$|^[[:space:]]*"[A-Za-z0-9]+" = ("[^"]*"|[0-9-]+|Yes|No)$' \
  | sanitize > "$OUT/ioreg_battery.txt" || true

/usr/sbin/system_profiler SPPowerDataType -json | sanitize > "$OUT/sp_power.json"
/usr/sbin/diskutil list -plist physical | plist_json | sanitize > "$OUT/diskutil_list_physical.json"
/usr/sbin/diskutil info -plist / | plist_json | sanitize > "$OUT/diskutil_info_root.json"
for d in $(/usr/sbin/diskutil list -plist physical | plist_json | /usr/bin/sed -E 's/.*"WholeDisks":\[([^]]*)\].*/\1/' | /usr/bin/tr -d '"' | /usr/bin/tr ',' ' '); do
  /usr/sbin/diskutil info -plist "$d" | plist_json | sanitize > "$OUT/diskutil_info_$d.json"
done
/usr/sbin/system_profiler SPNVMeDataType SPSerialATADataType -json | sanitize > "$OUT/sp_storage.json"

/usr/bin/vm_stat > "$OUT/vm_stat.txt"
for k in hw.memsize hw.pagesize vm.swapusage kern.memorystatus_vm_pressure_level \
         machdep.cpu.brand_string hw.physicalcpu hw.logicalcpu \
         hw.perflevel0.physicalcpu hw.perflevel1.physicalcpu hw.cpufrequency; do
  printf '%s: %s\n' "$k" "$(/usr/sbin/sysctl -n "$k" 2>/dev/null || echo UNAVAILABLE)"
done > "$OUT/sysctl.txt"
/usr/sbin/system_profiler SPMemoryDataType -json | sanitize > "$OUT/sp_memory.json"
/usr/bin/pmset -g therm > "$OUT/pmset_therm.txt" 2>&1 || true

/usr/sbin/system_profiler SPDisplaysDataType -json | sanitize > "$OUT/sp_displays.json"
/usr/sbin/system_profiler SPHardwareDataType -json | sanitize > "$OUT/sp_hardware.json"
/usr/bin/profiles status -type enrollment > "$OUT/profiles_enrollment.txt" 2>&1 || true

echo "Selesai. Daftar file:"
/bin/ls -1 "$OUT"
echo "PERIKSA: pastikan tidak ada nomor seri/UUID asli sebelum commit."
