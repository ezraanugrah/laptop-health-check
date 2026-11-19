// Tes Kamera & Mikrofon (fungsi murni): membaca laporan dari jendela tes media terpisah
// dan jawaban pengguna, lalu menyusun hasil. Laporan jendela media hanya berisi status,
// pengaturan track, dan angka (frame, level, durasi) — tidak pernah gambar atau suara.
import type { Evidence, InteractiveResult, TestOutcome } from "../../types/interactive";
import type { UiKey } from "../../i18n/translate.ts";
import { decideCompletedOutcome } from "./outcome.ts";

/** Kamera menyala maksimal 10 dtk (batas Rust MAX_HOLD_MS). */
export const CAMERA_HOLD_MS = 10_000;
/** Mikrofon merekam maksimal 5 dtk; rekaman hanya di memori lalu dibuang. */
export const MICROPHONE_HOLD_MS = 5_000;
/** Batas menunggu jendela media (termasuk memutar ulang rekaman). */
export const MEDIA_WAIT_MS = 180_000;
/** Ambang level suara belum dikalibrasi di Mac asli → hanya informasi eksperimental. */
export const QUIET_PEAK_DBFS = -50;

export interface SessionTrack {
  kind: string;
  width: number | null;
  height: number | null;
  frameRate: number | null;
  sampleRate: number | null;
  channelCount: number | null;
}

export interface MediaSessionReport {
  acquired: boolean;
  failure: string | null;
  tracks: SessionTrack[];
  stopReason: string | null;
  allTracksEnded: boolean;
  gateClosedAfter: boolean;
  activeSessionsAfter: number | null;
  framesRendered: number | null;
  frameCountSupported: boolean;
  peakDbfs: number | null;
  recordedMs: number | null;
  recorderSupported: boolean;
  played: boolean;
  error: string | null;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});

/** Membaca laporan jendela media secara defensif (bentuk `unknown` dari event). */
export function parseSessionReport(raw: unknown): MediaSessionReport {
  const r = obj(raw);
  const measured = obj(r.measured);
  const after = obj(r.afterRelease);
  const tracks = Array.isArray(r.tracks)
    ? r.tracks.map((t) => {
        const o = obj(t);
        return {
          kind: String(o.kind ?? ""),
          width: num(o.width),
          height: num(o.height),
          frameRate: num(o.frameRate),
          sampleRate: num(o.sampleRate),
          channelCount: num(o.channelCount),
        };
      })
    : [];
  return {
    acquired: r.acquired === true,
    failure: typeof r.failure === "string" ? r.failure : null,
    tracks,
    stopReason: typeof obj(r.stop).reason === "string" ? String(obj(r.stop).reason) : null,
    allTracksEnded: r.allTracksEnded === true,
    gateClosedAfter: obj(r.gateAfterRelease).open === false,
    activeSessionsAfter: num(r.activeSessionsAfterRelease),
    framesRendered: num(measured.framesRendered),
    frameCountSupported: measured.frameCountSupported === true,
    peakDbfs: num(measured.peakDbfs),
    recordedMs: num(measured.recordedMs),
    recorderSupported: measured.recorderSupported === true,
    played: after.played === true,
    error: typeof r.error === "string" ? r.error : null,
  };
}

export type CameraImageAnswer = "clear" | "blurry" | "artifacts" | "none";
export type CameraLedAnswer = "on" | "off" | "notNoticed";
export type MicPlaybackAnswer = "clear" | "faint" | "noisy" | "none" | "couldNotPlay";

export const CAMERA_LIMITATIONS: UiKey[] = [
  "camera.limit.noStorage",
  "camera.limit.userConfirmed",
  "camera.limit.permission",
];
export const MICROPHONE_LIMITATIONS: UiKey[] = [
  "microphone.limit.memoryOnly",
  "microphone.limit.userConfirmed",
  "microphone.limit.levelExperimental",
  "microphone.limit.permission",
];

function base(id: "camera" | "microphone", outcome: TestOutcome, summaryCode: UiKey, evidence: Evidence[]): InteractiveResult {
  return {
    id,
    outcome,
    summaryCode,
    evidence,
    limitations: id === "camera" ? CAMERA_LIMITATIONS : MICROPHONE_LIMITATIONS,
    finishedAt: new Date().toISOString(),
  };
}

export function cancelledMediaTest(id: "camera" | "microphone"): InteractiveResult {
  return base(id, "cancelled", id === "camera" ? "camera.result.cancelled" : "microphone.result.cancelled", []);
}

/**
 * Hasil bila perangkat tidak bisa dibuka. Izin ditolak / sedang dipakai = "Tidak tersedia"
 * (bukan kerusakan); tidak ditemukan macOS = Gagal (terukur).
 */
