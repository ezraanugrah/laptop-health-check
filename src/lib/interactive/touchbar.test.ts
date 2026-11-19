/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import type { TouchBarPresence } from "../../types/peripherals";
import { lookup } from "../../i18n/translate.ts";
import { hasMeasuredProof, outcomeLabelKey, shouldRecordCancel, toCheckStatus } from "./outcome.ts";
import {
  ESCAPE_CODE,
  FN_KEY_CODES,
  TOUCHBAR_CHECKS,
  TOUCHBAR_LIMITATIONS,
  TOUCHBAR_SEGMENTS,
  allChecksAnswered,
  assessTouchBar,
  attachFnKeyCapture,
  cancelledTouchBar,
  emptyChecks,
  emptyFnKeys,
  emptySegments,
  isTrackedKeyCode,
  missingFnKeys,
  noTouchBarResult,
  presenceInfo,
  receivedFnKeys,
  recordKey,
  recordTap,
  segmentLabel,
  tappedCount,
  untappedSegments,
  type CheckAnswers,
  type FnKeyState,
  type PresenceInfo,
  type SegmentState,
  type TouchBarAnswer,
} from "./touchbar.ts";

const PRESENT: PresenceInfo = { present: true, experimental: false };
const UNKNOWN: PresenceInfo = { present: null, experimental: false };
const ALL_OK: CheckAnswers = { evenLit: "ok", noDeadArea: "ok", fullWidth: "ok" };
const NONE_CHECKED: CheckAnswers = { evenLit: "notChecked", noDeadArea: "notChecked", fullWidth: "notChecked" };

function tapAll(total = TOUCHBAR_SEGMENTS): SegmentState {
  let s = emptySegments(total);
  for (let i = 0; i < total; i++) s = recordTap(s, i);
  return s;
}

function tapOnly(indices: number[], total = TOUCHBAR_SEGMENTS): SegmentState {
  return indices.reduce((s, i) => recordTap(s, i), emptySegments(total));
}

function keys(codes: string[]): FnKeyState {
  return codes.reduce((s, c) => recordKey(s, c), emptyFnKeys());
}

function answer(overrides: Partial<TouchBarAnswer> = {}): TouchBarAnswer {
  return {
    presence: PRESENT,
    nativeStarted: true,
    segments: tapAll(),
    barNotShown: false,
    reportUntappedAsBroken: false,
    macosVisible: null,
    fnKeys: keys(FN_KEY_CODES),
    checks: ALL_OK,
    durationMs: 1000,
    finishedAt: "2026-11-19T00:00:00.000Z",
    ...overrides,
  };
}

const codes = (r: InteractiveResult) => r.evidence.map((e) => e.code);
const find = (r: InteractiveResult, code: string): Evidence | undefined => r.evidence.find((e) => e.code === code);

// --- Keberadaan hardware ------------------------------------------------------

function hw(presence: TouchBarPresence["presence"], experimental = false): TouchBarPresence {
  return { presence, evidence: [], experimental, error: null };
}

test("presenceInfo: bukti hardware, eksperimental tidak pernah memblokir", () => {
  assert.deepEqual(presenceInfo(null), { present: null, experimental: false });
  assert.deepEqual(presenceInfo(undefined), { present: null, experimental: false });
  assert.deepEqual(presenceInfo(hw("present")), { present: true, experimental: false });
  assert.deepEqual(presenceInfo(hw("absent")), { present: false, experimental: false });
  assert.deepEqual(presenceInfo(hw("unknown")), { present: null, experimental: false });
  assert.deepEqual(presenceInfo(hw("absent", true)), { present: null, experimental: true }, "absen eksperimental = tidak diketahui");
  assert.deepEqual(presenceInfo(hw("present", true)), { present: true, experimental: true });
});

test("tanpa Touch Bar (bukti hardware): Tidak tersedia, tidak pernah Sehat", () => {
  const r = assessTouchBar(answer({ presence: { present: false, experimental: false } }));
  assert.equal(r.id, "touchBar");
  assert.equal(r.outcome, "unavailable");
  assert.equal(r.summaryCode, "touchBarResult.noTouchBar");
  assert.deepEqual(r.evidence, [{ kind: "measured", level: "info", code: "touchBarResult.presenceAbsent" }]);
  assert.equal(toCheckStatus(r.outcome), "unknown");
  assert.deepEqual(noTouchBarResult().limitations, TOUCHBAR_LIMITATIONS);
});

