// Tes Touch Bar: pembukuan ketukan segmen dan tombol F, serta penilaian hasil (fungsi murni).
//
// Bukti:
// - Terukur: ketukan tombol uji (event `touchbar-tap` dari NSButton native) dan tombol
//   F1–F12/Esc yang sampai ke aplikasi (`KeyboardEvent.code`).
// - Dikonfirmasi pengguna: tampilan, kerataan cahaya, area mati, dan respons seluruh lebar.
// Privasi: hanya `KeyboardEvent.code` F1–F12/Escape yang dibaca, tidak pernah `key`/teks.
// Keberadaan Touch Bar berasal dari bukti hardware (IORegistry/TouchBarServer), tidak
// pernah dari nama model.
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, EvidenceLevel, InteractiveResult } from "../../types/interactive";
import type { TouchBarPresence } from "../../types/peripherals";
import { decideCompletedOutcome } from "./outcome.ts";

/** Jumlah tombol uji yang diminta ke native (Rust membatasi 4–8). */
export const TOUCHBAR_SEGMENTS = 8;
/** Tanpa ketukan selama ini: tawarkan "Touch Bar tidak menampilkan tombol uji". */
export const NO_TAP_HINT_MS = 15_000;
/** Jeda sebelum menanyakan `NSTouchBar.isVisible` (bar perlu waktu untuk tampil). */
export const STATUS_CHECK_DELAY_MS = 1_500;
export const FN_KEY_CODES: string[] = Array.from({ length: 12 }, (_, i) => `F${i + 1}`);
export const ESCAPE_CODE = "Escape";

export const TOUCHBAR_LIMITATIONS: UiKey[] = [
  "touchBarLimit.nativeBar",
  "touchBarLimit.appControls",
  "touchBarLimit.fnKeys",
  "touchBarLimit.userJudged",
  "touchBarLimit.grid",
  "touchBarLimit.touchId",
  "touchBarLimit.presence",
  "touchBarLimit.privacy",
];

// ---------------------------------------------------------------------------
// Keberadaan hardware (dari `api.getTouchBarPresence()`, bukan nama model)

export interface PresenceInfo {
  /** `true` ada, `false` tidak ada, `null` tidak diketahui. */
  present: boolean | null;
  /** Bukti belum terverifikasi di hardware asli: hanya informasi. */
  experimental: boolean;
}

/**
 * Ringkas bukti hardware. Bukti eksperimental tidak pernah memblokir tes: "tidak ada"
 * yang eksperimental diperlakukan sebagai tidak diketahui.
 */
export function presenceInfo(presence: TouchBarPresence | null | undefined): PresenceInfo {
  if (!presence) return { present: null, experimental: false };
  const present = presence.presence === "present" ? true : presence.presence === "absent" ? false : null;
  return {
    present: presence.experimental && present === false ? null : present,
    experimental: presence.experimental,
  };
}

// ---------------------------------------------------------------------------
// Bagian 1 — ketukan segmen

export interface SegmentState {
  total: number;
  /** Jumlah ketukan per segmen (indeks 0 = tombol "1"). */
  taps: number[];
}

export function emptySegments(total: number = TOUCHBAR_SEGMENTS): SegmentState {
  const n = Number.isInteger(total) && total > 0 ? total : TOUCHBAR_SEGMENTS;
  return { total: n, taps: Array.from({ length: n }, () => 0) };
}

/** Catat satu ketukan (tanpa mutasi). Indeks di luar rentang diabaikan. */
export function recordTap(state: SegmentState, index: number): SegmentState {
  if (!Number.isInteger(index) || index < 0 || index >= state.total) return state;
  const taps = [...state.taps];
  taps[index] += 1;
  return { ...state, taps };
}

export function tappedCount(state: SegmentState): number {
  return state.taps.filter((n) => n > 0).length;
}

/** Indeks segmen (mulai 0) yang belum pernah tersentuh. */
export function untappedSegments(state: SegmentState): number[] {
  return state.taps.flatMap((n, i) => (n > 0 ? [] : [i]));
}

/** Nomor segmen seperti tercetak di tombol uji (tidak diterjemahkan). */
export function segmentLabel(index: number): string {
  return String(index + 1);
}

// ---------------------------------------------------------------------------
// Bagian 2 — tombol F1–F12 (dan Esc)

export interface FnKeyState {
  /** Jumlah keydown (bukan auto-repeat) per kode F1–F12. */
  counts: Record<string, number>;
  escape: number;
}

export function emptyFnKeys(): FnKeyState {
  return { counts: {}, escape: 0 };
}

export function isTrackedKeyCode(code: string): boolean {
  return code === ESCAPE_CODE || FN_KEY_CODES.includes(code);
}

/** Catat satu keydown berdasarkan `code` (tanpa mutasi). Kode lain diabaikan. */
export function recordKey(state: FnKeyState, code: string): FnKeyState {
  if (code === ESCAPE_CODE) return { ...state, escape: state.escape + 1 };
  if (!FN_KEY_CODES.includes(code)) return state;
  return { ...state, counts: { ...state.counts, [code]: (state.counts[code] ?? 0) + 1 } };
}

