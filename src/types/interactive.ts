// Tipe Tes Interaktif (Fase 3).
import type { Params, UiKey } from "../i18n/translate.ts";
// Bagian yang berasal dari Rust (GateStatus, LaunchMode, DeviceProfile) adalah
// CERMIN dari src-tauri/src/{media_gate,selfcheck}.rs dan diagnostics/device_profile.rs.

export type InteractiveTestId =
  | "display"
  | "keyboard"
  | "trackpad"
  | "touchBar"
  | "speakers"
  | "microphone"
  | "camera"
  | "wifi"
  | "bluetooth"
  | "ports";

/**
 * Status hasil tes:
 * - notRun      : Belum diuji
 * - passed      : Lulus
 * - failed      : Gagal
 * - unavailable : Tidak tersedia (komponen tidak ada, izin ditolak, belum didukung)
 * - cancelled   : Dibatalkan (pengguna keluar sebelum selesai)
 */
export type TestOutcome = "notRun" | "passed" | "failed" | "unavailable" | "cancelled";

/** Asal bukti: diukur aplikasi dari event/data perangkat, atau pengamatan pengguna. */
export type EvidenceKind = "measured" | "userConfirmed";

export type EvidenceLevel = "ok" | "warning" | "critical" | "info";

export interface Evidence {
  kind: EvidenceKind;
  level: EvidenceLevel;
  /** Kunci terjemahan (src/i18n/ui.ts) + parameter — bukan kalimat jadi. */
  code: UiKey;
  params?: Params;
  /** Ambang belum dikalibrasi di Mac asli: hanya informasi, tidak mengubah hasil. */
  experimental?: boolean;
}

export interface InteractiveResult {
  id: InteractiveTestId;
  outcome: TestOutcome;
  /** Ringkasan satu kalimat sebagai kunci terjemahan + parameter. */
  summaryCode: UiKey;
  summaryParams?: Params;
  evidence: Evidence[];
  /** Keterbatasan deteksi (kunci terjemahan) — selalu ditampilkan. */
  limitations: UiKey[];
  finishedAt?: string;
  durationMs?: number;
}

export type InteractiveResults = Partial<Record<InteractiveTestId, InteractiveResult>>;

/** Cermin `media_gate::GateStatus`. */
export interface GateStatus {
  open: boolean;
  camera: boolean;
  microphone: boolean;
  remainingSecs: number;
}

/** Cermin `selfcheck::LaunchMode`. */
export type LaunchMode =
  | "normal"
  | "mediaPassive"
  | "mediaDeny"
  | "mediaCamera"
  | "mediaMicrophone"
  | "mediaIsolation"
  | "mediaDryRun";

/** Cermin `media_window::MediaKind`. */
export type MediaKind = "camera" | "microphone";
/** Cermin `media_window::MediaPurpose`. */
export type MediaPurpose = "session" | "retryClosed" | "dryRun";
/** Cermin `media_window::MediaTask`. */
export interface MediaTask {
  kind: MediaKind;
  purpose: MediaPurpose;
  holdMs: number;
}
/** Cermin `media_window::SessionFinished` (event `media-session-finished`). */
export interface MediaSessionFinished {
  task: MediaTask | null;
  report: unknown;
  closedByUser: boolean;
}

/** Cermin `device_profile::DeviceProfile`. */
export interface DeviceProfile {
  modelIdentifier: string | null;
  touchBar: boolean | null;
}
