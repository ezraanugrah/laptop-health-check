// Tes Trackpad (T4): kisi cakupan, pelacak fungsi, listener, dan penilaian (fungsi murni).
//
// Privasi: yang disimpan hanya sel kisi yang pernah dilewati kursor dan fungsi
// yang sudah terdeteksi — tidak ada riwayat koordinat. Listener hanya dipasang
// di area uji (bukan window/global) dan dilepas saat tes ditutup.
//
// Prinsip penilaian: event yang tidak dikirim WebView (cubit, Force Click) atau
// yang ditangani macOS (gestur 3/4 jari) TIDAK PERNAH dianggap kerusakan
// hardware. Kegagalan hanya berasal dari fungsi wajib yang sudah dicoba pengguna
// tetapi tidak terdeteksi, atau masalah fisik yang dilaporkan pengguna.
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import { decideCompletedOutcome } from "./outcome.ts";

/** Kisi cakupan gerak kursor di area uji. */
export const GRID_COLS = 6;
export const GRID_ROWS = 4;
export const GRID_CELLS = GRID_COLS * GRID_ROWS;
/** Minimal sel kisi yang dilewati kursor agar gerak kursor dianggap terukur (≈80%). */
export const COVERAGE_MIN_CELLS = 20;
/** |delta| roda minimum (piksel) agar dihitung sebagai gulir pada sumbu itu. */
export const WHEEL_MIN_DELTA = 1;
/** Perubahan skala minimum `gesturechange` agar dihitung sebagai cubit. */
export const PINCH_MIN_SCALE_DELTA = 0.05;
/** `webkitForce` saat Force Click (MouseEvent.WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN). */
export const FORCE_CLICK_LEVEL = 2;
/** Jumlah slot jalur seret; zona lepas = slot terakhir. */
export const DRAG_SLOTS = 6;

export type RequiredItem =
  | "move"
  | "primaryClick"
  | "secondaryClick"
  | "doubleClick"
  | "scrollVertical"
  | "scrollHorizontal"
  | "drag";
export type OptionalItem = "pinch" | "forceClick";
export type TrackpadItem = RequiredItem | OptionalItem;

/** Fungsi wajib: harus terdeteksi (atau dinyatakan "sudah dicoba") sebelum tes selesai. */
export const REQUIRED_ITEMS: RequiredItem[] = [
  "move",
  "primaryClick",
  "secondaryClick",
  "doubleClick",
  "scrollVertical",
  "scrollHorizontal",
  "drag",
];
/** Fungsi opsional: bergantung pada event WebKit; tidak terdeteksi ≠ gagal. */
export const OPTIONAL_ITEMS: OptionalItem[] = ["pinch", "forceClick"];

export const TRACKPAD_ITEMS: Record<TrackpadItem, { name: UiKey; hint: UiKey }> = {
  move: { name: "trackpad.item.move", hint: "trackpad.hint.move" },
  primaryClick: { name: "trackpad.item.primaryClick", hint: "trackpad.hint.primaryClick" },
  secondaryClick: { name: "trackpad.item.secondaryClick", hint: "trackpad.hint.secondaryClick" },
  doubleClick: { name: "trackpad.item.doubleClick", hint: "trackpad.hint.doubleClick" },
  scrollVertical: { name: "trackpad.item.scrollVertical", hint: "trackpad.hint.scrollVertical" },
  scrollHorizontal: { name: "trackpad.item.scrollHorizontal", hint: "trackpad.hint.scrollHorizontal" },
  drag: { name: "trackpad.item.drag", hint: "trackpad.hint.drag" },
  pinch: { name: "trackpad.item.pinch", hint: "trackpad.hint.pinch" },
  forceClick: { name: "trackpad.item.forceClick", hint: "trackpad.hint.forceClick" },
};

/** Label rasa klik/permukaan (konfirmasi pengguna) untuk ringkasan hasil gagal. */
export const CLICK_FEEL_LABEL: UiKey = "trackpad.item.clickFeel";