test("keberadaan eksperimental hanya informasi", () => {
  const r = assessTouchBar(answer({ presence: { present: true, experimental: true } }));
  assert.equal(find(r, "touchBarResult.presenceDetected")?.experimental, true);
  assert.equal(r.outcome, "passed");
  const u = assessTouchBar(answer({ presence: UNKNOWN }));
  assert.ok(codes(u).includes("touchBarResult.presenceUnknown"));
  assert.equal(u.outcome, "passed", "tidak diketahui tetap boleh diuji");
});

// --- Pembukuan segmen -----------------------------------------------------------

test("segmen: ketukan dicatat tanpa mutasi, indeks tidak sah diabaikan", () => {
  const empty = emptySegments(8);
  assert.deepEqual(empty.taps, [0, 0, 0, 0, 0, 0, 0, 0]);
  const once = recordTap(empty, 2);
  assert.deepEqual(empty.taps, [0, 0, 0, 0, 0, 0, 0, 0], "state lama tidak berubah");
  const twice = recordTap(once, 2);
  assert.equal(twice.taps[2], 2);
  assert.equal(tappedCount(twice), 1);
  for (const bad of [-1, 8, 99, 1.5, Number.NaN]) {
    assert.equal(recordTap(twice, bad), twice, `indeks ${bad}`);
  }
  assert.deepEqual(untappedSegments(twice), [0, 1, 3, 4, 5, 6, 7]);
  assert.equal(segmentLabel(0), "1");
  assert.equal(segmentLabel(7), "8");
  assert.equal(emptySegments(0).total, TOUCHBAR_SEGMENTS, "jumlah tidak sah → bawaan");
  assert.equal(tappedCount(tapAll()), TOUCHBAR_SEGMENTS);
  assert.deepEqual(untappedSegments(tapAll()), []);
});

// --- Pembukuan tombol F -------------------------------------------------------------

test("tombol F: hanya F1–F12 dan Esc yang dicatat", () => {
  assert.equal(FN_KEY_CODES.length, 12);
  assert.equal(FN_KEY_CODES[0], "F1");
  assert.equal(FN_KEY_CODES[11], "F12");
  for (const code of [...FN_KEY_CODES, ESCAPE_CODE]) assert.ok(isTrackedKeyCode(code), code);
  for (const code of ["F13", "KeyA", "Digit1", "Space", "", "f1"]) assert.ok(!isTrackedKeyCode(code), code);

  let s = emptyFnKeys();
  s = recordKey(s, "F1");
  s = recordKey(s, "F1");
  s = recordKey(s, "F12");
  s = recordKey(s, "KeyA");
  s = recordKey(s, ESCAPE_CODE);
  assert.deepEqual(s.counts, { F1: 2, F12: 1 });
  assert.equal(s.escape, 1);
  assert.deepEqual(receivedFnKeys(s), ["F1", "F12"]);
  assert.deepEqual(missingFnKeys(s), ["F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11"]);
  assert.deepEqual(emptyFnKeys(), { counts: {}, escape: 0 }, "tanpa mutasi");
});

test("attachFnKeyCapture: fase capture, hanya `code`, auto-repeat diabaikan, bisa dilepas", () => {
  const target = new EventTarget();
  const seen: string[] = [];
  let keyRead = false;
  const fire = (code: string, repeat = false): Event => {
    const ev = new Event("keydown", { cancelable: true });
    Object.defineProperty(ev, "code", { value: code });
    Object.defineProperty(ev, "repeat", { value: repeat });
    Object.defineProperty(ev, "key", {
      get() {
        keyRead = true;
        return "x";
      },
    });
    target.dispatchEvent(ev);
    return ev;
  };
  const detach = attachFnKeyCapture(target, (code) => seen.push(code));

  assert.equal(fire("F5").defaultPrevented, true, "F-key dicegah aksi bawaannya");
  assert.equal(fire("F5", true).defaultPrevented, true, "repeat juga dicegah");
  assert.equal(fire("Escape").defaultPrevented, true);
  assert.equal(fire("KeyA").defaultPrevented, false, "tombol lain tidak disentuh");
  assert.equal(fire("Tab").defaultPrevented, false);
  assert.deepEqual(seen, ["F5", "Escape"], "repeat tidak dihitung");
  assert.equal(keyRead, false, "KeyboardEvent.key (teks) tidak pernah dibaca");

  detach();
  fire("F6");
  assert.deepEqual(seen, ["F5", "Escape"], "listener sudah dilepas");
});

