// Katalog terjemahan modul bluetooth (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const BLUETOOTH_MESSAGES = {
  // --- Layar tes ---------------------------------------------------------------
  "bluetooth.title": { id: "Tes Bluetooth", en: "Bluetooth Test" },
  "bluetooth.intro": {
    id: "Membaca status pengontrol Bluetooth dari macOS tanpa memindai, mencari, atau memasangkan perangkat. Aplikasi tidak pernah menyalakan atau mematikan Bluetooth.",
    en: "Reads the Bluetooth controller status from macOS without scanning, discovering, or pairing devices. The app never turns Bluetooth on or off.",
  },
  "bluetooth.loading": { id: "Membaca status Bluetooth…", en: "Reading Bluetooth status…" },
  "bluetooth.recheck": { id: "Periksa ulang", en: "Check again" },
  "bluetooth.save": { id: "Simpan hasil", en: "Save result" },
  "bluetooth.exit": { id: "Keluar", en: "Exit" },
  "bluetooth.state.on": { id: "Pengontrol Bluetooth aktif.", en: "The Bluetooth controller is on." },
  "bluetooth.state.off": { id: "Bluetooth sedang dimatikan.", en: "Bluetooth is turned off." },
  "bluetooth.state.noController": { id: "Pengontrol Bluetooth tidak ditemukan.", en: "No Bluetooth controller was found." },
  "bluetooth.state.unknown": { id: "Status Bluetooth tidak dapat dibaca.", en: "The Bluetooth status could not be read." },
  "bluetooth.turnOnHint": {
    id: "Nyalakan Bluetooth sendiri lewat Control Center atau System Settings › Bluetooth, lalu tekan Periksa ulang. Aplikasi ini tidak pernah mengubah pengaturan.",
    en: "Turn Bluetooth on yourself via Control Center or System Settings › Bluetooth, then press Check again. This app never changes settings.",
  },
  "bluetooth.details": { id: "Detail terukur", en: "Measured details" },
  "bluetooth.field.chipset": { id: "Chipset", en: "Chipset" },
  "bluetooth.field.firmware": { id: "Firmware", en: "Firmware" },
  "bluetooth.field.transport": { id: "Transport", en: "Transport" },
  "bluetooth.field.vendor": { id: "Vendor ID", en: "Vendor ID" },
  "bluetooth.field.discoverable": { id: "Dapat ditemukan", en: "Discoverable" },
  "bluetooth.field.services": { id: "Layanan", en: "Services" },
  "bluetooth.field.connected": { id: "Perangkat tersambung", en: "Connected devices" },
  "bluetooth.field.paired": { id: "Dipasangkan, tidak tersambung", en: "Paired, not connected" },
  "bluetooth.value.yes": { id: "Ya", en: "Yes" },
  "bluetooth.value.no": { id: "Tidak", en: "No" },
  "bluetooth.value.connected": { id: "{n} ({types})", en: "{n} ({types})" },
  "bluetooth.confirm.legend": { id: "Konfirmasi Anda (opsional)", en: "Your confirmation (optional)" },
  "bluetooth.confirm.notAnswered": { id: "Tidak dijawab", en: "No answer" },
  "bluetooth.confirm.works": {
    id: "Bluetooth berfungsi normal bagi saya (mis. headphone atau mouse tersambung)",
    en: "Bluetooth works normally for me (e.g. headphones or a mouse connect)",
  },
  "bluetooth.confirm.problem": {
    id: "Ada masalah (perangkat sulit tersambung atau sering putus)",
    en: "There is a problem (devices struggle to connect or drop often)",
  },
  "bluetooth.technical": { id: "Detail teknis: {error}", en: "Technical detail: {error}" },
  "bluetooth.type.headphones": { id: "headphone", en: "headphones" },
  "bluetooth.type.speaker": { id: "speaker", en: "speaker" },
  "bluetooth.type.keyboard": { id: "keyboard", en: "keyboard" },
  "bluetooth.type.mouse": { id: "mouse", en: "mouse" },
  "bluetooth.type.trackpad": { id: "trackpad", en: "trackpad" },
  "bluetooth.type.gamepad": { id: "gamepad", en: "gamepad" },
  "bluetooth.type.phone": { id: "ponsel", en: "phone" },
  "bluetooth.type.watch": { id: "jam tangan", en: "watch" },
  "bluetooth.type.computer": { id: "komputer", en: "computer" },
  "bluetooth.type.unknown": { id: "jenis tidak diketahui", en: "unknown type" },

  // --- Bukti & ringkasan hasil ---------------------------------------------------
  "bluetoothResult.readError": {
    id: "Status Bluetooth tidak dapat dibaca ({error}).",
    en: "The Bluetooth status could not be read ({error}).",
  },
  "bluetoothResult.noController": { id: "macOS tidak menemukan pengontrol Bluetooth.", en: "macOS found no Bluetooth controller." },
  "bluetoothResult.noControllerCaveat": {
    id: "Semua Mac memiliki Bluetooth; bila tetap tidak ditemukan setelah Mac dimulai ulang, kemungkinan ada masalah hardware atau firmware.",
    en: "Every Mac has Bluetooth; if it is still not found after restarting the Mac, there may be a hardware or firmware problem.",
  },
  "bluetoothResult.controllerFoundOff": {
    id: "Pengontrol Bluetooth (chipset {chipset}) terdeteksi, tetapi sedang dimatikan.",
    en: "The Bluetooth controller (chipset {chipset}) was detected, but it is turned off.",
  },
  "bluetoothResult.on": { id: "Pengontrol Bluetooth aktif (chipset {chipset}).", en: "The Bluetooth controller is on (chipset {chipset})." },
  "bluetoothResult.controllerDetails": { id: "Firmware {firmware}, transport {transport}.", en: "Firmware {firmware}, transport {transport}." },
  "bluetoothResult.connected": { id: "{n} perangkat tersambung: {types}.", en: "{n} device(s) connected: {types}." },
  "bluetoothResult.noneConnected": {
    id: "Tidak ada perangkat yang sedang tersambung (bukan tanda kerusakan).",
    en: "No devices are currently connected (not a sign of damage).",
  },
  "bluetoothResult.paired": {
    id: "{n} perangkat dipasangkan tetapi tidak tersambung.",
    en: "{n} device(s) paired but not connected.",
  },
  "bluetoothResult.userWorks": {
    id: "Pengguna mengonfirmasi Bluetooth berfungsi normal.",
    en: "The user confirmed Bluetooth works normally.",
  },
  "bluetoothResult.userProblem": {
    id: "Pengguna melaporkan masalah Bluetooth (bisa karena perangkat lain atau jarak, belum tentu hardware Mac).",
    en: "The user reported a Bluetooth problem (may be the other device or distance, not necessarily the Mac's hardware).",
  },
  "bluetoothResult.unknownSummary": { id: "Status Bluetooth tidak dapat dibaca.", en: "The Bluetooth status could not be read." },
  "bluetoothResult.offSummary": {
    id: "Bluetooth dimatikan — nyalakan sendiri lalu ulangi tes.",
    en: "Bluetooth is off — turn it on yourself and repeat the test.",
  },
  "bluetoothResult.noControllerSummary": { id: "Pengontrol Bluetooth tidak ditemukan.", en: "No Bluetooth controller was found." },
  "bluetoothResult.passed": {
    id: "Pengontrol Bluetooth aktif; {n} perangkat tersambung.",
    en: "The Bluetooth controller is on; {n} device(s) connected.",
  },
  "bluetoothResult.cancelled": { id: "Tes Bluetooth dibatalkan.", en: "The Bluetooth test was cancelled." },

  // --- Keterbatasan ------------------------------------------------------------------
  "bluetoothLimit.noScan": {
    id: "Tidak memindai, mencari, atau memasangkan perangkat Bluetooth.",
    en: "Does not scan for, discover, or pair Bluetooth devices.",
  },
  "bluetoothLimit.privacy": {
    id: "Nama dan alamat perangkat tidak dibaca; hanya jumlah dan jenis perangkat yang ditampilkan.",
    en: "Device names and addresses are not read; only the number and type of devices are shown.",
  },
  "bluetoothLimit.noSettings": {
    id: "Aplikasi tidak pernah menyalakan, mematikan, atau mengubah Bluetooth.",
    en: "The app never turns Bluetooth on or off or changes it.",
  },
  "bluetoothLimit.range": {
    id: "Kualitas koneksi bergantung pada jarak, gangguan, dan perangkat lawan; status aktif tidak menjamin jangkauan.",
    en: "Connection quality depends on distance, interference, and the other device; an active status does not guarantee range.",
  },
} satisfies Record<string, Entry>;