/** Nama fungsi sebagai parameter terjemahan (kunci berawalan "@"). */
export function itemParam(item: TrackpadItem): string {
  return `@${TRACKPAD_ITEMS[item].name}`;
}

// ---------------------------------------------------------------------------
// Geometri (posisi relatif terhadap area, bukan riwayat)

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Ember 0..count-1 untuk `value` di rentang [0, size]; null bila di luar rentang. */
export function bucket(value: number, size: number, count: number): number | null {
  if (!(size > 0) || !(count >= 1) || !Number.isFinite(value) || value < 0 || value > size) return null;
  return Math.min(count - 1, Math.floor((value / size) * count));
}

/** Seperti `bucket`, tetapi posisi di luar rentang dijepit ke ember tepi. */
export function clampBucket(value: number, size: number, count: number): number {
  if (!(size > 0) || !(count >= 1) || Number.isNaN(value)) return 0;
  return bucket(Math.min(size, Math.max(0, value)), size, count) ?? 0;
}

/** Indeks sel kisi (baris-mayor) di bawah kursor, atau null bila di luar area. */
export function cellAt(clientX: number, clientY: number, rect: RectLike): number | null {
  const col = bucket(clientX - rect.left, rect.width, GRID_COLS);
  const row = bucket(clientY - rect.top, rect.height, GRID_ROWS);
  return col === null || row === null ? null : row * GRID_COLS + col;
}

/** Slot jalur seret di bawah pointer (dijepit: pointer ditangkap bisa keluar jalur). */
export function dragSlot(clientX: number, rect: RectLike): number {
  return clampBucket(clientX - rect.left, rect.width, DRAG_SLOTS);
}

/** Seret dan lepas sah: dilepas di zona lepas setelah dimulai dari slot lain. */
export function isDrop(startSlot: number, endSlot: number): boolean {
  return endSlot === DRAG_SLOTS - 1 && startSlot !== endSlot;
}

export function isForceClick(force: number): boolean {
  return force >= FORCE_CLICK_LEVEL;
}

// ---------------------------------------------------------------------------
// Dukungan event WebKit

export interface WebkitSupport {
  /** `GestureEvent` (gesturestart/change/end) tersedia. */
  gestureEvents: boolean;
  /** Event `webkitmouseforce*` tersedia. */
  forceEvents: boolean;
}

export interface SupportScope {
  GestureEvent?: unknown;
  MouseEvent?: unknown;
  document?: unknown;
}

/** Deteksi fitur (bukan tebakan model): dipanggil dengan `window`. */
export function detectWebkitSupport(scope: SupportScope): WebkitSupport {
  const mouse = scope.MouseEvent as { WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN?: unknown } | undefined;
  const doc = scope.document;
  return {
    gestureEvents: typeof scope.GestureEvent === "function",
    forceEvents:
      typeof mouse?.WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN === "number" ||
      (typeof doc === "object" && doc !== null && "onwebkitmouseforcedown" in doc),
  };
}

// ---------------------------------------------------------------------------
// Pelacak fungsi

export type PinchSource = "gesture" | "ctrlWheel";

export const PINCH_SOURCE_LABEL: Record<PinchSource, UiKey> = {
  gesture: "trackpad.source.gesture",
  ctrlWheel: "trackpad.source.ctrlWheel",
};

export interface TrackpadState {
  /** Sel kisi yang pernah dilewati kursor (panjang GRID_CELLS). */
  visited: boolean[];
  detected: Record<Exclude<TrackpadItem, "move">, boolean>;
  /** Sumber event cubit yang pertama terlihat. */
  pinchSource: PinchSource | null;
  /** Fungsi opsional yang sudah dicoba pengguna tetapi tidak terdeteksi WebView. */
  notDetected: Record<OptionalItem, boolean>;
}