export function receivedFnKeys(state: FnKeyState): string[] {
  return FN_KEY_CODES.filter((code) => (state.counts[code] ?? 0) > 0);
}

export function missingFnKeys(state: FnKeyState): string[] {
  return FN_KEY_CODES.filter((code) => (state.counts[code] ?? 0) === 0);
}

/**
 * Pasang listener keydown fase capture di `target` (jendela aplikasi) selama Bagian 2.
 * Hanya F1–F12/Escape yang diproses: aksi bawaannya dicegah dan `onKey(code)` dipanggil
 * (auto-repeat diabaikan). Hanya `code` yang dibaca, tidak pernah `key`. Mengembalikan
 * fungsi untuk melepas listener.
 */
export function attachFnKeyCapture(target: EventTarget, onKey: (code: string) => void): () => void {
  const handler = (event: Event) => {
    const code = (event as Event & { code?: unknown }).code;
    if (typeof code !== "string" || !isTrackedKeyCode(code)) return;
    event.preventDefault();
    if ((event as Event & { repeat?: unknown }).repeat === true) return;
    onKey(code);
  };
  target.addEventListener("keydown", handler, { capture: true });
  return () => target.removeEventListener("keydown", handler, { capture: true });
}

// ---------------------------------------------------------------------------
// Bagian 3 — tampilan & cahaya (dikonfirmasi pengguna)

export type TouchBarCheck = "evenLit" | "noDeadArea" | "fullWidth";
export type CheckAnswer = "ok" | "problem" | "notChecked";

export interface CheckDef {
  id: TouchBarCheck;
  question: UiKey;
  okResult: UiKey;
  problemResult: UiKey;
  /**
   * Level laporan masalah bila tampilan Touch Bar sudah terkonfirmasi. Area mati dan
   * area yang tidak merespons = kritis; cahaya tidak merata = peringatan.
   */
  problemLevel: "critical" | "warning";
}

export const TOUCHBAR_CHECKS: CheckDef[] = [
  {
    id: "evenLit",
    question: "touchBarCheck.evenLit",
    okResult: "touchBarResult.evenLitOk",
    problemResult: "touchBarResult.evenLitProblem",
    problemLevel: "warning",
  },
  {
    id: "noDeadArea",
    question: "touchBarCheck.noDeadArea",
    okResult: "touchBarResult.noDeadAreaOk",
    problemResult: "touchBarResult.deadAreaProblem",
    problemLevel: "critical",
  },
  {
    id: "fullWidth",
    question: "touchBarCheck.fullWidth",
    okResult: "touchBarResult.fullWidthOk",
    problemResult: "touchBarResult.fullWidthProblem",
    problemLevel: "critical",
  },
];

export const CHECK_ANSWERS: { value: CheckAnswer; label: UiKey }[] = [
  { value: "ok", label: "touchBarCheck.answer.ok" },
  { value: "problem", label: "touchBarCheck.answer.problem" },
  { value: "notChecked", label: "touchBarCheck.answer.notChecked" },
];

export type CheckAnswers = Record<TouchBarCheck, CheckAnswer | null>;

export function emptyChecks(): CheckAnswers {
  return { evenLit: null, noDeadArea: null, fullWidth: null };
}

export function allChecksAnswered(checks: CheckAnswers): boolean {
  return TOUCHBAR_CHECKS.every((c) => checks[c.id] !== null);
}

// ---------------------------------------------------------------------------
// Penilaian

export interface TouchBarAnswer {
  /** Bukti hardware (lihat `presenceInfo`). */
  presence: PresenceInfo;
  /** Tombol uji berhasil dipasang lewat API native. */
  nativeStarted: boolean;
  segments: SegmentState;
  /** Pengguna: Touch Bar tidak menampilkan tombol uji (keterbatasan API, bukan kerusakan). */
  barNotShown: boolean;
  /** Pengguna: tombol uji tampil, tetapi segmen yang belum hijau tidak merespons. */
  reportUntappedAsBroken: boolean;
  /** `NSTouchBar.isVisible` menurut macOS (eksperimental, informasi saja). */
  macosVisible: boolean | null;
  fnKeys: FnKeyState;
  checks: CheckAnswers;
  durationMs: number;
  finishedAt: string;
}

/** Mac tanpa Touch Bar (bukti hardware): Tidak tersedia, tanpa memasang apa pun. */
export function noTouchBarResult(finishedAt?: string): InteractiveResult {
  return {
    id: "touchBar",
    outcome: "unavailable",
    summaryCode: "touchBarResult.noTouchBar",
    evidence: [{ kind: "measured", level: "info", code: "touchBarResult.presenceAbsent" }],
    limitations: TOUCHBAR_LIMITATIONS,
    finishedAt,
  };
}

export interface TouchBarProgress {
  tapped: number;
  total: number;
  fnReceived: number;
}

