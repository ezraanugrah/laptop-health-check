/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence } from "../../types/interactive";
import { bind, translate } from "../../i18n/translate.ts";
import { noteCount, outcomeLabelKey } from "./outcome.ts";
import {
  CONFIRM_OPTIONS,
  CONFIRM_QUESTIONS,
  COVERAGE_MIN_CELLS,
  DRAG_SLOTS,
  FORCE_CLICK_LEVEL,
  GRID_CELLS,
  GRID_COLS,
  GRID_ROWS,
  OPTIONAL_ITEMS,
  PINCH_SOURCE_LABEL,
  REQUIRED_ITEMS,
  STATUS_LABEL,
  TRACKPAD_ITEMS,
  TRACKPAD_LIMITATIONS,
  WHEEL_MIN_DELTA,
  applyTrackpadInput,
  assessTrackpad,
  attachTrackpadListeners,
  bucket,
  canFinishTrackpad,
  cancelledTrackpad,
  cellAt,
  clampBucket,
  coveredCells,
  detectWebkitSupport,
  dragSlot,
  emptyTrackpadState,
  isDetected,
  isDrop,
  isForceClick,
  itemStatus,
  missingRequired,
  requiredDone,
  type Confirm,
  type TrackpadInput,
  type TrackpadState,
  type WebkitSupport,
} from "./trackpad.ts";

const tId = bind("id-ID");
const tEn = bind("en-US");
const text = (e: Evidence, lang: "id-ID" | "en-US" = "id-ID") => translate(lang, e.code, e.params);
const RECT = { left: 100, top: 50, width: 600, height: 240 };
const SUPPORT: WebkitSupport = { gestureEvents: true, forceEvents: true };

function apply(state: TrackpadState, inputs: TrackpadInput[]): TrackpadState {
  return inputs.reduce(applyTrackpadInput, state);
}

function visit(state: TrackpadState, n: number): TrackpadState {
  return apply(
    state,
    Array.from({ length: n }, (_, cell) => ({ type: "move" as const, cell })),
  );
}

/** Semua fungsi wajib terdeteksi. */
function allRequired(): TrackpadState {
  return apply(visit(emptyTrackpadState(), GRID_CELLS), [
    { type: "click", button: 0, ctrlKey: false },
    { type: "contextMenu", ctrlKey: false },
    { type: "doubleClick", button: 0 },
    { type: "wheel", deltaX: 0, deltaY: 12, ctrlKey: false },
    { type: "wheel", deltaX: -8, deltaY: 0, ctrlKey: false },
    { type: "drop" },
  ]);
}

const answer = (
  state: TrackpadState,
  opts: Partial<{ reportMissing: boolean; systemGestures: Confirm; clickFeel: Confirm; pinchConfirm: Confirm; support: WebkitSupport }> = {},
) => ({
  state,
  support: opts.support ?? SUPPORT,
  reportMissing: opts.reportMissing ?? false,
  systemGestures: opts.systemGestures ?? "notChecked",
  clickFeel: opts.clickFeel ?? "notChecked",
  pinchConfirm: opts.pinchConfirm ?? "notChecked",
  durationMs: 1234,
  finishedAt: "2026-11-19T10:00:00.000Z",
});

// --- Geometri ------------------------------------------------------------------

test("kisi 6×4 dan ambang cakupan 20 sel", () => {
  assert.equal(GRID_COLS, 6);
  assert.equal(GRID_ROWS, 4);
  assert.equal(GRID_CELLS, 24);
  assert.equal(COVERAGE_MIN_CELLS, 20);
});

test("bucket: batas bawah, batas ember, tepi kanan, di luar rentang", () => {
  assert.equal(bucket(0, 600, 6), 0);
  assert.equal(bucket(99.999, 600, 6), 0);
  assert.equal(bucket(100, 600, 6), 1);
  assert.equal(bucket(600, 600, 6), 5, "tepi kanan tepat = ember terakhir");
  assert.equal(bucket(-0.001, 600, 6), null);
  assert.equal(bucket(600.001, 600, 6), null);
  assert.equal(bucket(10, 0, 6), null, "area tanpa ukuran");
  assert.equal(bucket(10, 600, 0), null);
  assert.equal(bucket(Number.NaN, 600, 6), null);
  assert.equal(bucket(Number.POSITIVE_INFINITY, 600, 6), null);
});