export type TrackpadInput =
  | { type: "move"; cell: number }
  | { type: "click"; button: number; ctrlKey: boolean }
  | { type: "doubleClick"; button: number }
  | { type: "contextMenu"; ctrlKey: boolean }
  | { type: "wheel"; deltaX: number; deltaY: number; ctrlKey: boolean }
  | { type: "pinch"; scale: number }
  | { type: "force"; force: number }
  | { type: "drop" }
  | { type: "markNotDetected"; item: OptionalItem };

export function emptyTrackpadState(): TrackpadState {
  return {
    visited: Array.from({ length: GRID_CELLS }, () => false),
    detected: {
      primaryClick: false,
      secondaryClick: false,
      doubleClick: false,
      scrollVertical: false,
      scrollHorizontal: false,
      drag: false,
      pinch: false,
      forceClick: false,
    },
    pinchSource: null,
    notDetected: { pinch: false, forceClick: false },
  };
}

function mark(state: TrackpadState, item: Exclude<TrackpadItem, "move">): TrackpadState {
  if (state.detected[item]) return state;
  return { ...state, detected: { ...state.detected, [item]: true } };
}

function markPinch(state: TrackpadState, source: PinchSource): TrackpadState {
  if (state.detected.pinch) return state;
  return { ...mark(state, "pinch"), pinchSource: source };
}

/**
 * Memperbarui state dari satu input (tanpa mutasi). Mengembalikan objek yang
 * sama bila tidak ada perubahan, agar React tidak me-render ulang.
 */
export function applyTrackpadInput(state: TrackpadState, input: TrackpadInput): TrackpadState {
  switch (input.type) {
    case "move": {
      const { cell } = input;
      if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_CELLS || state.visited[cell]) return state;
      const visited = [...state.visited];
      visited[cell] = true;
      return { ...state, visited };
    }
    case "click":
      // Control+klik adalah klik sekunder versi keyboard, bukan klik primer trackpad.
      return input.button === 0 && !input.ctrlKey ? mark(state, "primaryClick") : state;
    case "doubleClick":
      return input.button === 0 ? mark(state, "doubleClick") : state;
    case "contextMenu":
      // Control+klik tidak menguji klik sekunder trackpad (dua jari/pojok).
      return input.ctrlKey ? state : mark(state, "secondaryClick");
    case "wheel": {
      // Roda + Control = cubit (disintesis browser non-WebKit), bukan gulir.
      if (input.ctrlKey) return Math.abs(input.deltaY) >= WHEEL_MIN_DELTA ? markPinch(state, "ctrlWheel") : state;
      const ax = Math.abs(input.deltaX);
      const ay = Math.abs(input.deltaY);
      let next = state;
      if (ay >= WHEEL_MIN_DELTA && ay >= ax) next = mark(next, "scrollVertical");
      if (ax >= WHEEL_MIN_DELTA && ax > ay) next = mark(next, "scrollHorizontal");
      return next;
    }
    case "pinch":
      return Math.abs(input.scale - 1) >= PINCH_MIN_SCALE_DELTA ? markPinch(state, "gesture") : state;
    case "force":
      return isForceClick(input.force) ? mark(state, "forceClick") : state;
    case "drop":
      return mark(state, "drag");
    case "markNotDetected":
      if (state.detected[input.item] || state.notDetected[input.item]) return state;
      return { ...state, notDetected: { ...state.notDetected, [input.item]: true } };
  }
}

export function coveredCells(state: TrackpadState): number {
  return state.visited.filter(Boolean).length;
}

export function isDetected(state: TrackpadState, item: TrackpadItem): boolean {
  return item === "move" ? coveredCells(state) >= COVERAGE_MIN_CELLS : state.detected[item];
}

export function missingRequired(state: TrackpadState): RequiredItem[] {
  return REQUIRED_ITEMS.filter((item) => !isDetected(state, item));
}

export function requiredDone(state: TrackpadState): number {
  return REQUIRED_ITEMS.length - missingRequired(state).length;
}

