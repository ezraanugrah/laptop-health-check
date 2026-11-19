// Wrapper bertipe untuk command Tauri (lihat src-tauri/src/commands.rs).
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppInfo, DiagnosticsReport } from "../types/diagnostics";
import type { Settings } from "./settings";
import type {
  DeviceProfile,
  GateStatus,
  LaunchMode,
  MediaKind,
  MediaPurpose,
  MediaSessionFinished,
  MediaTask,
} from "../types/interactive";
import type { TouchBarSession, TouchBarStatus, TouchBarTap } from "../types/touchbar";
import type {
  AudioOutputs,
  BluetoothReport,
  PortsSnapshot,
  TouchBarPresence,
  WifiReport,
} from "../types/peripherals";

/** `false` bila halaman dibuka di browser biasa (mis. `npm run dev`), bukan di aplikasi desktop. */
export const inDesktopApp = isTauri;

export const api = {
  getAppInfo: () => invoke<AppInfo>("get_app_info"),
  runDiagnostics: () => invoke<DiagnosticsReport>("run_diagnostics"),
  /** Hanya dipanggil saat pengguna memilih "Tampilkan" (privasi). */
  getSerialNumber: () => invoke<string | null>("get_serial_number"),
  getDeviceProfile: () => invoke<DeviceProfile>("get_device_profile"),
  /** Preferensi tema/bahasa dari settings.json lokal (default Gelap + Indonesia). */
  getSettings: () => invoke<Settings>("get_settings"),
  saveSettings: (settings: Settings) => invoke<Settings>("save_settings", { settings }),
  /** Layar penuh jendela aplikasi (Tes Layar). Tidak mengubah pengaturan tampilan sistem. */
  setWindowFullscreen: (enabled: boolean) => invoke<void>("set_window_fullscreen", { enabled }),
  /** Ringkasan hasil tes ke log aplikasi (verifikasi di Mac asli; tanpa teks ketikan). */
  logInteractiveResult: (id: string, outcome: string, summary: string, evidence: string[]) =>
    invoke<void>("log_interactive_result", { id, outcome, summary, evidence }),
  /** Jendela tes media terpisah (satu per sesi). Hanya dari jendela utama. */
  openMediaWindow: (kind: MediaKind, purpose: MediaPurpose, holdMs: number) =>
    invoke<MediaTask>("open_media_window", { kind, purpose, holdMs }),
  /** Tugas jendela pemanggil; `null` bila bukan jendela tes media. */
  getMediaTask: () => invoke<MediaTask | null>("get_media_task"),
  focusMediaWindow: () => invoke<void>("focus_media_window"),
  /** Dari jendela tes media: kirim laporan, lalu jendela dihancurkan. */
  finishMediaSession: (report: unknown) => invoke<void>("finish_media_session", { report }),
  /** Dari jendela utama: hancurkan jendela tes media (batal). */
  cancelMediaWindow: () => invoke<boolean>("cancel_media_window"),
  mediaWindowOpen: () => invoke<boolean>("media_window_open"),
  onMediaSessionFinished: (handler: (payload: MediaSessionFinished) => void): Promise<UnlistenFn> =>
    listen<MediaSessionFinished>("media-session-finished", (event) => handler(event.payload)),
  /** Gerbang izin media: hanya dipakai lewat lib/media/session.ts. */
  mediaGateOpen: (camera: boolean, microphone: boolean) =>
    invoke<GateStatus>("media_gate_open", { camera, microphone }),
  mediaGateClose: () => invoke<GateStatus>("media_gate_close"),
  mediaGateStatus: () => invoke<GateStatus>("media_gate_status"),
  getLaunchMode: () => invoke<LaunchMode>("get_launch_mode"),
  reportSelfcheck: (report: unknown) => invoke<void>("report_selfcheck", { report }),
  /** Laporan: JSON ke lokasi pilihan pengguna (dialog Simpan macOS); `null` = dibatalkan. */
  exportReportJson: (contents: string, fileName: string) =>
    invoke<string | null>("export_report_json", { contents, fileName }),
  /** Laporan: dialog cetak macOS (Simpan sebagai PDF). */
  printReport: () => invoke<void>("print_report"),
  /** Tes Touch Bar: pasang tombol uji sementara (4–8 segmen) di jendela utama. */
  touchBarTestStart: (segments: number) => invoke<TouchBarSession>("touchbar_test_start", { segments }),
  /** Lepas tombol uji; `session` = hanya sesi itu, `null` = sesi apa pun. */
  touchBarTestStop: (session: number | null = null) => invoke<boolean>("touchbar_test_stop", { session }),
  touchBarTestStatus: () => invoke<TouchBarStatus>("touchbar_test_status"),
  onTouchBarTap: (handler: (payload: TouchBarTap) => void): Promise<UnlistenFn> =>
    listen<TouchBarTap>("touchbar-tap", (event) => handler(event.payload)),
  /** Wi-Fi via CoreWLAN tanpa pemindaian + rute jaringan macOS (bukan uji internet). */
  getWifiStatus: () => invoke<WifiReport>("get_wifi_status"),
  /** Bluetooth: status pengontrol + jumlah/jenis perangkat (tanpa nama/alamat). */
  getBluetoothStatus: () => invoke<BluetoothReport>("get_bluetooth_status"),
  /** Potret port USB/Thunderbolt (untuk tes port manual: bandingkan dua potret). */
  getPortsSnapshot: () => invoke<PortsSnapshot>("get_ports_snapshot"),
  /** Keluaran audio (transport + nama hanya untuk perangkat bawaan Apple). */
  getAudioOutputs: () => invoke<AudioOutputs>("get_audio_outputs"),
  /** Bukti hardware Touch Bar (IORegistry + TouchBarServer), bukan nama model. */
  getTouchBarPresence: () => invoke<TouchBarPresence>("get_touch_bar_presence"),
};