test("clampBucket menjepit posisi di luar rentang ke tepi", () => {
  assert.equal(clampBucket(-50, 600, 6), 0);
  assert.equal(clampBucket(9999, 600, 6), 5);
  assert.equal(clampBucket(350, 600, 6), 3);
  assert.equal(clampBucket(Number.NaN, 600, 6), 0);
  assert.equal(clampBucket(10, 0, 6), 0);
});

test("cellAt memetakan posisi kursor ke sel baris-mayor", () => {
  assert.equal(cellAt(100, 50, RECT), 0, "pojok kiri atas");
  assert.equal(cellAt(700, 290, RECT), 23, "pojok kanan bawah (tepi)");
  assert.equal(cellAt(199.9, 50, RECT), 0);
  assert.equal(cellAt(200, 50, RECT), 1);
  assert.equal(cellAt(100, 110, RECT), 6, "baris kedua");
  assert.equal(cellAt(99, 100, RECT), null, "kiri area");
  assert.equal(cellAt(300, 291, RECT), null, "bawah area");
});

test("seret: slot dijepit, lepas hanya sah di zona lepas dari slot lain", () => {
  const strip = { left: 0, top: 0, width: 600, height: 56 };
  assert.equal(DRAG_SLOTS, 6);
  assert.equal(dragSlot(-20, strip), 0);
  assert.equal(dragSlot(599, strip), 5);
  assert.equal(dragSlot(5000, strip), 5);
  assert.equal(isDrop(0, 5), true);
  assert.equal(isDrop(3, 5), true);
  assert.equal(isDrop(5, 5), false, "tidak berpindah");
  assert.equal(isDrop(0, 4), false, "di luar zona lepas");
});

// --- Reducer -------------------------------------------------------------------

test("gerak: sel unik dicatat, sel ganda dan sel tidak sah diabaikan (objek sama)", () => {
  const s0 = emptyTrackpadState();
  const s1 = applyTrackpadInput(s0, { type: "move", cell: 3 });
  assert.equal(coveredCells(s1), 1);
  assert.equal(coveredCells(s0), 0, "tanpa mutasi");
  assert.equal(applyTrackpadInput(s1, { type: "move", cell: 3 }), s1);
  for (const cell of [-1, GRID_CELLS, 1.5, Number.NaN]) {
    assert.equal(applyTrackpadInput(s1, { type: "move", cell }), s1, `sel ${cell}`);
  }
});

test("cakupan gerak: 19 sel belum, 20 sel terdeteksi", () => {
  assert.equal(isDetected(visit(emptyTrackpadState(), 19), "move"), false);
  assert.equal(isDetected(visit(emptyTrackpadState(), 20), "move"), true);
});

test("klik primer: tombol 0 tanpa Control; Control+klik dan tombol lain diabaikan", () => {
  const s = emptyTrackpadState();
  assert.equal(applyTrackpadInput(s, { type: "click", button: 0, ctrlKey: false }).detected.primaryClick, true);
  assert.equal(applyTrackpadInput(s, { type: "click", button: 0, ctrlKey: true }), s);
  assert.equal(applyTrackpadInput(s, { type: "click", button: 1, ctrlKey: false }), s);
  const once = applyTrackpadInput(s, { type: "click", button: 0, ctrlKey: false });
  assert.equal(applyTrackpadInput(once, { type: "click", button: 0, ctrlKey: false }), once, "sudah terdeteksi = objek sama");
});

test("klik dua kali hanya tombol primer", () => {
  const s = emptyTrackpadState();
  assert.equal(applyTrackpadInput(s, { type: "doubleClick", button: 0 }).detected.doubleClick, true);
  assert.equal(applyTrackpadInput(s, { type: "doubleClick", button: 2 }), s);
});

test("klik sekunder: menu konteks tanpa Control; Control+klik tidak dihitung", () => {
  const s = emptyTrackpadState();
  assert.equal(applyTrackpadInput(s, { type: "contextMenu", ctrlKey: false }).detected.secondaryClick, true);
  assert.equal(applyTrackpadInput(s, { type: "contextMenu", ctrlKey: true }), s);
});