/** Tes boleh diselesaikan bila semua fungsi wajib terdeteksi, atau sisanya dinyatakan "sudah dicoba". */
export function canFinishTrackpad(state: TrackpadState, reportMissing: boolean): boolean {
  return missingRequired(state).length === 0 || reportMissing;
}

/**
 * Indikator per fungsi:
 * - waiting     : Menunggu
 * - detected    : Terdeteksi
 * - unsupported : Tidak didukung WebView (deteksi fitur: event tidak ada)
 * - notDetected : Tidak terdeteksi oleh WebView (dicoba pengguna, event tidak datang)
 */
export type ItemStatus = "waiting" | "detected" | "unsupported" | "notDetected";

export const STATUS_LABEL: Record<ItemStatus, UiKey> = {
  waiting: "trackpad.status.waiting",
  detected: "trackpad.status.detected",
  unsupported: "trackpad.status.unsupported",
  notDetected: "trackpad.status.notDetected",
};

export function itemStatus(state: TrackpadState, item: TrackpadItem, support: WebkitSupport): ItemStatus {
  if (isDetected(state, item)) return "detected";
  // Cubit tidak pernah "tidak didukung" di awal: browser non-WebKit memakai roda + Control.
  if (item === "forceClick" && !support.forceEvents) return "unsupported";
  if ((item === "pinch" || item === "forceClick") && state.notDetected[item]) return "notDetected";
  return "waiting";
}

// ---------------------------------------------------------------------------
// Listener (hanya di elemen area uji)

/**
 * Memasang listener di `target` (elemen area uji). `preventDefault` hanya untuk
 * event di dalam area itu: menu konteks, gulir halaman, zoom halaman, dan aksi
 * Force Touch bawaan (mis. Look Up). Sel kisi terakhir disimpan hanya untuk
 * menghindari dispatch berulang — bukan riwayat. Mengembalikan fungsi pelepas.
 */
export function attachTrackpadListeners(
  target: EventTarget,
  getRect: () => RectLike,
  dispatch: (input: TrackpadInput) => void,
): () => void {
  let lastCell: number | null = null;
  const num = (e: Event, key: string, fallback = 0): number => {
    const value = (e as unknown as Record<string, unknown>)[key];
    return typeof value === "number" ? value : fallback;
  };
  const flag = (e: Event, key: string): boolean => (e as unknown as Record<string, unknown>)[key] === true;

  const handlers: Record<string, (e: Event) => void> = {
    pointermove: (e) => {
      const cell = cellAt(num(e, "clientX", Number.NaN), num(e, "clientY", Number.NaN), getRect());
      if (cell !== null && cell !== lastCell) {
        lastCell = cell;
        dispatch({ type: "move", cell });
      }
    },
    click: (e) => dispatch({ type: "click", button: num(e, "button"), ctrlKey: flag(e, "ctrlKey") }),
    dblclick: (e) => dispatch({ type: "doubleClick", button: num(e, "button") }),
    contextmenu: (e) => {
      e.preventDefault();
      dispatch({ type: "contextMenu", ctrlKey: flag(e, "ctrlKey") });
    },
    wheel: (e) => {
      e.preventDefault();
      dispatch({ type: "wheel", deltaX: num(e, "deltaX"), deltaY: num(e, "deltaY"), ctrlKey: flag(e, "ctrlKey") });
    },
    gesturestart: (e) => e.preventDefault(),
    gesturechange: (e) => {
      e.preventDefault();
      dispatch({ type: "pinch", scale: num(e, "scale", 1) });
    },
    gestureend: (e) => e.preventDefault(),
    webkitmouseforcewillbegin: (e) => e.preventDefault(),
    webkitmouseforcedown: (e) => dispatch({ type: "force", force: Math.max(num(e, "webkitForce"), FORCE_CLICK_LEVEL) }),
    webkitmouseforcechanged: (e) => {
      const force = num(e, "webkitForce");
      if (isForceClick(force)) dispatch({ type: "force", force });
    },
  };

  // Non-pasif agar preventDefault pada `wheel`/gesture berlaku.
  const options: AddEventListenerOptions = { passive: false };
  for (const [type, handler] of Object.entries(handlers)) target.addEventListener(type, handler, options);
  return () => {
    for (const [type, handler] of Object.entries(handlers)) target.removeEventListener(type, handler, options);
  };
}