// --- Penilaian ----------------------------------------------------------------------

test("semua segmen + tombol F diterima + tampilan baik = Lulus dengan bukti terukur", () => {
  const r = assessTouchBar(answer({ macosVisible: true }));
  assert.equal(r.outcome, "passed");
  assert.equal(r.summaryCode, "touchBarResult.passed");
  assert.ok(hasMeasuredProof(r.evidence));
  assert.equal(outcomeLabelKey(r), "outcome.passed");
  assert.deepEqual(find(r, "touchBarResult.segmentsTapped"), {
    kind: "measured",
    level: "ok",
    code: "touchBarResult.segmentsTapped",
    params: { tapped: 8, total: 8 },
  });
  assert.equal(find(r, "touchBarResult.fnReceived")?.level, "ok");
  assert.ok(!codes(r).includes("touchBarResult.fnMissing"));
  for (const check of TOUCHBAR_CHECKS) {
    const e = find(r, check.okResult);
    assert.equal(e?.kind, "userConfirmed", check.id);
    assert.equal(e?.level, "ok", check.id);
  }
  const visible = find(r, "touchBarResult.macosVisible");
  assert.equal(visible?.experimental, true, "isVisible macOS = eksperimental");
  assert.equal(visible?.level, "info");
  assert.equal(r.durationMs, 1000);
  assert.deepEqual(r.limitations, TOUCHBAR_LIMITATIONS);
});

test("segmen sebagian: info, bukan kegagalan, kecuali pengguna melaporkan tidak merespons", () => {
  const partial = assessTouchBar(answer({ segments: tapOnly([0, 1, 2, 3, 4, 5]) }));
  assert.equal(find(partial, "touchBarResult.segmentsTapped")?.level, "info");
  assert.equal(partial.outcome, "passed", "segmen yang dilewati tidak dianggap rusak");

  const broken = assessTouchBar(answer({ segments: tapOnly([0, 1, 2, 3, 4, 5]), reportUntappedAsBroken: true }));
  assert.equal(broken.outcome, "failed");
  assert.equal(broken.summaryCode, "touchBarResult.failed");
  assert.deepEqual(broken.summaryParams, { n: 1 });
  assert.deepEqual(find(broken, "touchBarResult.segmentsNoResponse"), {
    kind: "userConfirmed",
    level: "critical",
    code: "touchBarResult.segmentsNoResponse",
    params: { segments: ["7", "8"] },
  });
  assert.equal(toCheckStatus(broken.outcome), "critical");
});

test("tidak ada ketukan tetapi pengguna menyatakan tombol uji tampil dan tidak merespons = Gagal", () => {
  const r = assessTouchBar(answer({ segments: emptySegments(), reportUntappedAsBroken: true }));
  assert.equal(r.outcome, "failed");
  assert.deepEqual(find(r, "touchBarResult.segmentsNoResponse")?.params, {
    segments: ["1", "2", "3", "4", "5", "6", "7", "8"],
  });
});

test("tombol uji tidak tampil = keterbatasan API (info), bukan kerusakan", () => {
  const r = assessTouchBar(answer({ segments: emptySegments(), barNotShown: true, fnKeys: keys(["F1", "F2"]) }));
  assert.deepEqual(find(r, "touchBarResult.barNotShown"), {
    kind: "measured",
    level: "info",
    code: "touchBarResult.barNotShown",
  });
  assert.ok(!codes(r).includes("touchBarResult.segmentsTapped"));
  assert.equal(r.outcome, "passed");
  assert.ok(!r.evidence.some((e) => e.level === "critical"));

  // Laporan "tidak merespons" tidak bisa kritis bila tombol uji tidak pernah tampil.
  const contradictory = assessTouchBar(
    answer({ segments: emptySegments(), barNotShown: true, reportUntappedAsBroken: true }),
  );
  assert.ok(!codes(contradictory).includes("touchBarResult.segmentsNoResponse"));
});