test("gulir: ambang delta 1 px, sumbu dominan, roda+Control = cubit", () => {
  const s = emptyTrackpadState();
  const wheel = (deltaX: number, deltaY: number, ctrlKey = false) =>
    applyTrackpadInput(s, { type: "wheel", deltaX, deltaY, ctrlKey });
  assert.equal(WHEEL_MIN_DELTA, 1);
  assert.equal(wheel(0, 1).detected.scrollVertical, true);
  assert.equal(wheel(0, -1).detected.scrollVertical, true);
  assert.equal(wheel(0, 0.99), s, "di bawah ambang");
  assert.equal(wheel(1, 0).detected.scrollHorizontal, true);
  assert.equal(wheel(-0.99, 0), s);
  const tie = wheel(3, 3);
  assert.equal(tie.detected.scrollVertical, true, "seri = vertikal");
  assert.equal(tie.detected.scrollHorizontal, false);
  const horizontal = wheel(4, 3);
  assert.equal(horizontal.detected.scrollHorizontal, true);
  assert.equal(horizontal.detected.scrollVertical, false);
  assert.equal(wheel(Number.NaN, Number.NaN), s);
  const pinch = wheel(0, 5, true);
  assert.equal(pinch.detected.pinch, true);
  assert.equal(pinch.pinchSource, "ctrlWheel");
  assert.equal(pinch.detected.scrollVertical, false, "roda+Control bukan gulir");
  assert.equal(wheel(0, 0.5, true), s);
});

test("cubit gesture: batas skala ±0,05; sumbu pertama dipertahankan", () => {
  const s = emptyTrackpadState();
  const pinch = (scale: number) => applyTrackpadInput(s, { type: "pinch", scale });
  assert.equal(pinch(1.05).detected.pinch, true);
  assert.equal(pinch(0.95).detected.pinch, true);
  assert.equal(pinch(1.04), s);
  assert.equal(pinch(0.96), s);
  assert.equal(pinch(Number.NaN), s);
  const first = pinch(1.2);
  assert.equal(first.pinchSource, "gesture");
  assert.equal(applyTrackpadInput(first, { type: "wheel", deltaX: 0, deltaY: 9, ctrlKey: true }), first);
});

test("Force Click: batas webkitForce 2", () => {
  assert.equal(FORCE_CLICK_LEVEL, 2);
  assert.equal(isForceClick(1.99), false);
  assert.equal(isForceClick(2), true);
  const s = emptyTrackpadState();
  assert.equal(applyTrackpadInput(s, { type: "force", force: 1.99 }), s);
  assert.equal(applyTrackpadInput(s, { type: "force", force: 2 }).detected.forceClick, true);
});

test("seret dan lepas tercatat", () => {
  assert.equal(applyTrackpadInput(emptyTrackpadState(), { type: "drop" }).detected.drag, true);
});

test("fungsi opsional 'sudah dicoba, tidak terdeteksi'; deteksi selalu menang", () => {
  const s = emptyTrackpadState();
  const marked = applyTrackpadInput(s, { type: "markNotDetected", item: "pinch" });
  assert.equal(marked.notDetected.pinch, true);
  assert.equal(applyTrackpadInput(marked, { type: "markNotDetected", item: "pinch" }), marked);
  assert.equal(itemStatus(marked, "pinch", SUPPORT), "notDetected");
  const later = applyTrackpadInput(marked, { type: "pinch", scale: 1.3 });
  assert.equal(itemStatus(later, "pinch", SUPPORT), "detected");
  const detected = applyTrackpadInput(s, { type: "force", force: 3 });
  assert.equal(applyTrackpadInput(detected, { type: "markNotDetected", item: "forceClick" }), detected);
});