// ---------------------------------------------------------------------------
// Konfirmasi pengguna (tidak bisa diukur aplikasi)

export type Confirm = "ok" | "problem" | "notChecked";
export type ConfirmQuestion = "systemGestures" | "clickFeel" | "pinch";

export const CONFIRM_OPTIONS: Confirm[] = ["ok", "problem", "notChecked"];

export const CONFIRM_QUESTIONS: Record<ConfirmQuestion, { question: UiKey; hint: UiKey; options: Record<Confirm, UiKey> }> = {
  systemGestures: {
    question: "trackpad.q.gestures",
    hint: "trackpad.q.gesturesHint",
    options: {
      ok: "trackpad.q.gestures.ok",
      problem: "trackpad.q.gestures.problem",
      notChecked: "trackpad.q.gestures.notChecked",
    },
  },
  clickFeel: {
    question: "trackpad.q.clickFeel",
    hint: "trackpad.q.clickFeelHint",
    options: {
      ok: "trackpad.q.clickFeel.ok",
      problem: "trackpad.q.clickFeel.problem",
      notChecked: "trackpad.q.clickFeel.notChecked",
    },
  },
  pinch: {
    question: "trackpad.q.pinch",
    hint: "trackpad.q.pinchHint",
    options: {
      ok: "trackpad.q.pinch.ok",
      problem: "trackpad.q.pinch.problem",
      notChecked: "trackpad.q.pinch.notChecked",
    },
  },
};

// ---------------------------------------------------------------------------
// Penilaian

export const TRACKPAD_LIMITATIONS: UiKey[] = [
  "trackpadLimit.cursor",
  "trackpadLimit.externalMouse",
  "trackpadLimit.settings",
  "trackpadLimit.systemGestures",
  "trackpadLimit.webkit",
  "trackpadLimit.privacy",
];

export interface TrackpadAnswer {
  state: TrackpadState;
  support: WebkitSupport;
  /** Fungsi wajib yang belum terdeteksi dinyatakan pengguna "sudah dicoba, tidak terdeteksi". */
  reportMissing: boolean;
  systemGestures: Confirm;
  clickFeel: Confirm;
  /** Hanya dipakai bila cubit tidak terdeteksi. */
  pinchConfirm: Confirm;
  durationMs: number;
  finishedAt: string;
}

