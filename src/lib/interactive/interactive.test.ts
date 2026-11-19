/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence, InteractiveResult, TestOutcome } from "../../types/interactive";
import { bind, translate } from "../../i18n/translate.ts";
import {
  OUTCOME_META,
  TEST_META,
  TEST_ORDER,
  decideCompletedOutcome,
  noteCount,
  outcomeLabel,
  outcomeLabelKey,
  shouldRecordCancel,
  summarize,
  summaryText,
  toCheckStatus,
} from "./outcome.ts";
import { DISPLAY_PATTERNS, allPatternsViewed, assessDisplay, cancelledDisplay } from "./display.ts";
import {
  BACKLIGHT_CHECKS,
  CHATTER_WINDOW_MS,
  applyKeyEvent,
  assessKeyboard,
  attachKeyTracker,
  buildLayout,
  canFinish,
  emptyTrackerState,
  remainingCodes,
  testableCodes,
  type Backlight,
  type KeyTrackerState,
} from "./keyboard.ts";

const tId = bind("id-ID");
const tEn = bind("en-US");
const ev = (kind: Evidence["kind"], level: Evidence["level"], experimental?: boolean): Evidence => ({
  kind,
  level,
  code: "displayResult.noIssues",
  experimental,
});
const result = (outcome: TestOutcome, evidence: Evidence[] = []): InteractiveResult => ({
  id: "display",
  outcome,
  summaryCode: "displayResult.passed",
  evidence,
  limitations: [],
});
/** Teks bukti dalam bahasa tertentu (untuk memeriksa isi yang ditampilkan). */
const text = (e: Evidence, lang: "id-ID" | "en-US" = "id-ID") => translate(lang, e.code, e.params);

// --- Model hasil -------------------------------------------------------------

test("lima status hasil dalam dua bahasa", () => {
  const labels = (t: typeof tId) =>
    Object.fromEntries(Object.entries(OUTCOME_META).map(([k, v]) => [k, t(v.label)]));
  assert.deepEqual(labels(tId), {
    notRun: "Belum diuji",
    passed: "Lulus",
    failed: "Gagal",
    unavailable: "Tidak tersedia",
    cancelled: "Dibatalkan",
  });
  assert.deepEqual(labels(tEn), {
    notRun: "Not tested",
    passed: "Passed",
    failed: "Failed",
    unavailable: "Unavailable",
    cancelled: "Cancelled",
  });
});

test("belum diuji, dibatalkan, dan tidak tersedia TIDAK PERNAH dianggap sehat", () => {
  assert.equal(toCheckStatus("notRun"), "unknown");
  assert.equal(toCheckStatus("cancelled"), "unknown");
  assert.equal(toCheckStatus("unavailable"), "unknown");
  assert.equal(toCheckStatus("failed"), "critical");
  assert.equal(toCheckStatus("passed"), "healthy");
  assert.equal(outcomeLabel(undefined, tId), "Belum diuji");
});

test("Lulus tanpa bukti terukur diberi label dikonfirmasi pengguna", () => {
  assert.equal(outcomeLabelKey(result("passed", [ev("userConfirmed", "ok")])), "outcome.passedUserConfirmed");
  assert.equal(outcomeLabel(result("passed", [ev("userConfirmed", "ok")]), tId), "Lulus (dikonfirmasi pengguna)");
  assert.equal(outcomeLabel(result("passed", [ev("userConfirmed", "ok")]), tEn), "Passed (user-confirmed)");
  assert.equal(outcomeLabelKey(result("passed", [ev("measured", "info"), ev("userConfirmed", "ok")])), "outcome.passedUserConfirmed");
  assert.equal(outcomeLabelKey(result("passed", [ev("measured", "ok", true)])), "outcome.passedUserConfirmed");
  assert.equal(outcomeLabelKey(result("passed", [ev("measured", "ok")])), "outcome.passed");
});

test("bukti kritis menggagalkan; bukti eksperimental tidak", () => {
  assert.equal(decideCompletedOutcome([]), "passed");
  assert.equal(decideCompletedOutcome([ev("measured", "warning")]), "passed");
  assert.equal(decideCompletedOutcome([ev("measured", "critical", true)]), "passed");
  assert.equal(decideCompletedOutcome([ev("userConfirmed", "critical")]), "failed");
});