test("indikator: Menunggu / Terdeteksi / Tidak didukung WebView / Tidak terdeteksi", () => {
  const s = emptyTrackpadState();
  const noForce: WebkitSupport = { gestureEvents: false, forceEvents: false };
  assert.equal(itemStatus(s, "primaryClick", SUPPORT), "waiting");
  assert.equal(itemStatus(s, "forceClick", noForce), "unsupported");
  assert.equal(itemStatus(s, "pinch", noForce), "waiting", "cubit masih bisa lewat roda+Control");
  assert.equal(itemStatus(applyTrackpadInput(s, { type: "force", force: 2 }), "forceClick", noForce), "detected");
  assert.equal(itemStatus(applyTrackpadInput(s, { type: "markNotDetected", item: "forceClick" }), "forceClick", SUPPORT), "notDetected");
  for (const status of ["waiting", "detected", "unsupported", "notDetected"] as const) {
    assert.notEqual(tEn(STATUS_LABEL[status]), STATUS_LABEL[status]);
  }
  assert.equal(tId(STATUS_LABEL.unsupported), "Tidak didukung WebView");
  assert.equal(tId(STATUS_LABEL.notDetected), "Tidak terdeteksi oleh WebView");
});

test("deteksi fitur WebKit (bukan tebakan)", () => {
  assert.deepEqual(detectWebkitSupport({}), { gestureEvents: false, forceEvents: false });
  assert.deepEqual(detectWebkitSupport({ GestureEvent: function GestureEvent() {} }), { gestureEvents: true, forceEvents: false });
  assert.equal(detectWebkitSupport({ MouseEvent: { WEBKIT_FORCE_AT_FORCE_MOUSE_DOWN: 2 } }).forceEvents, true);
  assert.equal(detectWebkitSupport({ document: { onwebkitmouseforcedown: null } }).forceEvents, true);
  assert.equal(detectWebkitSupport({ GestureEvent: {}, MouseEvent: {}, document: {} }).gestureEvents, false);
});

test("progres dan syarat selesai", () => {
  const s = emptyTrackpadState();
  assert.equal(requiredDone(s), 0);
  assert.deepEqual(missingRequired(s), REQUIRED_ITEMS);
  assert.equal(canFinishTrackpad(s, false), false);
  assert.equal(canFinishTrackpad(s, true), true);
  const all = allRequired();
  assert.equal(requiredDone(all), REQUIRED_ITEMS.length);
  assert.equal(canFinishTrackpad(all, false), true);
});

// --- Listener ------------------------------------------------------------------

function fire(target: EventTarget, type: string, props: Record<string, unknown> = {}): Event {
  const e = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(props)) Object.defineProperty(e, key, { value });
  target.dispatchEvent(e);
  return e;
}

test("listener hanya di area uji, preventDefault hanya untuk event yang perlu, dan dilepas sepenuhnya", () => {
  const target = new EventTarget();
  const seen: TrackpadInput[] = [];
  const detach = attachTrackpadListeners(target, () => RECT, (input) => seen.push(input));

  fire(target, "pointermove", { clientX: 110, clientY: 60 });
  fire(target, "pointermove", { clientX: 150, clientY: 70 }); // sel sama: tidak dikirim ulang
  fire(target, "pointermove", { clientX: 690, clientY: 280 });
  fire(target, "pointermove", { clientX: 10, clientY: 10 }); // di luar area
  const click = fire(target, "click", { button: 0, ctrlKey: false });
  fire(target, "dblclick", { button: 0 });
  const menu = fire(target, "contextmenu", { ctrlKey: false });
  const wheel = fire(target, "wheel", { deltaX: 0, deltaY: 7, ctrlKey: false });
  const gStart = fire(target, "gesturestart");
  const gChange = fire(target, "gesturechange", { scale: 1.4 });
  fire(target, "gesturechange"); // tanpa skala → 1 (tidak berubah)
  const gEnd = fire(target, "gestureend");
  const willBegin = fire(target, "webkitmouseforcewillbegin");
  fire(target, "webkitmouseforcechanged", { webkitForce: 1.2 }); // di bawah ambang: tidak dikirim
  fire(target, "webkitmouseforcechanged", { webkitForce: 2.5 });
  fire(target, "webkitmouseforcedown", { webkitForce: 1 });

  assert.deepEqual(seen, [
    { type: "move", cell: 0 },
    { type: "move", cell: 23 },
    { type: "click", button: 0, ctrlKey: false },
    { type: "doubleClick", button: 0 },
    { type: "contextMenu", ctrlKey: false },
    { type: "wheel", deltaX: 0, deltaY: 7, ctrlKey: false },
    { type: "pinch", scale: 1.4 },
    { type: "pinch", scale: 1 },
    { type: "force", force: 2.5 },
    { type: "force", force: 2 },
  ]);
  assert.equal(click.defaultPrevented, false, "klik biasa tidak dicegah");
  assert.equal(menu.defaultPrevented, true, "menu konteks dicegah di area uji");
  assert.equal(wheel.defaultPrevented, true, "gulir halaman dicegah di area uji");
  assert.ok(gStart.defaultPrevented && gChange.defaultPrevented && gEnd.defaultPrevented, "zoom halaman dicegah");
  assert.equal(willBegin.defaultPrevented, true, "aksi Force Touch bawaan dicegah");

  detach();
  const after = fire(target, "contextmenu", { ctrlKey: false });
  fire(target, "click", { button: 0, ctrlKey: false });
  assert.equal(seen.length, 10, "setelah dilepas tidak ada event yang ditangkap");
  assert.equal(after.defaultPrevented, false);
});

