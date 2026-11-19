// Tes Keyboard (T2): tata letak, pelacak tombol, dan penilaian (fungsi murni).
//
// Privasi: hanya `KeyboardEvent.code` (posisi fisik tombol) dan jumlah tekanan
// yang dicatat — tidak pernah karakter/teks yang diketik. Listener hanya
// terpasang di jendela aplikasi selama tes terbuka (bukan keylogger global).
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import { decideCompletedOutcome } from "./outcome.ts";

/** Jeda keyup → keydown tombol yang sama di bawah ini dicurigai ketikan ganda. */
export const CHATTER_WINDOW_MS = 40;
/** Lama menahan Esc untuk keluar dari tes. */
export const EXIT_HOLD_MS = 1500;

export type KeyboardLayoutId = "ansi" | "iso";
export type FunctionRow = "physical" | "touchBar";

export interface KeyDef {
  code: string;
  /** Legenda tombol (seperti tercetak di keyboard Mac; tidak diterjemahkan). */
  label: string;
  /** Legenda yang perlu diterjemahkan (mis. spasi). */
  labelKey?: UiKey;
  /** Lebar dalam satuan tombol (1 = tombol huruf). */
  width?: number;
  /** Tidak bisa diuji lewat aplikasi (event tidak sampai ke WebView): alasannya. */
  untestable?: UiKey;
}

const k = (code: string, label: string, width?: number): KeyDef => ({ code, label, width });
const letters = (s: string) => [...s].map((c) => k(`Key${c}`, c));

const DIGITS: KeyDef[] = [..."1234567890"].map((d) => k(`Digit${d}`, d));

const FN_PHYSICAL: KeyDef[] = [
  k("Escape", "esc", 1.5),
  ...Array.from({ length: 12 }, (_, i) => k(`F${i + 1}`, `F${i + 1}`)),
  { code: "TouchID", label: "Touch ID", untestable: "key.untestable.touchId" },
];

const FN_TOUCH_BAR: KeyDef[] = [k("Escape", "esc", 1.5)];

const BOTTOM: KeyDef[] = [
  { code: "Fn", label: "fn", untestable: "key.untestable.fn" },
  k("ControlLeft", "control"),
  k("AltLeft", "option"),
  k("MetaLeft", "command", 1.25),
  { code: "Space", label: "space", labelKey: "key.space", width: 5 },
  k("MetaRight", "command", 1.25),
  k("AltRight", "option"),
];

export const ARROWS: KeyDef[] = [k("ArrowLeft", "←"), k("ArrowUp", "↑"), k("ArrowDown", "↓"), k("ArrowRight", "→")];

const ANSI_ROWS: KeyDef[][] = [
  [k("Backquote", "`"), ...DIGITS, k("Minus", "-"), k("Equal", "="), k("Backspace", "delete", 1.5)],
  [k("Tab", "tab", 1.5), ...letters("QWERTYUIOP"), k("BracketLeft", "["), k("BracketRight", "]"), k("Backslash", "\\")],
  [k("CapsLock", "caps lock", 1.75), ...letters("ASDFGHJKL"), k("Semicolon", ";"), k("Quote", "'"), k("Enter", "return", 1.75)],
  [k("ShiftLeft", "shift", 2.25), ...letters("ZXCVBNM"), k("Comma", ","), k("Period", "."), k("Slash", "/"), k("ShiftRight", "shift", 2.25)],
];

// ISO Mac: tombol §/± di kiri angka 1 = IntlBackslash; tombol `/~ di samping
// shift kiri = Backquote; return tinggi; \ pindah ke baris tengah.
const ISO_ROWS: KeyDef[][] = [
  [k("IntlBackslash", "§"), ...DIGITS, k("Minus", "-"), k("Equal", "="), k("Backspace", "delete", 1.5)],
  [k("Tab", "tab", 1.5), ...letters("QWERTYUIOP"), k("BracketLeft", "["), k("BracketRight", "]"), k("Enter", "return")],
  [k("CapsLock", "caps lock", 1.75), ...letters("ASDFGHJKL"), k("Semicolon", ";"), k("Quote", "'"), k("Backslash", "\\", 1.75)],
  [k("ShiftLeft", "shift", 1.25), k("Backquote", "`"), ...letters("ZXCVBNM"), k("Comma", ","), k("Period", "."), k("Slash", "/"), k("ShiftRight", "shift", 2.25)],
];

export interface KeyboardLayout {
  id: KeyboardLayoutId;
  functionRow: FunctionRow;
  rows: KeyDef[][];
  bottom: KeyDef[];
  arrows: KeyDef[];
}

export function buildLayout(id: KeyboardLayoutId, functionRow: FunctionRow): KeyboardLayout {
  const fn = functionRow === "physical" ? FN_PHYSICAL : FN_TOUCH_BAR;
  return { id, functionRow, rows: [fn, ...(id === "ansi" ? ANSI_ROWS : ISO_ROWS)], bottom: BOTTOM, arrows: ARROWS };
}