test("keluar di tengah tes tidak menimpa hasil selesai sebelumnya", () => {
  assert.equal(shouldRecordCancel(undefined), true);
  assert.equal(shouldRecordCancel(result("notRun")), true);
  assert.equal(shouldRecordCancel(result("cancelled")), true);
  assert.equal(shouldRecordCancel(result("passed")), false);
  assert.equal(shouldRecordCancel(result("failed")), false);
  assert.equal(shouldRecordCancel(result("unavailable")), false);
});

test("ringkasan hanya menghitung Lulus/Gagal sebagai selesai (dua bahasa)", () => {
  const s = summarize({
    display: result("passed"),
    keyboard: { ...result("failed"), id: "keyboard" },
    trackpad: { ...result("cancelled"), id: "trackpad" },
    touchBar: { ...result("unavailable"), id: "touchBar" },
  });
  assert.deepEqual(s, { total: 9, tested: 2, passed: 1, failed: 1, unavailable: 1, cancelled: 1, notRun: 5 });
  assert.equal(summaryText(s, tId), "2 dari 9 tes selesai · 1 lulus · 1 gagal · 1 tidak tersedia · 1 dibatalkan");
  assert.equal(summaryText(s, tEn), "2 of 9 tests finished · 1 passed · 1 failed · 1 unavailable · 1 cancelled");
  assert.equal(summaryText(summarize({}), tId), "0 dari 9 tes selesai");
});

test("sembilan tes terdaftar; hanya Layar dan Keyboard yang sudah dibuat", () => {
  assert.equal(TEST_ORDER.length, 9);
  assert.deepEqual(
    TEST_ORDER.filter((id) => TEST_META[id].implemented),
    ["display", "keyboard"],
  );
  for (const id of TEST_ORDER) {
    assert.notEqual(tEn(TEST_META[id].title), TEST_META[id].title, `judul ${id} punya terjemahan`);
  }
});

// --- Tes Layar ---------------------------------------------------------------

test("pola layar memakai class Tailwind, bukan style inline; nama diterjemahkan", () => {
  assert.equal(DISPLAY_PATTERNS.length, 7);
  for (const p of DISPLAY_PATTERNS) assert.match(p.className, /^bg-/);
  assert.equal(tId(DISPLAY_PATTERNS[0].name), "Hitam");
  assert.equal(tEn(DISPLAY_PATTERNS[0].name), "Black");
  assert.equal(allPatternsViewed(6), false);
  assert.equal(allPatternsViewed(7), true);
});

test("layar tanpa masalah = Lulus (dikonfirmasi pengguna)", () => {
  const r = assessDisplay({ viewed: 7, issues: [], durationMs: 1000, finishedAt: "t" });
  assert.equal(r.outcome, "passed");
  assert.equal(outcomeLabelKey(r), "outcome.passedUserConfirmed");
  assert.ok(r.limitations.length > 0);
  assert.equal(text(r.evidence[0]), "7 dari 7 pola warna ditampilkan layar penuh.");
  assert.equal(text(r.evidence[0], "en-US"), "7 of 7 color patterns were shown full screen.");
});

test("setiap masalah layar yang dilaporkan = Gagal; nama isu ikut diterjemahkan", () => {
  for (const issue of ["deadPixel", "stuckPixel", "lines", "blotch"] as const) {
    const r = assessDisplay({ viewed: 7, issues: [issue, issue], durationMs: 1, finishedAt: "t" });
    assert.equal(r.outcome, "failed", issue);
    assert.equal(r.evidence.filter((e) => e.kind === "userConfirmed").length, 1, "duplikat digabung");
  }
  const r = assessDisplay({ viewed: 7, issues: ["deadPixel"], durationMs: 1, finishedAt: "t" });
  const reported = r.evidence.find((e) => e.code === "displayResult.reported")!;
  assert.equal(text(reported), "Dilaporkan: Piksel mati (titik gelap).");
  assert.equal(text(reported, "en-US"), "Reported: Dead pixel (dark dot).");
});

test("tes layar yang dihentikan = Dibatalkan", () => {
  const r = cancelledDisplay(3);
  assert.equal(r.outcome, "cancelled");
  assert.equal(tId(r.summaryCode, r.summaryParams), "Tes dihentikan setelah 3 dari 7 pola.");
});

// --- Tes Keyboard ------------------------------------------------------------

const down = (code: string, t: number, repeat = false) => ({ type: "keydown", code, timeStamp: t, repeat });
const up = (code: string, t: number) => ({ type: "keyup", code, timeStamp: t });