test("state dari listener: event nyata menghasilkan deteksi", () => {
  const target = new EventTarget();
  let state = emptyTrackpadState();
  const detach = attachTrackpadListeners(target, () => RECT, (input) => {
    state = applyTrackpadInput(state, input);
  });
  fire(target, "contextmenu", { ctrlKey: true });
  assert.equal(state.detected.secondaryClick, false, "Control+klik tidak dihitung");
  fire(target, "wheel", { deltaX: 6, deltaY: 1, ctrlKey: false });
  assert.equal(state.detected.scrollHorizontal, true);
  detach();
});

// --- Penilaian -----------------------------------------------------------------

test("semua fungsi wajib terdeteksi = Lulus terukur", () => {
  const r = assessTrackpad(answer(allRequired(), { systemGestures: "ok", clickFeel: "ok" }));
  assert.equal(r.id, "trackpad");
  assert.equal(r.outcome, "passed");
  assert.equal(outcomeLabelKey(r), "outcome.passed");
  assert.equal(tId(r.summaryCode, r.summaryParams), "Semua 7 fungsi wajib trackpad terdeteksi.");
  assert.equal(tEn(r.summaryCode, r.summaryParams), "All 7 required trackpad functions were detected.");
  const coverage = r.evidence.find((e) => e.code === "trackpadResult.coverage")!;
  assert.equal(coverage.kind, "measured");
  assert.equal(coverage.level, "ok");
  assert.equal(text(coverage), "Kursor melewati 24 dari 24 sel kisi area uji.");
  const detected = r.evidence.find((e) => e.code === "trackpadResult.detected")!;
  assert.equal(
    text(detected, "en-US"),
    "Detected: Primary click, Secondary click, Double click, Vertical scroll, Horizontal scroll, Drag and drop.",
  );
  assert.ok(r.evidence.some((e) => e.code === "trackpadResult.gesturesOk" && e.kind === "userConfirmed"));
  assert.ok(r.evidence.some((e) => e.code === "trackpadResult.clickFeelOk" && e.kind === "userConfirmed"));
  assert.deepEqual(r.limitations, TRACKPAD_LIMITATIONS);
  assert.equal(r.durationMs, 1234);
  assert.equal(r.finishedAt, "2026-11-19T10:00:00.000Z");
});

test("fungsi wajib tersisa tanpa laporan = Dibatalkan, bukan Lulus", () => {
  const state = apply(emptyTrackpadState(), [{ type: "click", button: 0, ctrlKey: false }]);
  const r = assessTrackpad(answer(state));
  assert.equal(r.outcome, "cancelled");
  assert.equal(tId(r.summaryCode, r.summaryParams), "Tes belum selesai: 1 dari 7 fungsi wajib terdeteksi.");
  assert.equal(r.evidence.find((e) => e.code === "trackpadResult.coverage")!.level, "info");
});