export function allKeys(layout: KeyboardLayout): KeyDef[] {
  return [...layout.rows.flat(), ...layout.bottom, ...layout.arrows];
}

export function testableCodes(layout: KeyboardLayout): string[] {
  return allKeys(layout)
    .filter((key) => !key.untestable)
    .map((key) => key.code);
}

// ---------------------------------------------------------------------------
// Pelacak tombol

export interface KeyStat {
  downs: number;
  ups: number;
  /** Jumlah keydown yang terjadi < CHATTER_WINDOW_MS setelah keyup tombol yang sama. */
  chatter: number;
  /** Tombol sudah tertekan (event `repeat`) saat tes dimulai. */
  heldAtStart: boolean;
  lastUpAt?: number;
  down: boolean;
}

export interface KeyTrackerState {
  keys: Record<string, KeyStat>;
}

export interface KeyEventLike {
  type: string;
  code: string;
  repeat?: boolean;
  timeStamp: number;
}

export function emptyTrackerState(): KeyTrackerState {
  return { keys: {} };
}

/** Memperbarui state dari satu event keydown/keyup (tanpa mutasi). */
export function applyKeyEvent(state: KeyTrackerState, ev: KeyEventLike): KeyTrackerState {
  if (!ev.code || (ev.type !== "keydown" && ev.type !== "keyup")) return state;
  const prev: KeyStat = state.keys[ev.code] ?? { downs: 0, ups: 0, chatter: 0, heldAtStart: false, down: false };
  const next: KeyStat = { ...prev };
  if (ev.type === "keydown") {
    if (ev.repeat) {
      // Auto-repeat dari tombol yang ditahan; tombol yang sudah tertahan sejak
      // sebelum tes tidak pernah punya keydown awal.
      if (prev.downs === 0) {
        next.heldAtStart = true;
        next.downs = 1;
      }
      next.down = true;
    } else {
      if (prev.lastUpAt !== undefined && ev.timeStamp - prev.lastUpAt < CHATTER_WINDOW_MS) {
        next.chatter += 1;
      }
      next.downs += 1;
      next.down = true;
    }
  } else {
    next.ups += 1;
    next.down = false;
    next.lastUpAt = ev.timeStamp;
    // Caps Lock di WebKit: keyup saat dimatikan tanpa keydown sebelumnya.
    if (next.downs === 0) next.downs = 1;
  }
  return { keys: { ...state.keys, [ev.code]: next } };
}

export function pressedCodes(state: KeyTrackerState): Set<string> {
  return new Set(Object.entries(state.keys).filter(([, s]) => s.downs > 0).map(([code]) => code));
}

/**
 * Memasang listener di target (window) selama tes. `onChange` menerima state
 * baru. Mengembalikan fungsi untuk melepas SEMUA listener.
 */
export function attachKeyTracker(
  target: EventTarget,
  onChange: (state: KeyTrackerState, ev: KeyEventLike) => void,
  initial: KeyTrackerState = emptyTrackerState(),
): () => void {
  let state = initial;
  const handler = (event: Event) => {
    const e = event as Event & Partial<KeyEventLike>;
    if (typeof e.code !== "string") return;
    // Cegah aksi bawaan WebView (Tab pindah fokus, spasi menggulir, dll.).
    event.preventDefault();
    const ev: KeyEventLike = { type: event.type, code: e.code, repeat: Boolean(e.repeat), timeStamp: event.timeStamp };
    state = applyKeyEvent(state, ev);
    onChange(state, ev);
  };
  target.addEventListener("keydown", handler);
  target.addEventListener("keyup", handler);
  return () => {
    target.removeEventListener("keydown", handler);
    target.removeEventListener("keyup", handler);
  };
}

// ---------------------------------------------------------------------------
// Penilaian

export const KEYBOARD_LIMITATIONS: UiKey[] = [
  "keyboardLimit.untestable",
  "keyboardLimit.systemShortcuts",
  "keyboardLimit.fnKeys",
  "keyboardLimit.touchBar",
  "keyboardLimit.chatter",
  "keyboardLimit.privacy",
];

/**
 * Jawaban pengguna soal lampu latar keyboard (aplikasi tidak bisa mengukurnya):
 * - ok           : menyala merata
 * - faulty       : tetap mati/tidak merata walau kecerahan sudah dinaikkan di ruangan redup
 * - offUnchecked : terlihat mati, tetapi pengaturan kecerahan belum dicek
 * - notChecked   : tidak dicek / Mac tanpa lampu latar
 */
export type Backlight = "ok" | "faulty" | "offUnchecked" | "notChecked";

/** Petunjuk cek pengaturan sebelum menyimpulkan lampu latar rusak (dilakukan pengguna sendiri). */
export const BACKLIGHT_CHECKS: UiKey[] = [
  "backlightCheck.brightness",
  "backlightCheck.darkRoom",
  "backlightCheck.settings",
];

