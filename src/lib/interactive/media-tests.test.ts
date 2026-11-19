/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMERA_HOLD_MS,
  cameraResult,
  cancelledMediaTest,
  meterSegments,
  microphoneResult,
  parseSessionReport,
  rmsToDbfs,
} from "./media-tests.ts";
import { outcomeLabelKey } from "./outcome.ts";

const cleanCamera = {
  acquired: true,
  tracks: [{ kind: "video", readyState: "live", width: 1280, height: 720, frameRate: 30, sampleRate: null, channelCount: null }],
  stop: { reason: "user", how: "tombol", heldMs: 4000 },
  allTracksEnded: true,
  gateAfterRelease: { open: false, camera: false, microphone: false, remainingSecs: 0 },
  activeSessionsAfterRelease: 0,
  measured: { framesRendered: 118, frameCountSupported: true },
  afterRelease: null,
};

const cleanMic = {
  acquired: true,
  tracks: [{ kind: "audio", readyState: "live", width: null, height: null, frameRate: null, sampleRate: 48000, channelCount: 1 }],
  stop: { reason: "timeout" },
  allTracksEnded: true,
  gateAfterRelease: { open: false },
  activeSessionsAfterRelease: 0,
  measured: { peakDbfs: -18.4, recordedMs: 5000, recorderSupported: true },
  afterRelease: { played: true },
};

test("batas waktu kamera tidak melebihi batas Rust (10 dtk)", () => {
  assert.ok(CAMERA_HOLD_MS <= 10_000);
});

test("laporan jendela media dibaca defensif (bentuk rusak tidak membuat crash)", () => {
  const r = parseSessionReport("bukan objek");
  assert.equal(r.acquired, false);
  assert.deepEqual(r.tracks, []);
  assert.equal(parseSessionReport(cleanCamera).framesRendered, 118);
  assert.equal(parseSessionReport(cleanCamera).gateClosedAfter, true);
});

test("kamera: frame terukur + gambar jelas → Lulus dengan bukti terukur", () => {
  const r = cameraResult(parseSessionReport(cleanCamera), "clear", "on");
  assert.equal(r.outcome, "passed");
  assert.equal(outcomeLabelKey(r), "outcome.passed", "ada bukti terukur, bukan 'dikonfirmasi pengguna' saja");
  assert.ok(r.evidence.some((e) => e.code === "camera.evidence.frames" && e.kind === "measured"));
  assert.ok(r.evidence.some((e) => e.code === "camera.answer.image.clear" && e.kind === "userConfirmed"));
});

test("kamera: tanpa frame atau gambar rusak → Gagal; buram/lampu mati hanya catatan", () => {
  assert.equal(cameraResult(parseSessionReport({ ...cleanCamera, measured: { framesRendered: 0, frameCountSupported: true } }), "clear", "on").outcome, "failed");
  assert.equal(cameraResult(parseSessionReport(cleanCamera), "artifacts", "on").outcome, "failed");
  assert.equal(cameraResult(parseSessionReport(cleanCamera), "none", "on").outcome, "failed");
  assert.equal(cameraResult(parseSessionReport(cleanCamera), "blurry", "off").outcome, "passed");
  const unsupported = cameraResult(parseSessionReport({ ...cleanCamera, measured: {} }), "clear", "notNoticed");
  assert.equal(unsupported.outcome, "passed");
  assert.ok(unsupported.evidence.some((e) => e.code === "camera.evidence.framesUnsupported" && e.level === "info"));
});

test("izin ditolak / sedang dipakai = Tidak tersedia; tidak ditemukan = Gagal", () => {
  assert.equal(cameraResult(parseSessionReport({ acquired: false, failure: "denied" }), "clear", "on").outcome, "unavailable");
  assert.equal(cameraResult(parseSessionReport({ acquired: false, failure: "busy" }), "clear", "on").outcome, "unavailable");
  assert.equal(cameraResult(parseSessionReport({ acquired: false, failure: "notFound" }), "clear", "on").outcome, "failed");
  assert.equal(microphoneResult(parseSessionReport({ acquired: false, failure: "denied" }), "clear").outcome, "unavailable");
  assert.equal(microphoneResult(parseSessionReport({ acquired: false, failure: "gate" }), "clear").outcome, "unavailable");
});

test("perangkat/gerbang tidak tertutup setelah tes → Gagal (keamanan)", () => {
  const leaky = parseSessionReport({ ...cleanCamera, allTracksEnded: false });
  assert.equal(cameraResult(leaky, "clear", "on").outcome, "failed");
  const gateOpen = parseSessionReport({ ...cleanMic, gateAfterRelease: { open: true } });
  assert.equal(microphoneResult(gateOpen, "clear").outcome, "failed");
});

test("mikrofon: level puncak eksperimental tidak mengubah hasil; tidak terdengar → Gagal", () => {
  const quiet = parseSessionReport({ ...cleanMic, measured: { peakDbfs: -80, recordedMs: 5000, recorderSupported: true } });
  const r = microphoneResult(quiet, "clear");
  assert.equal(r.outcome, "passed");
  const peak = r.evidence.find((e) => e.code === "microphone.evidence.peakQuiet");
  assert.ok(peak && peak.experimental === true && peak.level === "info");
  assert.equal(microphoneResult(parseSessionReport(cleanMic), "none").outcome, "failed");
  assert.equal(microphoneResult(parseSessionReport(cleanMic), "faint").outcome, "passed");
  assert.equal(microphoneResult(parseSessionReport(cleanMic), "couldNotPlay").outcome, "passed");
});

test("mikrofon tanpa perekam: tetap ada bukti stream aktif, dicatat tanpa rekaman", () => {
  const r = microphoneResult(parseSessionReport({ ...cleanMic, measured: { recorderSupported: false } }), "couldNotPlay");
  assert.ok(r.evidence.some((e) => e.code === "microphone.evidence.noRecorder"));
  assert.ok(r.evidence.some((e) => e.code === "microphone.evidence.active"));
});

test("batal → Dibatalkan, tanpa bukti", () => {
  assert.equal(cancelledMediaTest("camera").outcome, "cancelled");
  assert.deepEqual(cancelledMediaTest("microphone").evidence, []);
});

test("konversi level: RMS → dBFS dan segmen meter", () => {
  assert.equal(rmsToDbfs(1), 0);
  assert.equal(rmsToDbfs(0), -100);
  assert.equal(Math.round(rmsToDbfs(0.1)), -20);
  assert.equal(meterSegments(0), 20);
  assert.equal(meterSegments(-60), 0);
  assert.equal(meterSegments(-90), 0);
  assert.equal(meterSegments(-30), 10);
});