function press(state: KeyTrackerState, codes: string[]): KeyTrackerState {
  let s = state;
  let t = 0;
  for (const c of codes) {
    s = applyKeyEvent(s, down(c, (t += 100)));
    s = applyKeyEvent(s, up(c, (t += 50)));
  }
  return s;
}

const answer = (state: KeyTrackerState, backlight: Backlight, reportUntestedAsBroken = false, row: "touchBar" | "physical" = "touchBar") => ({
  layout: buildLayout("ansi", row),
  state,
  reportUntestedAsBroken,
  backlight,
  durationMs: 1,
  finishedAt: "t",
});

test("tata letak: Touch ID dan fn tidak bisa diuji; Touch Bar tanpa F1–F12", () => {
  const physical = buildLayout("ansi", "physical");
  const touchBar = buildLayout("ansi", "touchBar");
  assert.ok(!testableCodes(physical).includes("Fn"));
  assert.ok(!testableCodes(physical).includes("TouchID"));
  assert.ok(testableCodes(physical).includes("F12"));
  assert.ok(!testableCodes(touchBar).includes("F1"));
  assert.ok(testableCodes(touchBar).includes("Escape"));
  const codes = testableCodes(physical);
  assert.equal(new Set(codes).size, codes.length, "tidak ada kode ganda");
  assert.ok(testableCodes(buildLayout("iso", "physical")).includes("IntlBackslash"));
});

test("ketikan ganda: batas jeda 39/40/41 ms", () => {
  const at = (gap: number) => {
    let s = applyKeyEvent(emptyTrackerState(), down("KeyA", 0));
    s = applyKeyEvent(s, up("KeyA", 100));
    s = applyKeyEvent(s, down("KeyA", 100 + gap));
    return s.keys.KeyA.chatter;
  };
  assert.equal(CHATTER_WINDOW_MS, 40);
  assert.equal(at(39), 1);
  assert.equal(at(40), 0);
  assert.equal(at(41), 0);
});

test("auto-repeat tidak dihitung ketikan ganda; tombol tertahan sejak awal ditandai", () => {
  let s = applyKeyEvent(emptyTrackerState(), down("KeyB", 0));
  s = applyKeyEvent(s, down("KeyB", 30, true));
  assert.equal(s.keys.KeyB.downs, 1);
  assert.equal(s.keys.KeyB.chatter, 0);
  const stuck = applyKeyEvent(emptyTrackerState(), down("KeyC", 0, true));
  assert.equal(stuck.keys.KeyC.heldAtStart, true);
});

test("Caps Lock: keyup saja tetap terhitung tertekan", () => {
  const s = applyKeyEvent(emptyTrackerState(), up("CapsLock", 10));
  assert.equal(s.keys.CapsLock.downs, 1);
});

test("semua tombol teruji = Lulus dengan bukti terukur", () => {
  const layout = buildLayout("ansi", "touchBar");
  const state = press(emptyTrackerState(), testableCodes(layout));
  assert.equal(remainingCodes(layout, state).length, 0);
  assert.ok(canFinish(layout, state, false));
  const r = assessKeyboard(answer(state, "notChecked"));
  assert.equal(r.outcome, "passed");
  assert.equal(outcomeLabelKey(r), "outcome.passed");
  assert.equal(tEn(r.summaryCode, r.summaryParams), `All ${testableCodes(layout).length} testable keys work.`);
});

test("tombol yang dilaporkan tidak merespons = Gagal (daftar tombol di parameter)", () => {
  const layout = buildLayout("ansi", "touchBar");
  const codes = testableCodes(layout).filter((c) => c !== "KeyQ" && c !== "Space");
  const state = press(emptyTrackerState(), codes);
  assert.deepEqual(remainingCodes(layout, state), ["KeyQ", "Space"]);
  assert.equal(canFinish(layout, state, false), false);
  assert.equal(canFinish(layout, state, true), true);
  const r = assessKeyboard(answer(state, "notChecked", true));
  assert.equal(r.outcome, "failed");
  const broken = r.evidence.find((e) => e.level === "critical")!;
  assert.equal(text(broken), "Tidak merespons saat ditekan: Q, spasi.");
  assert.equal(text(broken, "en-US"), "No response when pressed: Q, space.");
});

test("tombol tersisa tanpa laporan rusak = Dibatalkan, bukan Lulus", () => {
  const state = press(emptyTrackerState(), ["KeyA"]);
  const r = assessKeyboard(answer(state, "ok", false, "physical"));
  assert.equal(r.outcome, "cancelled");
});