export interface KeyboardAnswer {
  layout: KeyboardLayout;
  state: KeyTrackerState;
  /** Tombol yang belum hijau dinyatakan pengguna sudah ditekan tetapi tidak merespons. */
  reportUntestedAsBroken: boolean;
  backlight: Backlight;
  durationMs: number;
  finishedAt: string;
}

export function remainingCodes(layout: KeyboardLayout, state: KeyTrackerState): string[] {
  const pressed = pressedCodes(state);
  return testableCodes(layout).filter((code) => !pressed.has(code));
}

/** Tes boleh diselesaikan bila semua tombol teruji, atau sisanya dilaporkan rusak. */
export function canFinish(layout: KeyboardLayout, state: KeyTrackerState, reportUntestedAsBroken: boolean): boolean {
  return remainingCodes(layout, state).length === 0 || reportUntestedAsBroken;
}

/** Legenda tombol sebagai parameter: kunci terjemahan diawali "@". */
export function keyParam(key: KeyDef): string {
  return key.labelKey ? `@${key.labelKey}` : key.label;
}

function labelOf(layout: KeyboardLayout, code: string): string {
  const key = allKeys(layout).find((k) => k.code === code);
  return key ? keyParam(key) : code;
}

export function assessKeyboard(answer: KeyboardAnswer): InteractiveResult {
  const { layout, state } = answer;
  const testable = testableCodes(layout);
  const remaining = remainingCodes(layout, state);
  const tested = testable.length - remaining.length;
  const evidence: Evidence[] = [];

  evidence.push({
    kind: "measured",
    level: remaining.length === 0 ? "ok" : "info",
    code: "keyboardResult.tested",
    params: { tested, total: testable.length },
  });
  if (remaining.length > 0 && answer.reportUntestedAsBroken) {
    evidence.push({
      kind: "userConfirmed",
      level: "critical",
      code: "keyboardResult.notResponding",
      params: { keys: remaining.map((c) => labelOf(layout, c)) },
    });
  }

  const known = new Set(allKeys(layout).map((key) => key.code));
  const extra = Object.keys(state.keys).filter((code) => !known.has(code));
  if (extra.length > 0) {
    evidence.push({ kind: "measured", level: "info", code: "keyboardResult.extraKeys", params: { keys: extra } });
  }

  // Tombol yang dianggap tidak bisa diuji: catat apakah ternyata mengirim sinyal,
  // supaya perilaku WebView/macOS terdokumentasi. Tidak pernah mengubah hasil.
  const untestable = allKeys(layout).filter((key) => key.untestable);
  const sent = untestable.filter((key) => (state.keys[key.code]?.downs ?? 0) > 0);
  const silent = untestable.filter((key) => (state.keys[key.code]?.downs ?? 0) === 0);
  if (sent.length > 0) {
    evidence.push({
      kind: "measured",
      level: "info",
      code: "keyboardResult.untestableSent",
      params: { keys: sent.map(keyParam) },
    });
  }
  if (silent.length > 0) {
    evidence.push({
      kind: "measured",
      level: "info",
      code: "keyboardResult.untestableSilent",
      params: { keys: silent.map(keyParam) },
    });
  }

  const chatter = Object.entries(state.keys).filter(([, s]) => s.chatter > 0);
  if (chatter.length > 0) {
    evidence.push({
      kind: "measured",
      level: "warning",
      experimental: true,
      code: "keyboardResult.chatter",
      params: { keys: chatter.map(([c, s]) => `${labelOf(layout, c).replace(/^@/, "")} (${s.chatter}×)`) },
    });
  }
  const held = Object.entries(state.keys).filter(([, s]) => s.heldAtStart);
  if (held.length > 0) {
    evidence.push({
      kind: "measured",
      level: "warning",
      code: "keyboardResult.heldAtStart",
      params: { keys: held.map(([c]) => labelOf(layout, c)) },
    });
  }

  if (answer.backlight === "ok") {
    evidence.push({ kind: "userConfirmed", level: "ok", code: "keyboardResult.backlightOk" });
  } else if (answer.backlight === "faulty") {
    evidence.push({ kind: "userConfirmed", level: "warning", code: "keyboardResult.backlightFaulty" });
  } else if (answer.backlight === "offUnchecked") {
    evidence.push({ kind: "userConfirmed", level: "info", code: "keyboardResult.backlightOffUnchecked" });
  }

  const outcome = remaining.length > 0 && !answer.reportUntestedAsBroken ? "cancelled" : decideCompletedOutcome(evidence);
  const summaryCode: UiKey =
    outcome === "passed"
      ? "keyboardResult.passed"
      : outcome === "failed"
        ? "keyboardResult.failed"
        : "keyboardResult.cancelled";
  return {
    id: "keyboard",
    outcome,
    summaryCode,
    summaryParams: outcome === "passed" ? { total: testable.length } : { n: remaining.length },
    evidence,
    limitations: KEYBOARD_LIMITATIONS,
    finishedAt: answer.finishedAt,
    durationMs: answer.durationMs,
  };
}
