/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { startHold, type HoldTimers } from "./hold.ts";
import { securityViolations } from "./evaluate.ts";

// Timer palsu KHUSUS TEST.
function fakeTimers() {
  let now = 0;
  const pending: { fn: () => void; at: number; cleared: boolean }[] = [];
  const timers: HoldTimers = {
    setTimer: (fn, ms) => {
      const t = { fn, at: now + ms, cleared: false };
      pending.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { cleared: boolean }).cleared = true;
    },
    now: () => now,
  };
  const advance = (ms: number) => {
    now += ms;
    for (const t of pending) if (!t.cleared && t.at <= now) {
      t.cleared = true;
      t.fn();
    }
  };
  return { timers, advance, pending };
}

test("Hentikan sekarang: berhenti oleh pengguna sebelum batas waktu", async () => {
  const { timers, advance, pending } = fakeTimers();
  const hold = startHold(10_000, timers);
  advance(3_200);
  assert.equal(hold.stop("tombol"), true);
  assert.equal(pending[0].cleared, true, "timer batas waktu dibatalkan");
  const r = await hold.done;
  assert.deepEqual(r, { reason: "user", how: "tombol", heldMs: 3_200 });
  advance(10_000);
  assert.equal(hold.stop("esc"), false, "stop kedua diabaikan");
});

test("Batas waktu: berhenti otomatis tepat di batas, tombol sesudahnya diabaikan", async () => {
  const { timers, advance } = fakeTimers();
  const hold = startHold(10_000, timers);
  advance(9_999);
  assert.equal(hold.finished, false);
  advance(1);
  assert.equal(hold.finished, true);
  assert.equal(hold.stop("tombol"), false);
  assert.deepEqual(await hold.done, { reason: "timeout", how: undefined, heldMs: 10_000 });
});

const clean = {
  session: {
    acquired: true,
    allTracksEnded: true,
    gateAfterRelease: { open: false },
    activeSessionsAfterRelease: 0,
    probe: { sawMainProbe: false, sawPreviousMediaProbe: false },
  },
  gateAfter: { open: false },
  mediaWindowStillOpen: false,
  retryFromMain: { result: "rejected" },
  retryFromFreshWindow: {
    request: { result: "rejected" },
    gateOpenAttempt: { allowed: false },
    probe: { sawMainProbe: false, sawPreviousMediaProbe: false },
  },
  mainGateOpenAllowed: false,
  mainSawMediaProbe: false,
};

test("hasil bersih = tanpa pelanggaran", () => {
  assert.deepEqual(securityViolations(clean), []);
});

test("setiap pelanggaran isolasi terdeteksi", () => {
  const cases: [string, object][] = [
    ["jendela utama", { mainGateOpenAllowed: true }],
    ["gerbang terbuka", { gateAfter: { open: true } }],
    ["jendela tidak dihancurkan", { mediaWindowStillOpen: true }],
    ["track", { session: { ...clean.session, allTracksEnded: false } }],
    ["data store utama", { session: { ...clean.session, probe: { sawMainProbe: true, sawPreviousMediaProbe: false } } }],
    ["data store sesi lalu", { session: { ...clean.session, probe: { sawMainProbe: false, sawPreviousMediaProbe: true } } }],
    ["ulang dari utama", { retryFromMain: { result: "resolved" } }],
    ["ulang dari jendela baru", { retryFromFreshWindow: { ...clean.retryFromFreshWindow, request: { result: "resolved" } } }],
    ["gerbang jendela ulang", { retryFromFreshWindow: { ...clean.retryFromFreshWindow, gateOpenAttempt: { allowed: true } } }],
    ["utama baca media", { mainSawMediaProbe: true }],
  ];
  for (const [name, patch] of cases) {
    assert.equal(securityViolations({ ...clean, ...patch }).length, 1, name);
  }
});

test("jendela ditutup pengguna sebelum melapor tidak dianggap pelanggaran bila semua tertutup", () => {
  assert.deepEqual(
    securityViolations({ session: null, closedByUser: true, gateAfter: { open: false }, mediaWindowStillOpen: false }),
    [],
  );
});
