/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  acquireMedia,
  activeSessionCount,
  allTracksEnded,
  buildConstraints,
  classifyMediaError,
  installMediaSafetyNet,
  releaseAllMedia,
  type MediaDeps,
  type StreamLike,
  type TrackLike,
} from "./session.ts";

// Palsu KHUSUS TEST — bukan perangkat asli.
class FakeTrack implements TrackLike {
  readyState = "live";
  stops = 0;
  readonly kind: string;
  constructor(kind: string) {
    this.kind = kind;
  }
  stop() {
    this.stops += 1;
    this.readyState = "ended";
  }
}
class FakeStream implements StreamLike {
  readonly tracks: FakeTrack[];
  constructor(...tracks: FakeTrack[]) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
}

interface Log {
  calls: string[];
  constraints: MediaStreamConstraints[];
  timers: { fn: () => void; ms: number; cleared: boolean }[];
}

function deps(
  behaviour: { stream?: FakeStream; error?: unknown; unsupported?: boolean; gateFails?: boolean } = {},
): { d: MediaDeps<FakeStream>; log: Log } {
  const log: Log = { calls: [], constraints: [], timers: [] };
  const d: MediaDeps<FakeStream> = {
    getUserMedia: behaviour.unsupported
      ? null
      : async (c) => {
          log.calls.push("getUserMedia");
          log.constraints.push(c);
          if (behaviour.error) throw behaviour.error;
          return behaviour.stream ?? new FakeStream(new FakeTrack("video"));
        },
    openGate: async (camera, microphone) => {
      log.calls.push(`open:${camera}:${microphone}`);
      if (behaviour.gateFails) throw new Error("gate");
    },
    closeGate: async () => {
      log.calls.push("close");
    },
    setTimer: (fn, ms) => {
      const t = { fn, ms, cleared: false };
      log.timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { cleared: boolean }).cleared = true;
    },
  };
  return { d, log };
}

const named = (name: string) => Object.assign(new Error(name), { name });

test("tanpa getUserMedia: tidak membuka gerbang", async () => {
  const { d, log } = deps({ unsupported: true });
  const r = await acquireMedia({ camera: true, microphone: false }, d);
  assert.deepEqual(r, { ok: false, failure: "unsupported" });
  assert.deepEqual(log.calls, []);
});

test("tidak meminta apa pun bila tidak ada jenis yang dipilih", async () => {
  const { d, log } = deps();
  const r = await acquireMedia({ camera: false, microphone: false }, d);
  assert.equal(r.ok, false);
  assert.deepEqual(log.calls, []);
});

test("gerbang dibuka tepat sebelum dan ditutup tepat setelah permintaan", async () => {
  const { d, log } = deps();
  const r = await acquireMedia({ camera: true, microphone: false }, d);
  assert.equal(r.ok, true);
  assert.deepEqual(log.calls, ["open:true:false", "getUserMedia", "close"]);
  if (r.ok) await r.session.release();
});

test("hanya jenis yang diminta yang masuk constraint", async () => {
  assert.deepEqual(buildConstraints({ camera: true, microphone: false }), {
    video: true,
    audio: false,
  });
  assert.deepEqual(buildConstraints({ camera: false, microphone: true }), {
    video: false,
    audio: true,
  });
  const { d, log } = deps();
  const r = await acquireMedia({ camera: false, microphone: true }, d, {
    audio: { echoCancellation: false },
  });
  assert.deepEqual(log.constraints[0], { video: false, audio: { echoCancellation: false } });
  if (r.ok) await r.session.release();
});

test("izin ditolak: gerbang tetap ditutup dan alasan diklasifikasi", async () => {
  const { d, log } = deps({ error: named("NotAllowedError") });
  const r = await acquireMedia({ camera: true, microphone: true }, d);
  assert.deepEqual(r, { ok: false, failure: "denied", errorName: "NotAllowedError" });
  assert.equal(log.calls[log.calls.length - 1], "close");
  assert.equal(activeSessionCount(), 0);
});