export function notAcquiredResult(id: "camera" | "microphone", report: MediaSessionReport): InteractiveResult {
  const p = id === "camera" ? "camera" : "microphone";
  switch (report.failure) {
    case "notFound":
      return base(id, "failed", `${p}.result.notFound` as UiKey, [
        { kind: "measured", level: "critical", code: `${p}.evidence.notFound` as UiKey },
      ]);
    case "denied":
      return base(id, "unavailable", `${p}.result.denied` as UiKey, [
        { kind: "measured", level: "info", code: `${p}.evidence.denied` as UiKey },
      ]);
    case "busy":
      return base(id, "unavailable", `${p}.result.busy` as UiKey, [
        { kind: "measured", level: "info", code: `${p}.evidence.busy` as UiKey },
      ]);
    default:
      return base(id, "unavailable", `${p}.result.other` as UiKey, [
        { kind: "measured", level: "info", code: `${p}.evidence.other` as UiKey, params: { reason: report.failure ?? report.error ?? "?" } },
      ]);
  }
}

/** Bukti keamanan yang sama untuk kamera & mikrofon: perangkat mati dan gerbang tertutup. */
function shutdownEvidence(id: "camera" | "microphone", report: MediaSessionReport): Evidence {
  const p = id === "camera" ? "camera" : "microphone";
  const clean = report.allTracksEnded && report.gateClosedAfter && (report.activeSessionsAfter ?? 0) === 0;
  return clean
    ? { kind: "measured", level: "ok", code: `${p}.evidence.shutdownOk` as UiKey }
    : { kind: "measured", level: "critical", code: `${p}.evidence.shutdownProblem` as UiKey };
}

export function cameraResult(report: MediaSessionReport, image: CameraImageAnswer, led: CameraLedAnswer): InteractiveResult {
  if (!report.acquired) return notAcquiredResult("camera", report);
  const video = report.tracks.find((t) => t.kind === "video");
  const evidence: Evidence[] = [];
  if (video?.width && video.height) {
    evidence.push({
      kind: "measured",
      level: "ok",
      code: "camera.evidence.active",
      params: { size: `${video.width}×${video.height}`, fps: video.frameRate ?? "?" },
    });
  }
  if (!report.frameCountSupported || report.framesRendered === null) {
    evidence.push({ kind: "measured", level: "info", code: "camera.evidence.framesUnsupported" });
  } else if (report.framesRendered > 0) {
    evidence.push({ kind: "measured", level: "ok", code: "camera.evidence.frames", params: { n: report.framesRendered } });
  } else {
    evidence.push({ kind: "measured", level: "critical", code: "camera.evidence.noFrames" });
  }
  evidence.push(shutdownEvidence("camera", report));
  const imageLevel = { clear: "ok", blurry: "warning", artifacts: "critical", none: "critical" } as const;
  evidence.push({ kind: "userConfirmed", level: imageLevel[image], code: `camera.answer.image.${image}` as UiKey });
  const ledLevel = { on: "ok", off: "warning", notNoticed: "info" } as const;
  evidence.push({ kind: "userConfirmed", level: ledLevel[led], code: `camera.answer.led.${led}` as UiKey });
  const outcome = decideCompletedOutcome(evidence);
  return base("camera", outcome, outcome === "passed" ? "camera.result.passed" : "camera.result.failed", evidence);
}

export function microphoneResult(report: MediaSessionReport, playback: MicPlaybackAnswer): InteractiveResult {
  if (!report.acquired) return notAcquiredResult("microphone", report);
  const audio = report.tracks.find((t) => t.kind === "audio");
  const evidence: Evidence[] = [
    {
      kind: "measured",
      level: "ok",
      code: "microphone.evidence.active",
      params: { rate: audio?.sampleRate ?? "?", channels: audio?.channelCount ?? "?" },
    },
  ];
  if (report.recorderSupported && report.recordedMs !== null && report.recordedMs > 0) {
    evidence.push({
      kind: "measured",
      level: "info",
      code: "microphone.evidence.recorded",
      params: { s: (report.recordedMs / 1000).toFixed(1) },
    });
  } else {
    evidence.push({ kind: "measured", level: "info", code: "microphone.evidence.noRecorder" });
  }
  if (report.peakDbfs !== null) {
    evidence.push({
      kind: "measured",
      level: "info",
      code: report.peakDbfs < QUIET_PEAK_DBFS ? "microphone.evidence.peakQuiet" : "microphone.evidence.peak",
      params: { db: Math.round(report.peakDbfs) },
      experimental: true,
    });
  }
  evidence.push(shutdownEvidence("microphone", report));
  const level = { clear: "ok", faint: "warning", noisy: "warning", none: "critical", couldNotPlay: "info" } as const;
  evidence.push({ kind: "userConfirmed", level: level[playback], code: `microphone.answer.${playback}` as UiKey });
  const outcome = decideCompletedOutcome(evidence);
  return base("microphone", outcome, outcome === "passed" ? "microphone.result.passed" : "microphone.result.failed", evidence);
}

/** dBFS dari nilai RMS (0..1); 0 → -Infinity diganti batas bawah -100. */
export function rmsToDbfs(rms: number): number {
  if (!(rms > 0)) return -100;
  return Math.max(-100, 20 * Math.log10(rms));
}

/** Jumlah segmen meter (0..segments) yang menyala untuk level dBFS (-60..0). */
export function meterSegments(dbfs: number, segments = 20): number {
  const clamped = Math.min(0, Math.max(-60, dbfs));
  return Math.round(((clamped + 60) / 60) * segments);
}