/** Hasil "Dibatalkan" saat pengguna keluar sebelum menyimpan. */
export function cancelledTouchBar(progress: TouchBarProgress): InteractiveResult {
  return {
    id: "touchBar",
    outcome: "cancelled",
    summaryCode: "touchBarResult.cancelled",
    summaryParams: {
      tapped: progress.tapped,
      total: progress.total,
      received: progress.fnReceived,
      fnTotal: FN_KEY_CODES.length,
    },
    evidence: [],
    limitations: TOUCHBAR_LIMITATIONS,
  };
}

export function assessTouchBar(answer: TouchBarAnswer): InteractiveResult {
  if (answer.presence.present === false && !answer.presence.experimental) {
    return noTouchBarResult(answer.finishedAt);
  }
  const evidence: Evidence[] = [];

  evidence.push({
    kind: "measured",
    level: "info",
    code: answer.presence.present === true ? "touchBarResult.presenceDetected" : "touchBarResult.presenceUnknown",
    ...(answer.presence.present === true && answer.presence.experimental ? { experimental: true } : {}),
  });

  // Bagian 1: area sentuh.
  const { segments } = answer;
  const tapped = tappedCount(segments);
  const untapped = untappedSegments(segments);
  /**
   * Tombol uji terbukti terlihat: ada ketukan yang diterima, atau pengguna menyatakan
   * tombol uji tampil tetapi sebagian segmen tidak merespons.
   */
  const testBarSeen =
    answer.nativeStarted && (tapped > 0 || (answer.reportUntappedAsBroken && !answer.barNotShown));
  if (!answer.nativeStarted && tapped === 0) {
    evidence.push({ kind: "measured", level: "info", code: "touchBarResult.nativeUnavailable" });
  } else if (tapped === 0 && answer.barNotShown) {
    evidence.push({ kind: "measured", level: "info", code: "touchBarResult.barNotShown" });
  } else {
    evidence.push({
      kind: "measured",
      level: untapped.length === 0 ? "ok" : "info",
      code: "touchBarResult.segmentsTapped",
      params: { tapped, total: segments.total },
    });
    if (untapped.length > 0 && answer.reportUntappedAsBroken && testBarSeen) {
      evidence.push({
        kind: "userConfirmed",
        level: "critical",
        code: "touchBarResult.segmentsNoResponse",
        params: { segments: untapped.map(segmentLabel) },
      });
    }
  }
  if (answer.nativeStarted && answer.macosVisible !== null) {
    evidence.push({
      kind: "measured",
      level: "info",
      experimental: true,
      code: answer.macosVisible ? "touchBarResult.macosVisible" : "touchBarResult.macosHidden",
    });
  }

  // Bagian 2: tombol F.
  const received = receivedFnKeys(answer.fnKeys);
  const missing = missingFnKeys(answer.fnKeys);
  evidence.push({
    kind: "measured",
    level: received.length > 0 ? "ok" : "info",
    code: "touchBarResult.fnReceived",
    params: { received: received.length, total: FN_KEY_CODES.length },
  });
  if (received.length > 0 && missing.length > 0) {
    evidence.push({ kind: "measured", level: "info", code: "touchBarResult.fnMissing", params: { keys: missing } });
  }
  if (answer.fnKeys.escape > 0) {
    evidence.push({ kind: "measured", level: "info", code: "touchBarResult.escReceived" });
  }

  // Bagian 3: tampilan. Laporan masalah hanya kritis bila tampilan Touch Bar sudah
  // terkonfirmasi (tombol uji terlihat atau ada tombol F yang diterima).
  const displaySeen = testBarSeen || received.length > 0;
  let downgraded = false;
  for (const check of TOUCHBAR_CHECKS) {
    const value = answer.checks[check.id];
    if (value === "ok") {
      evidence.push({ kind: "userConfirmed", level: "ok", code: check.okResult });
    } else if (value === "problem") {
      const level: EvidenceLevel = displaySeen ? check.problemLevel : "warning";
      if (level !== check.problemLevel) downgraded = true;
      evidence.push({ kind: "userConfirmed", level, code: check.problemResult });
    }
  }
  if (downgraded) {
    evidence.push({ kind: "userConfirmed", level: "info", code: "touchBarResult.problemUnconfirmed" });
  }

  // Tanpa bukti positif apa pun, hasil tidak pernah "Lulus".
  const completed = decideCompletedOutcome(evidence);
  const hasPositive = evidence.some((e) => e.level === "ok" && !e.experimental);
  const outcome = completed === "failed" ? "failed" : hasPositive ? "passed" : "unavailable";
  const criticalCount = evidence.filter((e) => e.level === "critical" && !e.experimental).length;
  return {
    id: "touchBar",
    outcome,
    summaryCode:
      outcome === "passed"
        ? "touchBarResult.passed"
        : outcome === "failed"
          ? "touchBarResult.failed"
          : "touchBarResult.noEvidence",
    summaryParams: outcome === "failed" ? { n: criticalCount } : undefined,
    evidence,
    limitations: TOUCHBAR_LIMITATIONS,
    finishedAt: answer.finishedAt,
    durationMs: answer.durationMs,
  };
}
