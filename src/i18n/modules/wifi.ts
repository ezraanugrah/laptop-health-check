// Katalog terjemahan modul wifi (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const WIFI_MESSAGES = {
  // --- Layar tes ---------------------------------------------------------------
  "wifi.title": { id: "Tes Wi-Fi", en: "Wi-Fi Test" },
  "wifi.intro": {
    id: "Membaca status adaptor Wi-Fi dari macOS (CoreWLAN) tanpa memindai jaringan sekitar. Aplikasi tidak pernah menyalakan, mematikan, atau mengubah Wi-Fi.",
    en: "Reads the Wi-Fi adapter status from macOS (CoreWLAN) without scanning nearby networks. The app never turns Wi-Fi on or off or changes it.",
  },
  "wifi.loading": { id: "Membaca status Wi-Fi…", en: "Reading Wi-Fi status…" },
  "wifi.recheck": { id: "Periksa ulang", en: "Check again" },
  "wifi.save": { id: "Simpan hasil", en: "Save result" },
  "wifi.exit": { id: "Keluar", en: "Exit" },
  "wifi.state.connected": { id: "Adaptor menyala dan tersambung ke jaringan.", en: "The adapter is on and connected to a network." },
  "wifi.state.notConnected": {
    id: "Adaptor menyala, tetapi tidak tersambung ke jaringan.",
    en: "The adapter is on, but not connected to a network.",
  },
  "wifi.state.poweredOff": { id: "Wi-Fi sedang dimatikan.", en: "Wi-Fi is turned off." },
  "wifi.state.noInterface": { id: "Antarmuka Wi-Fi tidak ditemukan.", en: "No Wi-Fi interface was found." },
  "wifi.state.unknown": { id: "Status Wi-Fi tidak dapat dibaca.", en: "The Wi-Fi status could not be read." },
  "wifi.turnOnHint": {
    id: "Nyalakan Wi-Fi sendiri lewat Control Center atau System Settings › Wi-Fi, lalu tekan Periksa ulang. Aplikasi ini tidak pernah mengubah pengaturan.",
    en: "Turn Wi-Fi on yourself via Control Center or System Settings › Wi-Fi, then press Check again. This app never changes settings.",
  },
  "wifi.details": { id: "Detail terukur", en: "Measured details" },
  "wifi.field.interface": { id: "Antarmuka", en: "Interface" },
  "wifi.field.signal": { id: "Sinyal (RSSI)", en: "Signal (RSSI)" },
  "wifi.field.noise": { id: "Derau", en: "Noise" },
  "wifi.field.snr": { id: "SNR", en: "SNR" },
  "wifi.field.quality": { id: "Kualitas sinyal (eksperimental)", en: "Signal quality (experimental)" },
  "wifi.field.rate": { id: "Kecepatan tautan", en: "Link rate" },
  "wifi.field.phy": { id: "Standar", en: "Standard" },
  "wifi.field.channel": { id: "Kanal", en: "Channel" },
  "wifi.field.route": { id: "Rute jaringan", en: "Network route" },
  "wifi.value.dbm": { id: "{n} dBm", en: "{n} dBm" },
  "wifi.value.db": { id: "{n} dB", en: "{n} dB" },
  "wifi.value.mbps": { id: "{n} Mbps", en: "{n} Mbps" },
  "wifi.value.channel": { id: "{channel} · {band}", en: "{channel} · {band}" },
  "wifi.value.channelWidth": { id: "{channel} · {band} · {width} MHz", en: "{channel} · {band} · {width} MHz" },
  "wifi.route.reported": { id: "macOS melaporkan ada rute (bukan uji internet)", en: "macOS reports a route (not an internet test)" },
  "wifi.route.notReported": { id: "macOS tidak melaporkan rute", en: "macOS reports no route" },
  "wifi.route.unknown": { id: "Tidak diketahui", en: "Unknown" },
  "wifi.quality.excellent": { id: "sangat baik", en: "excellent" },
  "wifi.quality.good": { id: "baik", en: "good" },
  "wifi.quality.fair": { id: "cukup", en: "fair" },
  "wifi.quality.weak": { id: "lemah", en: "weak" },
  "wifi.internet.title": { id: "Uji koneksi internet", en: "Internet connection test" },
  "wifi.internet.pending": {
    id: "Menunggu keputusan pemilik — aplikasi ini offline dan tidak mengirim data apa pun.",
    en: "Awaiting the owner's decision — this app is offline and sends no data.",
  },
  "wifi.confirm.legend": { id: "Konfirmasi Anda (opsional)", en: "Your confirmation (optional)" },
  "wifi.confirm.notAnswered": { id: "Tidak dijawab", en: "No answer" },
  "wifi.confirm.works": { id: "Wi-Fi berfungsi normal bagi saya", en: "Wi-Fi works normally for me" },
  "wifi.confirm.problem": {
    id: "Ada masalah (sering putus, lambat, atau sinyal lemah)",
    en: "There is a problem (frequent drops, slow, or weak signal)",
  },
  "wifi.technical": { id: "Detail teknis: {error}", en: "Technical detail: {error}" },

  // --- Bukti & ringkasan hasil ---------------------------------------------------
  "wifiResult.readError": { id: "Status Wi-Fi tidak dapat dibaca ({error}).", en: "The Wi-Fi status could not be read ({error})." },
  "wifiResult.noInterface": { id: "macOS tidak menemukan antarmuka Wi-Fi.", en: "macOS found no Wi-Fi interface." },
  "wifiResult.noInterfaceCaveat": {
    id: "Bila Mac ini memang memiliki Wi-Fi, ini indikasi masalah hardware atau driver; mulai ulang Mac lalu periksa lagi sebelum menyimpulkan rusak.",
    en: "If this Mac does have Wi-Fi, this indicates a hardware or driver problem; restart the Mac and check again before concluding it is faulty.",
  },
  "wifiResult.adapterFoundOff": {
    id: "Adaptor Wi-Fi ({iface}) terdeteksi, tetapi sedang dimatikan.",
    en: "The Wi-Fi adapter ({iface}) was detected, but it is turned off.",
  },
  "wifiResult.adapterOn": { id: "Adaptor Wi-Fi ({iface}) terdeteksi dan menyala.", en: "The Wi-Fi adapter ({iface}) was detected and is on." },
  "wifiResult.signal": { id: "Sinyal: {rssi} dBm.", en: "Signal: {rssi} dBm." },
  "wifiResult.signalNoise": {
    id: "Sinyal {rssi} dBm, derau {noise} dBm (SNR {snr} dB).",
    en: "Signal {rssi} dBm, noise {noise} dBm (SNR {snr} dB).",
  },
  "wifiResult.quality": {
    id: "Kualitas sinyal saat ini: {quality} (bergantung jarak dan lingkungan, bukan kondisi hardware).",
    en: "Current signal quality: {quality} (depends on distance and environment, not on hardware condition).",
  },
  "wifiResult.rate": { id: "Kecepatan tautan: {rate} Mbps.", en: "Link rate: {rate} Mbps." },
  "wifiResult.phy": { id: "Standar aktif: {phy}.", en: "Active standard: {phy}." },
  "wifiResult.channel": { id: "Kanal {channel} ({band}).", en: "Channel {channel} ({band})." },
  "wifiResult.channelWidth": {
    id: "Kanal {channel} ({band}, lebar {width} MHz).",
    en: "Channel {channel} ({band}, {width} MHz wide).",
  },
  "wifiResult.notConnected": {
    id: "Tidak tersambung ke jaringan — kekuatan sinyal tidak bisa diukur.",
    en: "Not connected to a network — signal strength cannot be measured.",
  },
  "wifiResult.routeReported": {
    id: "macOS melaporkan ada rute jaringan (bukan uji internet).",
    en: "macOS reports a network route (not an internet test).",
  },
  "wifiResult.routeNotReported": { id: "macOS tidak melaporkan rute jaringan.", en: "macOS reports no network route." },
  "wifiResult.userWorks": { id: "Pengguna mengonfirmasi Wi-Fi berfungsi normal.", en: "The user confirmed Wi-Fi works normally." },
  "wifiResult.userProblem": {
    id: "Pengguna melaporkan masalah koneksi Wi-Fi (bisa karena router atau lingkungan, belum tentu hardware).",
    en: "The user reported a Wi-Fi connection problem (may be the router or environment, not necessarily hardware).",
  },
  "wifiResult.unknownSummary": { id: "Status Wi-Fi tidak dapat dibaca.", en: "The Wi-Fi status could not be read." },
  "wifiResult.poweredOffSummary": {
    id: "Wi-Fi dimatikan — nyalakan sendiri lalu ulangi tes.",
    en: "Wi-Fi is off — turn it on yourself and repeat the test.",
  },
  "wifiResult.noInterfaceSummary": { id: "Antarmuka Wi-Fi tidak ditemukan.", en: "No Wi-Fi interface was found." },
  "wifiResult.passedConnected": { id: "Adaptor Wi-Fi ({iface}) menyala dan tersambung.", en: "The Wi-Fi adapter ({iface}) is on and connected." },
  "wifiResult.passedNotConnected": {
    id: "Adaptor Wi-Fi ({iface}) menyala, tetapi tidak tersambung.",
    en: "The Wi-Fi adapter ({iface}) is on, but not connected.",
  },
  "wifiResult.cancelled": { id: "Tes Wi-Fi dibatalkan.", en: "The Wi-Fi test was cancelled." },

  // --- Keterbatasan ------------------------------------------------------------------
  "wifiLimit.noScan": {
    id: "Tidak memindai jaringan sekitar dan tidak membaca nama jaringan (SSID), BSSID, maupun alamat MAC.",
    en: "Does not scan nearby networks and does not read the network name (SSID), BSSID, or MAC address.",
  },
  "wifiLimit.environment": {
    id: "Sinyal dan kecepatan bergantung pada jarak, penghalang, dan router — hanya informasi, tidak menggagalkan hardware. Batas kualitas sinyal belum dikalibrasi (eksperimental).",
    en: "Signal and speed depend on distance, obstacles, and the router — information only, never a hardware failure. Signal-quality thresholds are not calibrated (experimental).",
  },
  "wifiLimit.route": {
    id: "“Rute jaringan” berasal dari catatan macOS tanpa mengirim data; ini bukan uji koneksi internet. Uji internet aktif menunggu keputusan pemilik.",
    en: "“Network route” comes from macOS records without sending data; it is not an internet connection test. An active internet test awaits the owner's decision.",
  },
  "wifiLimit.noSettings": {
    id: "Aplikasi tidak pernah menyalakan, mematikan, atau mengubah Wi-Fi.",
    en: "The app never turns Wi-Fi on or off or changes it.",
  },
  "wifiLimit.permission": {
    id: "Beberapa nilai bisa tidak tersedia di versi macOS tertentu; nilai yang tidak terbaca ditampilkan sebagai “—”.",
    en: "Some values may be unavailable on certain macOS versions; unreadable values are shown as “—”.",
  },
} satisfies Record<string, Entry>;