export function assessTrackpad(answer: TrackpadAnswer): InteractiveResult {
  const { state, support } = answer;
  const missing = missingRequired(state);
  const evidence: Evidence[] = [];

  const covered = coveredCells(state);
  evidence.push({
    kind: "measured",
    level: covered >= COVERAGE_MIN_CELLS ? "ok" : "info",
    code: "trackpadResult.coverage",
    params: { covered, total: GRID_CELLS },
  });
  const detected = REQUIRED_ITEMS.filter((item) => item !== "move" && isDetected(state, item));
  if (detected.length > 0) {
    evidence.push({ kind: "measured", level: "ok", code: "trackpadResult.detected", params: { items: detected.map(itemParam) } });
  }

  // Fungsi wajib yang tidak terdeteksi walau sudah dicoba. Klik sekunder hanya
  // peringatan: bisa dimatikan di System Settings (pengaturan, belum tentu rusak).
  const critical = missing.filter((item) => item !== "secondaryClick");
  if (answer.reportMissing && critical.length > 0) {
    evidence.push({
      kind: "userConfirmed",
      level: "critical",
      code: "trackpadResult.notDetected",
      params: { items: critical.map(itemParam) },
    });
  }
  if (answer.reportMissing && missing.includes("secondaryClick")) {
    evidence.push({ kind: "userConfirmed", level: "warning", code: "trackpadResult.secondaryNotDetected" });
  }

  // Cubit: tidak terdeteksi = keterbatasan WebView (info), tidak pernah kegagalan.
  if (state.detected.pinch) {
    evidence.push({
      kind: "measured",
      level: "ok",
      code: "trackpadResult.pinchDetected",
      params: { source: `@${PINCH_SOURCE_LABEL[state.pinchSource ?? "gesture"]}` },
    });
  } else {
    evidence.push({ kind: "measured", level: "info", code: "trackpadResult.pinchNotDetected" });
    if (answer.pinchConfirm === "ok") {
      evidence.push({ kind: "userConfirmed", level: "ok", code: "trackpadResult.pinchConfirmedOk" });
    } else if (answer.pinchConfirm === "problem") {
      evidence.push({ kind: "userConfirmed", level: "warning", code: "trackpadResult.pinchConfirmedProblem" });
    }
  }

  // Force Click: opsional (Mac tanpa Force Touch, atau dimatikan di pengaturan).
  if (state.detected.forceClick) {
    evidence.push({ kind: "measured", level: "ok", code: "trackpadResult.forceDetected" });
  } else if (!support.forceEvents) {
    evidence.push({ kind: "measured", level: "info", code: "trackpadResult.forceUnsupported" });
  } else {
    evidence.push({ kind: "measured", level: "info", code: "trackpadResult.forceNotDetected" });
  }

  // Gestur 3/4 jari: hanya konfirmasi pengguna; bisa dimatikan/diubah di pengaturan.
  if (answer.systemGestures === "ok") {
    evidence.push({ kind: "userConfirmed", level: "ok", code: "trackpadResult.gesturesOk" });
  } else if (answer.systemGestures === "problem") {
    evidence.push({ kind: "userConfirmed", level: "warning", code: "trackpadResult.gesturesProblem" });
  }

  // Rasa klik/permukaan: masalah fisik yang dilaporkan = kritis (dikonfirmasi pengguna).
  if (answer.clickFeel === "ok") {
    evidence.push({ kind: "userConfirmed", level: "ok", code: "trackpadResult.clickFeelOk" });
  } else if (answer.clickFeel === "problem") {
    evidence.push({ kind: "userConfirmed", level: "critical", code: "trackpadResult.clickFeelProblem" });
  }

  const total = REQUIRED_ITEMS.length;
  const done = total - missing.length;
  const outcome: "cancelled" | "passed" | "failed" =
    missing.length > 0 && !answer.reportMissing ? "cancelled" : decideCompletedOutcome(evidence);
  const base = {
    id: "trackpad" as const,
    outcome,
    evidence,
    limitations: TRACKPAD_LIMITATIONS,
    finishedAt: answer.finishedAt,
    durationMs: answer.durationMs,
  };
  if (outcome === "cancelled") {
    return { ...base, summaryCode: "trackpadResult.cancelled", summaryParams: { n: done, total } };
  }
  if (outcome === "failed") {
    // Fungsi yang hilang tanpa laporan sudah menjadi "cancelled" di atas.
    const problems = critical.map(itemParam);
    if (answer.clickFeel === "problem") problems.push(`@${CLICK_FEEL_LABEL}`);
    return { ...base, summaryCode: "trackpadResult.failed", summaryParams: { items: problems } };
  }
  return missing.length === 0
    ? { ...base, summaryCode: "trackpadResult.passed", summaryParams: { total } }
    : { ...base, summaryCode: "trackpadResult.passedPartial", summaryParams: { n: done, total } };
}

/** Keluar sebelum selesai: Dibatalkan (tidak pernah dianggap sehat). */
export function cancelledTrackpad(state: TrackpadState): InteractiveResult {
  return {
    id: "trackpad",
    outcome: "cancelled",
    summaryCode: "trackpadResult.cancelled",
    summaryParams: { n: requiredDone(state), total: REQUIRED_ITEMS.length },
    evidence: [],
    limitations: TRACKPAD_LIMITATIONS,
  };
}
