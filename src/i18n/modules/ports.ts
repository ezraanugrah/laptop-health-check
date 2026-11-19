// Katalog terjemahan modul ports (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const PORTS_MESSAGES = {
  // --- Layar tes ---------------------------------------------------------------
  "ports.title": { id: "Tes Port USB/Thunderbolt", en: "USB/Thunderbolt Port Test" },
  "ports.intro": {
    id: "Menampilkan bus, port, dan pengontrol yang dilaporkan macOS. Untuk menguji port secara nyata, pasang perangkat yang sudah terbukti berfungsi; aplikasi membandingkan kondisi sebelum dan sesudahnya.",
    en: "Shows the buses, ports, and controllers reported by macOS. To really test a port, plug in a device known to work; the app compares the state before and after.",
  },
  "ports.loading": { id: "Membaca port…", en: "Reading ports…" },
  "ports.refresh": { id: "Muat ulang", en: "Reload" },
  "ports.save": { id: "Simpan hasil", en: "Save result" },
  "ports.exit": { id: "Keluar", en: "Exit" },
  "ports.saveHint": { id: "Uji minimal satu port untuk menyimpan hasil.", en: "Test at least one port to save a result." },
  "ports.technical": { id: "Detail teknis: {error}", en: "Technical detail: {error}" },
  "ports.detected.title": { id: "Terdeteksi oleh macOS", en: "Detected by macOS" },
  "ports.tb.bus": { id: "Bus Thunderbolt {n}", en: "Thunderbolt bus {n}" },
  "ports.tb.receptacle": { id: "Receptacle {id}", en: "Receptacle {id}" },
  "ports.tb.devices": { id: "{n} perangkat Thunderbolt", en: "{n} Thunderbolt device(s)" },
  "ports.status.empty": { id: "Kosong", en: "Empty" },
  "ports.status.connected": { id: "Terhubung", en: "Connected" },
  "ports.status.unknown": { id: "Tidak diketahui", en: "Unknown" },
  "ports.speed.max": { id: "hingga {n} Gb/s", en: "up to {n} Gb/s" },
  "ports.speed.current": { id: "{n} Gb/s", en: "{n} Gb/s" },
  "ports.usb.controller": { id: "Pengontrol USB {version}", en: "USB {version} controller" },
  "ports.usb.controllerUnknown": { id: "Pengontrol USB", en: "USB controller" },
  "ports.usb.builtIn": { id: "bawaan", en: "built-in" },
  "ports.usb.internal": { id: "Bus internal Apple T2 · {n} komponen bawaan", en: "Apple T2 internal bus · {n} built-in component(s)" },
  "ports.usb.external": { id: "Perangkat USB eksternal: {n}", en: "External USB devices: {n}" },
  "ports.usb.device": { id: "{speed} · daya {power} · vendor {vendor}", en: "{speed} · power {power} · vendor {vendor}" },
  "ports.noThunderbolt": { id: "macOS tidak melaporkan bus Thunderbolt.", en: "macOS reports no Thunderbolt bus." },
  "ports.noUsb": { id: "macOS tidak melaporkan pengontrol USB.", en: "macOS reports no USB controller." },
  "ports.emptyNote": { id: "Port kosong bukan tanda kerusakan.", en: "An empty port is not a sign of damage." },
  "ports.manual.title": { id: "Tes manual per port", en: "Manual test per port" },
  "ports.manual.numbering": {
    id: "Beri nomor sendiri untuk setiap port fisik (mis. 1 = kiri dekat engsel). macOS tidak memberi tahu letak fisik port.",
    en: "Number each physical port yourself (e.g. 1 = left, near the hinge). macOS does not report where each port is.",
  },
  "ports.manual.port": { id: "Port {n}", en: "Port {n}" },
  "ports.manual.portState": { id: "Port {n}: {state}", en: "Port {n}: {state}" },
  "ports.manual.addPort": { id: "Tambah port", en: "Add port" },
  "ports.manual.removePort": { id: "Kurangi port", en: "Remove port" },
  "ports.state.notTested": { id: "Belum diuji", en: "Not tested" },
  "ports.state.ok": { id: "Berfungsi", en: "Working" },
  "ports.state.problem": { id: "Tidak terdeteksi", en: "Not detected" },
  "ports.state.unsure": { id: "Belum pasti", en: "Inconclusive" },
  "ports.step.prepare": {
    id: "Port {n}: lepaskan dulu perangkat dari port ini, lalu tekan “Siap”.",
    en: "Port {n}: first unplug any device from this port, then press “Ready”.",
  },
  "ports.step.ready": { id: "Siap", en: "Ready" },
  "ports.step.plug": {
    id: "Pasang perangkat yang sudah terbukti berfungsi (mis. flashdisk, mouse, atau hub) ke port {n}, tunggu ±3 detik, lalu tekan “Periksa”.",
    en: "Plug a device known to work (e.g. a flash drive, mouse, or hub) into port {n}, wait about 3 seconds, then press “Check”.",
  },
  "ports.step.check": { id: "Periksa", en: "Check" },
  "ports.step.checking": { id: "Memeriksa…", en: "Checking…" },
  "ports.step.detected": { id: "Perangkat baru terdeteksi di port {n}.", en: "A new device was detected on port {n}." },
  "ports.step.notDetected": { id: "Belum ada perangkat baru yang terdeteksi.", en: "No new device has been detected yet." },
  "ports.step.retry": { id: "Periksa lagi", en: "Check again" },
  "ports.step.reportSure": {
    id: "Tidak terdeteksi — perangkat & kabel sudah terbukti berfungsi",
    en: "Not detected — the device & cable are known to work",
  },
  "ports.step.reportUnsure": {
    id: "Tidak terdeteksi — belum yakin perangkat/kabelnya",
    en: "Not detected — not sure about the device/cable",
  },
  "ports.step.cancel": { id: "Batal", en: "Cancel" },
  "ports.step.done": { id: "Selesai, pilih port lain", en: "Done, choose another port" },
  "ports.step.caveat": {
    id: "Kabel atau perangkat yang rusak juga bisa membuat port tampak tidak berfungsi. Coba perangkat/kabel lain bila memungkinkan.",
    en: "A faulty cable or device can also make a port look broken. Try another device/cable if possible.",
  },

  // --- Bukti & ringkasan hasil ---------------------------------------------------
  "portsResult.structure": {
    id: "Terdeteksi: {buses} bus Thunderbolt, {receptacles} receptacle, {controllers} pengontrol USB.",
    en: "Detected: {buses} Thunderbolt bus(es), {receptacles} receptacle(s), {controllers} USB controller(s).",
  },
  "portsResult.emptyReceptacles": {
    id: "{n} receptacle kosong (kosong bukan tanda kerusakan).",
    en: "{n} empty receptacle(s) (empty is not a sign of damage).",
  },
  "portsResult.externalNow": { id: "{n} perangkat USB eksternal sedang terpasang.", en: "{n} external USB device(s) currently plugged in." },
  "portsResult.portDetected": { id: "Port {port}: perangkat baru terdeteksi.", en: "Port {port}: a new device was detected." },
  "portsResult.newUsb": {
    id: "Port {port}: perangkat USB baru ({speed}, daya {power}, vendor {vendor}).",
    en: "Port {port}: new USB device ({speed}, power {power}, vendor {vendor}).",
  },
  "portsResult.receptacleConnected": {
    id: "Port {port}: receptacle {id} berubah menjadi terhubung.",
    en: "Port {port}: receptacle {id} changed to connected.",
  },
  "portsResult.newThunderbolt": { id: "Port {port}: {n} perangkat Thunderbolt baru.", en: "Port {port}: {n} new Thunderbolt device(s)." },
  "portsResult.noChange": { id: "Port {port}: tidak ada perangkat baru yang terdeteksi.", en: "Port {port}: no new device was detected." },
  "portsResult.notDetectedSure": {
    id: "Port {port}: perangkat dan kabel yang menurut pengguna sudah terbukti berfungsi tidak terdeteksi — kemungkinan masalah port; pastikan lagi dengan perangkat/kabel lain.",
    en: "Port {port}: a device and cable the user says are known to work were not detected — possibly a port problem; confirm with another device/cable.",
  },
  "portsResult.notDetectedUnsure": {
    id: "Port {port}: tidak terdeteksi, tetapi perangkat/kabelnya belum terbukti baik — belum bisa disimpulkan rusak.",
    en: "Port {port}: not detected, but the device/cable is not known to work — it cannot be concluded to be faulty.",
  },
  "portsResult.untested": { id: "Belum diuji: port {ports}.", en: "Not tested: port(s) {ports}." },
  "portsResult.readError": { id: "Data port tidak dapat dibaca ({error}).", en: "Port data could not be read ({error})." },
  "portsResult.unavailable": { id: "Data port tidak dapat dibaca.", en: "Port data could not be read." },
  "portsResult.passed": {
    id: "{ok} dari {total} port terbukti berfungsi; {untested} belum diuji.",
    en: "{ok} of {total} ports proven working; {untested} not tested.",
  },
  "portsResult.failed": {
    id: "{n} dari {total} port tidak mendeteksi perangkat yang sudah terbukti berfungsi.",
    en: "{n} of {total} ports did not detect a device known to work.",
  },
  "portsResult.cancelled": { id: "Tes port dibatalkan ({n} port sudah dicoba).", en: "The port test was cancelled ({n} port(s) tried)." },

  // --- Keterbatasan ------------------------------------------------------------------
  "portsLimit.emptyNotBroken": {
    id: "Port kosong tidak pernah dianggap rusak; port yang belum dicoba tetap “Belum diuji”.",
    en: "An empty port is never considered broken; ports not tried stay “Not tested”.",
  },
  "portsLimit.knownGood": {
    id: "Gunakan perangkat dan kabel yang sudah terbukti berfungsi. Kabel/perangkat rusak bisa membuat port tampak bermasalah.",
    en: "Use a device and cable known to work. A faulty cable/device can make a port look faulty.",
  },
  "portsLimit.numbering": {
    id: "macOS tidak memberi tahu letak fisik tiap port; nomor port adalah pilihan Anda.",
    en: "macOS does not report where each port physically is; port numbers are your choice.",
  },
  "portsLimit.noStorage": {
    id: "Isi penyimpanan eksternal tidak pernah dibaca; nama dan nomor seri perangkat tidak dicatat.",
    en: "External storage contents are never read; device names and serial numbers are not recorded.",
  },
  "portsLimit.chargingVideo": {
    id: "Pengisian daya dan keluaran video lewat port belum diuji.",
    en: "Charging and video output through the ports are not tested.",
  },
} satisfies Record<string, Entry>;