test("gerbang gagal dibuka: getUserMedia tidak dipanggil", async () => {
  const { d, log } = deps({ gateFails: true });
  const r = await acquireMedia({ camera: true, microphone: false }, d);
  assert.deepEqual(r, { ok: false, failure: "gate" });
  assert.ok(!log.calls.includes("getUserMedia"));
});

test("release menghentikan semua track, idempoten, dan membatalkan timer", async () => {
  const v = new FakeTrack("video");
  const a = new FakeTrack("audio");
  const { d, log } = deps({ stream: new FakeStream(v, a) });
  const r = await acquireMedia({ camera: true, microphone: true }, d);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(activeSessionCount(), 1);
  assert.equal(allTracksEnded(r.session.stream), false);
  await r.session.release();
  await r.session.release();
  assert.equal(v.stops, 1);
  assert.equal(a.stops, 1);
  assert.ok(allTracksEnded(r.session.stream));
  assert.ok(r.session.released);
  assert.equal(log.timers[0].cleared, true);
  assert.equal(activeSessionCount(), 0);
});

test("batas waktu sesi menghentikan track otomatis", async () => {
  const v = new FakeTrack("video");
  const { d, log } = deps({ stream: new FakeStream(v) });
  const r = await acquireMedia({ camera: true, microphone: false }, d, {}, 5_000);
  assert.ok(r.ok);
  assert.equal(log.timers[0].ms, 5_000);
  log.timers[0].fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(v.readyState, "ended");
  assert.equal(activeSessionCount(), 0);
});

test("track yang melempar saat stop tidak menghalangi track lain", async () => {
  const bad: TrackLike = {
    kind: "video",
    readyState: "live",
    stop() {
      throw new Error("sudah berhenti");
    },
  };
  const good = new FakeTrack("audio");
  const stream: StreamLike = { getTracks: () => [bad, good] };
  const { d } = deps({ stream: stream as FakeStream });
  const r = await acquireMedia({ camera: true, microphone: true }, d);
  assert.ok(r.ok);
  if (r.ok) await r.session.release();
  assert.equal(good.readyState, "ended");
});

test("jaring pengaman: pagehide menghentikan semua sesi, listener bisa dilepas", async () => {
  const target = new EventTarget();
  const uninstall = installMediaSafetyNet(target);
  const v1 = new FakeTrack("video");
  const v2 = new FakeTrack("audio");
  const r1 = await acquireMedia({ camera: true, microphone: false }, deps({ stream: new FakeStream(v1) }).d);
  const r2 = await acquireMedia({ camera: false, microphone: true }, deps({ stream: new FakeStream(v2) }).d);
  assert.ok(r1.ok && r2.ok);
  assert.equal(activeSessionCount(), 2);
  target.dispatchEvent(new Event("pagehide"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(v1.readyState, "ended");
  assert.equal(v2.readyState, "ended");
  assert.equal(activeSessionCount(), 0);

  uninstall();
  const v3 = new FakeTrack("video");
  const r3 = await acquireMedia({ camera: true, microphone: false }, deps({ stream: new FakeStream(v3) }).d);
  target.dispatchEvent(new Event("pagehide"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(v3.readyState, "live", "listener sudah dilepas");
  await releaseAllMedia();
  assert.equal(v3.readyState, "ended");
  assert.ok(r3.ok);
});

test("klasifikasi error getUserMedia", () => {
  assert.equal(classifyMediaError(named("NotAllowedError")).failure, "denied");
  assert.equal(classifyMediaError(named("SecurityError")).failure, "denied");
  assert.equal(classifyMediaError(named("NotFoundError")).failure, "notFound");
  assert.equal(classifyMediaError(named("NotReadableError")).failure, "busy");
  assert.equal(classifyMediaError(named("TypeError")).failure, "unsupported");
  assert.equal(classifyMediaError("x").failure, "other");
});