test("ketikan ganda eksperimental tidak menggagalkan tes", () => {
  const layout = buildLayout("ansi", "touchBar");
  let state = press(emptyTrackerState(), testableCodes(layout));
  state = applyKeyEvent(state, down("KeyA", 10_000));
  state = applyKeyEvent(state, up("KeyA", 10_010));
  state = applyKeyEvent(state, down("KeyA", 10_020));
  const r = assessKeyboard(answer(state, "faulty"));
  assert.equal(r.outcome, "passed");
  const chatter = r.evidence.find((e) => e.code === "keyboardResult.chatter")!;
  assert.ok(chatter.experimental);
  assert.match(text(chatter), /A \(1×\)/);
  assert.ok(r.evidence.some((e) => e.kind === "userConfirmed" && e.code === "keyboardResult.backlightFaulty"));
});

test("listener keyboard hanya aktif selama tes dan dilepas sepenuhnya", () => {
  const target = new EventTarget();
  const seen: string[] = [];
  const detach = attachKeyTracker(target, (_s, e) => seen.push(`${e.type}:${e.code}`));
  const key = (type: string, code: string) => {
    const e = new Event(type, { cancelable: true });
    Object.defineProperty(e, "code", { value: code });
    target.dispatchEvent(e);
    return e;
  };
  const e1 = key("keydown", "KeyA");
  key("keyup", "KeyA");
  assert.equal(e1.defaultPrevented, true, "aksi bawaan WebView dicegah selama tes");
  detach();
  const e2 = key("keydown", "KeyB");
  assert.deepEqual(seen, ["keydown:KeyA", "keyup:KeyA"]);
  assert.equal(e2.defaultPrevented, false, "setelah dilepas, tidak ada yang menangkap tombol");
});

// --- Perbaikan setelah uji native (P2–P4) ------------------------------------

test("P2: fn yang tidak terbaca dicatat sebagai keterbatasan, bukan kerusakan", () => {
  const layout = buildLayout("ansi", "touchBar");
  const r = assessKeyboard(answer(press(emptyTrackerState(), testableCodes(layout)), "notChecked"));
  const silent = r.evidence.find((e) => e.code === "keyboardResult.untestableSilent")!;
  assert.equal(silent.level, "info");
  assert.match(text(silent), /fn/);
  assert.equal(r.outcome, "passed");
});

test("P2: fn yang ternyata mengirim sinyal dicatat terukur", () => {
  const layout = buildLayout("ansi", "touchBar");
  const r = assessKeyboard(answer(press(emptyTrackerState(), [...testableCodes(layout), "Fn"]), "notChecked"));
  assert.ok(r.evidence.some((e) => e.kind === "measured" && e.code === "keyboardResult.untestableSent"));
  assert.ok(!r.evidence.some((e) => e.code === "keyboardResult.untestableSilent"));
});

test("P3: lampu latar — empat jawaban dengan level yang tepat", () => {
  assert.equal(BACKLIGHT_CHECKS.length, 3);
  const layout = buildLayout("ansi", "touchBar");
  const state = press(emptyTrackerState(), testableCodes(layout));
  const level = (b: Backlight) =>
    assessKeyboard(answer(state, b)).evidence.find((e) => e.code.startsWith("keyboardResult.backlight"))?.level;
  assert.equal(level("ok"), "ok");
  assert.equal(level("faulty"), "warning");
  assert.equal(level("offUnchecked"), "info");
  assert.equal(level("notChecked"), undefined);
  assert.equal(assessKeyboard(answer(state, "faulty")).outcome, "passed");
});

test("P4: jumlah catatan menghitung bukti peringatan, termasuk eksperimental", () => {
  assert.equal(noteCount(undefined), 0);
  assert.equal(noteCount(result("passed", [ev("measured", "ok")])), 0);
  assert.equal(
    noteCount(result("passed", [ev("userConfirmed", "warning"), ev("measured", "warning", true), ev("measured", "info")])),
    2,
  );
  const layout = buildLayout("ansi", "touchBar");
  const state = press(emptyTrackerState(), testableCodes(layout));
  assert.equal(noteCount(assessKeyboard(answer(state, "faulty"))), 1);
  assert.equal(noteCount(assessKeyboard(answer(state, "offUnchecked"))), 0);
});