test("native tidak tersedia (mis. mode browser): info, area sentuh tidak diukur", () => {
  const r = assessTouchBar(answer({ nativeStarted: false, segments: emptySegments(), macosVisible: true }));
  assert.ok(codes(r).includes("touchBarResult.nativeUnavailable"));
  assert.ok(!codes(r).includes("touchBarResult.macosVisible"), "status macOS hanya bila native berjalan");
  assert.equal(r.outcome, "passed", "masih ada tombol F dan konfirmasi pengguna");
});

test("tombol F yang tidak sampai = info keterbatasan macOS, tidak pernah gagal", () => {
  const missingF11 = FN_KEY_CODES.filter((c) => c !== "F11");
  const r = assessTouchBar(answer({ fnKeys: keys(missingF11) }));
  assert.deepEqual(find(r, "touchBarResult.fnReceived")?.params, { received: 11, total: 12 });
  assert.equal(find(r, "touchBarResult.fnReceived")?.level, "ok");
  assert.deepEqual(find(r, "touchBarResult.fnMissing"), {
    kind: "measured",
    level: "info",
    code: "touchBarResult.fnMissing",
    params: { keys: ["F11"] },
  });
  assert.equal(r.outcome, "passed");

  const none = assessTouchBar(answer({ fnKeys: emptyFnKeys() }));
  assert.equal(find(none, "touchBarResult.fnReceived")?.level, "info");
  assert.ok(!codes(none).includes("touchBarResult.fnMissing"), "tidak mendaftar 12 tombol saat bagian dilewati");

  const esc = assessTouchBar(answer({ fnKeys: keys(["F1", ESCAPE_CODE]) }));
  assert.ok(codes(esc).includes("touchBarResult.escReceived"));
});

test("area mati / tidak merespons = kritis bila tampilan terkonfirmasi; cahaya tidak merata = peringatan", () => {
  const dead = assessTouchBar(answer({ checks: { ...ALL_OK, noDeadArea: "problem" } }));
  assert.equal(find(dead, "touchBarResult.deadAreaProblem")?.level, "critical");
  assert.equal(find(dead, "touchBarResult.deadAreaProblem")?.kind, "userConfirmed");
  assert.equal(dead.outcome, "failed");

  const width = assessTouchBar(answer({ checks: { ...ALL_OK, fullWidth: "problem" } }));
  assert.equal(find(width, "touchBarResult.fullWidthProblem")?.level, "critical");
  assert.equal(width.outcome, "failed");

  const dim = assessTouchBar(answer({ checks: { ...ALL_OK, evenLit: "problem" } }));
  assert.equal(find(dim, "touchBarResult.evenLitProblem")?.level, "warning");
  assert.equal(dim.outcome, "passed", "peringatan tidak menggagalkan");

  // Tampilan terkonfirmasi lewat tombol F walau tombol uji tidak tampil.
  const viaFn = assessTouchBar(
    answer({ segments: emptySegments(), barNotShown: true, fnKeys: keys(["F3"]), checks: { ...ALL_OK, noDeadArea: "problem" } }),
  );
  assert.equal(find(viaFn, "touchBarResult.deadAreaProblem")?.level, "critical");
});

test("laporan masalah tanpa tampilan terkonfirmasi diturunkan ke peringatan", () => {
  const r = assessTouchBar(
    answer({
      segments: emptySegments(),
      barNotShown: true,
      fnKeys: emptyFnKeys(),
      checks: { evenLit: "notChecked", noDeadArea: "problem", fullWidth: "notChecked" },
    }),
  );
  assert.equal(find(r, "touchBarResult.deadAreaProblem")?.level, "warning");
  assert.ok(codes(r).includes("touchBarResult.problemUnconfirmed"));
  assert.equal(r.outcome, "unavailable", "tanpa bukti positif: tidak pernah Lulus");
  assert.equal(r.summaryCode, "touchBarResult.noEvidence");
});