test("'sudah dicoba, tidak terdeteksi': kritis untuk gerak/klik/gulir/seret, peringatan untuk klik sekunder", () => {
  const state = apply(visit(emptyTrackpadState(), 19), [
    { type: "doubleClick", button: 0 },
    { type: "wheel", deltaX: 0, deltaY: 5, ctrlKey: false },
  ]);
  const r = assessTrackpad(answer(state, { reportMissing: true }));
  assert.equal(r.outcome, "failed");
  const critical = r.evidence.find((e) => e.code === "trackpadResult.notDetected")!;
  assert.equal(critical.kind, "userConfirmed");
  assert.equal(critical.level, "critical");
  assert.equal(text(critical), "Sudah dicoba, tidak terdeteksi: Gerak kursor, Klik primer, Gulir horizontal, Seret dan lepas.");
  assert.equal(text(critical, "en-US"), "Tried but not detected: Cursor movement, Primary click, Horizontal scroll, Drag and drop.");
  const secondary = r.evidence.find((e) => e.code === "trackpadResult.secondaryNotDetected")!;
  assert.equal(secondary.level, "warning");
  assert.match(text(secondary), /System Settings › Trackpad › Klik Sekunder/);
  assert.equal(tEn(r.summaryCode, r.summaryParams), "Trackpad problems: Cursor movement, Primary click, Horizontal scroll, Drag and drop.");
});

test("hanya klik sekunder tidak terdeteksi = Lulus dengan catatan (pengaturan, bukan rusak)", () => {
  const state = apply(visit(emptyTrackpadState(), GRID_CELLS), [
    { type: "click", button: 0, ctrlKey: false },
    { type: "doubleClick", button: 0 },
    { type: "wheel", deltaX: 0, deltaY: 3, ctrlKey: false },
    { type: "wheel", deltaX: 3, deltaY: 0, ctrlKey: false },
    { type: "drop" },
  ]);
  assert.deepEqual(missingRequired(state), ["secondaryClick"]);
  const r = assessTrackpad(answer(state, { reportMissing: true }));
  assert.equal(r.outcome, "passed");
  assert.equal(noteCount(r), 1);
  assert.ok(!r.evidence.some((e) => e.level === "critical"));
  assert.equal(tId(r.summaryCode, r.summaryParams), "6 dari 7 fungsi wajib terdeteksi; sisanya dicatat sebagai catatan.");
});

test("cubit tidak terdeteksi tidak pernah menggagalkan; konfirmasi pengguna hanya peringatan", () => {
  const base = allRequired();
  const r = assessTrackpad(answer(base));
  const info = r.evidence.find((e) => e.code === "trackpadResult.pinchNotDetected")!;
  assert.equal(info.kind, "measured");
  assert.equal(info.level, "info");
  assert.match(text(info), /tidak terdeteksi oleh WebView/);
  assert.equal(r.outcome, "passed");

  const ok = assessTrackpad(answer(base, { pinchConfirm: "ok" }));
  assert.ok(ok.evidence.some((e) => e.code === "trackpadResult.pinchConfirmedOk" && e.kind === "userConfirmed" && e.level === "ok"));
  const problem = assessTrackpad(answer(base, { pinchConfirm: "problem" }));
  assert.equal(problem.outcome, "passed");
  assert.equal(problem.evidence.find((e) => e.code === "trackpadResult.pinchConfirmedProblem")!.level, "warning");
  assert.ok(!assessTrackpad(answer(base, { pinchConfirm: "notChecked" })).evidence.some((e) => e.code.startsWith("trackpadResult.pinchConfirmed")));
});

test("cubit terdeteksi = terukur dengan sumbernya; konfirmasi cubit diabaikan", () => {
  const gesture = applyTrackpadInput(allRequired(), { type: "pinch", scale: 0.8 });
  const r = assessTrackpad(answer(gesture, { pinchConfirm: "problem" }));
  const e = r.evidence.find((x) => x.code === "trackpadResult.pinchDetected")!;
  assert.equal(e.kind, "measured");
  assert.equal(e.level, "ok");
  assert.equal(text(e, "en-US"), "Pinch/zoom detected (WebKit gesture events).");
  assert.ok(!r.evidence.some((x) => x.code === "trackpadResult.pinchConfirmedProblem"));
  const wheel = applyTrackpadInput(allRequired(), { type: "wheel", deltaX: 0, deltaY: 4, ctrlKey: true });
  const w = assessTrackpad(answer(wheel)).evidence.find((x) => x.code === "trackpadResult.pinchDetected")!;
  assert.equal(text(w), "Cubit/zoom terdeteksi (event roda dengan Control).");
  assert.equal(PINCH_SOURCE_LABEL.gesture, "trackpad.source.gesture");
});

test("Force Click: terdeteksi (ok), tidak didukung (info), tidak terdeteksi (info)", () => {
  const level = (state: TrackpadState, support: WebkitSupport) =>
    assessTrackpad(answer(state, { support })).evidence.filter((e) => e.code.startsWith("trackpadResult.force"));
  const forced = applyTrackpadInput(allRequired(), { type: "force", force: 2 });
  assert.deepEqual(level(forced, SUPPORT).map((e) => [e.code, e.level]), [["trackpadResult.forceDetected", "ok"]]);
  assert.deepEqual(level(allRequired(), { gestureEvents: true, forceEvents: false }).map((e) => [e.code, e.level]), [
    ["trackpadResult.forceUnsupported", "info"],
  ]);
  assert.deepEqual(level(allRequired(), SUPPORT).map((e) => [e.code, e.level]), [["trackpadResult.forceNotDetected", "info"]]);
  assert.equal(assessTrackpad(answer(allRequired(), { support: { gestureEvents: false, forceEvents: false } })).outcome, "passed");
});

test("gestur 3/4 jari: dikonfirmasi pengguna; masalah hanya peringatan", () => {
  const ok = assessTrackpad(answer(allRequired(), { systemGestures: "ok" }));
  assert.equal(ok.evidence.find((e) => e.code === "trackpadResult.gesturesOk")!.kind, "userConfirmed");
  const problem = assessTrackpad(answer(allRequired(), { systemGestures: "problem" }));
  assert.equal(problem.outcome, "passed");
  assert.equal(problem.evidence.find((e) => e.code === "trackpadResult.gesturesProblem")!.level, "warning");
  assert.ok(!assessTrackpad(answer(allRequired())).evidence.some((e) => e.code.startsWith("trackpadResult.gestures")));
});

test("masalah fisik klik/permukaan = Gagal (dikonfirmasi pengguna)", () => {
  const r = assessTrackpad(answer(allRequired(), { clickFeel: "problem" }));
  assert.equal(r.outcome, "failed");
  const e = r.evidence.find((x) => x.code === "trackpadResult.clickFeelProblem")!;
  assert.equal(e.kind, "userConfirmed");
  assert.equal(e.level, "critical");
  assert.equal(tId(r.summaryCode, r.summaryParams), "Masalah trackpad: rasa klik/permukaan.");
  assert.ok(!assessTrackpad(answer(allRequired())).evidence.some((x) => x.code.startsWith("trackpadResult.clickFeel")));
});

test("tes trackpad yang dihentikan = Dibatalkan dengan progres", () => {
  const r = cancelledTrackpad(apply(emptyTrackpadState(), [{ type: "drop" }, { type: "doubleClick", button: 0 }]));
  assert.equal(r.outcome, "cancelled");
  assert.equal(r.id, "trackpad");
  assert.deepEqual(r.evidence, []);
  assert.equal(tEn(r.summaryCode, r.summaryParams), "Test not finished: 2 of 7 required functions detected.");
  assert.equal(r.limitations.length, TRACKPAD_LIMITATIONS.length);
});

test("semua kunci teks trackpad ada di dua bahasa", () => {
  const keys = [
    ...Object.values(TRACKPAD_ITEMS).flatMap((i) => [i.name, i.hint]),
    ...Object.values(CONFIRM_QUESTIONS).flatMap((q) => [q.question, q.hint, ...CONFIRM_OPTIONS.map((o) => q.options[o])]),
    ...TRACKPAD_LIMITATIONS,
  ];
  for (const key of keys) {
    assert.notEqual(translate("id-ID", key), key, key);
    assert.notEqual(translate("en-US", key), key, key);
  }
  assert.equal(OPTIONAL_ITEMS.length + REQUIRED_ITEMS.length, Object.keys(TRACKPAD_ITEMS).length);
});