test("tanpa bukti positif sama sekali: Tidak tersedia, bukan Lulus", () => {
  const r = assessTouchBar(
    answer({
      presence: UNKNOWN,
      nativeStarted: false,
      segments: emptySegments(),
      fnKeys: emptyFnKeys(),
      checks: NONE_CHECKED,
    }),
  );
  assert.equal(r.outcome, "unavailable");
  assert.equal(r.summaryCode, "touchBarResult.noEvidence");
  assert.equal(toCheckStatus(r.outcome), "unknown");
});

test("hanya konfirmasi pengguna = Lulus berlabel dikonfirmasi pengguna", () => {
  const r = assessTouchBar(
    answer({ segments: emptySegments(), barNotShown: true, fnKeys: emptyFnKeys(), checks: ALL_OK }),
  );
  assert.equal(r.outcome, "passed");
  assert.ok(!hasMeasuredProof(r.evidence));
  assert.equal(outcomeLabelKey(r), "outcome.passedUserConfirmed");
});

test("eksperimental tidak mengubah hasil", () => {
  const hidden = assessTouchBar(answer({ macosVisible: false }));
  assert.equal(find(hidden, "touchBarResult.macosHidden")?.experimental, true);
  assert.equal(hidden.outcome, "passed");
});

test("Bagian 3 wajib dijawab semua (termasuk 'Tidak dicek')", () => {
  assert.equal(allChecksAnswered(emptyChecks()), false);
  assert.equal(allChecksAnswered({ ...emptyChecks(), evenLit: "ok", noDeadArea: "ok" }), false);
  assert.equal(allChecksAnswered(NONE_CHECKED), true);
  assert.equal(allChecksAnswered(ALL_OK), true);
});

test("batal: Dibatalkan dengan progres, tidak menimpa hasil selesai sebelumnya", () => {
  const r = cancelledTouchBar({ tapped: 3, total: 8, fnReceived: 5 });
  assert.equal(r.id, "touchBar");
  assert.equal(r.outcome, "cancelled");
  assert.equal(r.summaryCode, "touchBarResult.cancelled");
  assert.deepEqual(r.summaryParams, { tapped: 3, total: 8, received: 5, fnTotal: 12 });
  assert.deepEqual(r.evidence, []);
  assert.deepEqual(r.limitations, TOUCHBAR_LIMITATIONS);
  assert.equal(shouldRecordCancel(assessTouchBar(answer())), false);
  assert.equal(shouldRecordCancel(undefined), true);
});

test("semua kunci hasil, bukti, pertanyaan, dan keterbatasan ada dalam dua bahasa", () => {
  const samples = [
    assessTouchBar(answer({ macosVisible: true, fnKeys: keys(["F1", ESCAPE_CODE]) })),
    assessTouchBar(answer({ macosVisible: false, segments: tapOnly([0]), reportUntappedAsBroken: true })),
    assessTouchBar(answer({ segments: emptySegments(), barNotShown: true, fnKeys: emptyFnKeys(), checks: { evenLit: "problem", noDeadArea: "problem", fullWidth: "problem" } })),
    assessTouchBar(answer({ nativeStarted: false, presence: UNKNOWN, segments: emptySegments(), checks: NONE_CHECKED })),
    noTouchBarResult(),
    cancelledTouchBar({ tapped: 0, total: 8, fnReceived: 0 }),
  ];
  const keysUsed = new Set<string>([
    ...TOUCHBAR_LIMITATIONS,
    ...TOUCHBAR_CHECKS.flatMap((c) => [c.question, c.okResult, c.problemResult]),
    ...samples.flatMap((r) => [r.summaryCode, ...codes(r)]),
  ]);
  for (const key of keysUsed) {
    assert.ok(lookup("id-ID", key), `id hilang: ${key}`);
    assert.ok(lookup("en-US", key), `en hilang: ${key}`);
  }
});
