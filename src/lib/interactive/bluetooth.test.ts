/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence } from "../../types/interactive";
import type { BluetoothReport } from "../../types/peripherals";
import { translate } from "../../i18n/translate.ts";
import { hasMeasuredProof } from "./outcome.ts";
import {
  BLUETOOTH_LIMITATIONS,
  assessBluetooth,
  bluetoothEvidence,
  cancelledBluetooth,
  deviceTypeParam,
} from "./bluetooth.ts";

const META = { durationMs: 900, finishedAt: "2026-11-19T10:00:00.000Z" };

/** Laporan contoh (BUKAN data perangkat asli). */
function report(overrides: Partial<BluetoothReport> = {}): BluetoothReport {
  return {
    state: "on",
    chipset: "BCM_4364B3",
    firmware: "v91 c4211",
    transport: "UART",
    vendorId: "0x004C (Apple)",
    discoverable: false,
    services: ["A2DP", "HID"],
    connectedCount: 0,
    connectedTypes: [],
    pairedNotConnected: 0,
    error: null,
    ...overrides,
  };
}

const codes = (ev: Evidence[]) => ev.map((e) => e.code);
const text = (e: Evidence, lang: "id-ID" | "en-US" = "id-ID") => translate(lang, e.code, e.params);

test("pengontrol aktif: terukur ok, tanpa perangkat tetap Lulus", () => {
  const r = assessBluetooth(report(), "notAnswered", META);
  assert.equal(r.id, "bluetooth");
  assert.equal(r.outcome, "passed");
  assert.ok(hasMeasuredProof(r.evidence));
  assert.deepEqual(codes(r.evidence), ["bluetoothResult.on", "bluetoothResult.controllerDetails", "bluetoothResult.noneConnected"]);
  assert.equal(text(r.evidence[0]), "Pengontrol Bluetooth aktif (chipset BCM_4364B3).");
  assert.deepEqual(r.limitations, BLUETOOTH_LIMITATIONS);
});

test("perangkat tersambung hanya jumlah + jenis (diterjemahkan bila dikenal)", () => {
  const r = assessBluetooth(
    report({ connectedCount: 3, connectedTypes: ["Headphones", null, "Joystick"], pairedNotConnected: 2 }),
    "notAnswered",
    META,
  );
  const connected = r.evidence.find((e) => e.code === "bluetoothResult.connected") as Evidence;
  assert.equal(text(connected), "3 perangkat tersambung: headphone, jenis tidak diketahui, Joystick.");
  assert.equal(text(connected, "en-US"), "3 device(s) connected: headphones, unknown type, Joystick.");
  assert.ok(codes(r.evidence).includes("bluetoothResult.paired"));
  assert.equal(r.summaryParams?.n, 3);
});

test("jenis perangkat: kunci dikenal, nilai mentah, dan kosong", () => {
  assert.equal(deviceTypeParam("Keyboard"), "@bluetooth.type.keyboard");
  assert.equal(deviceTypeParam(" headset "), "@bluetooth.type.headphones");
  assert.equal(deviceTypeParam("Pen"), "Pen");
  assert.equal(deviceTypeParam(null), "@bluetooth.type.unknown");
});

test("Bluetooth dimatikan: Tidak tersedia + instruksi, pengontrol tetap tercatat", () => {
  const r = assessBluetooth(report({ state: "off" }), "works", META);
  assert.equal(r.outcome, "unavailable");
  assert.equal(r.summaryCode, "bluetoothResult.offSummary");
  assert.deepEqual(codes(r.evidence), ["bluetoothResult.controllerFoundOff"]);
  assert.ok(!r.evidence.some((e) => e.kind === "userConfirmed"));
});

test("pengontrol tidak ditemukan: Gagal dengan catatan kehati-hatian", () => {
  const r = assessBluetooth(report({ state: "noController", chipset: null }), "notAnswered", META);
  assert.equal(r.outcome, "failed");
  assert.deepEqual(codes(r.evidence), ["bluetoothResult.noController", "bluetoothResult.noControllerCaveat"]);
});

test("gagal membaca: Tidak tersedia", () => {
  const r = assessBluetooth(report({ state: "unknown", error: "system_profiler: x" }), "notAnswered", META);
  assert.equal(r.outcome, "unavailable");
  assert.equal(text(r.evidence[0], "en-US"), "The Bluetooth status could not be read (system_profiler: x).");
  assert.equal(assessBluetooth(null, "works", META, "invoke gagal").outcome, "unavailable");
  assert.equal(bluetoothEvidence(null)[0].params?.error, "—");
});

test("konfirmasi pengguna: ok atau catatan peringatan (tidak menggagalkan)", () => {
  const last = (ev: Evidence[]) => ev[ev.length - 1];
  const works = assessBluetooth(report(), "works", META);
  assert.equal(last(works.evidence).kind, "userConfirmed");
  assert.equal(last(works.evidence).level, "ok");
  const problem = assessBluetooth(report(), "problem", META);
  assert.equal(problem.outcome, "passed");
  assert.equal(last(problem.evidence).level, "warning");
});

test("dibatalkan dan teks dua bahasa", () => {
  const c = cancelledBluetooth();
  assert.equal(c.outcome, "cancelled");
  for (const r of [assessBluetooth(report(), "problem", META), c]) {
    for (const e of r.evidence) assert.notEqual(text(e, "en-US"), e.code);
    assert.notEqual(translate("en-US", r.summaryCode, r.summaryParams), r.summaryCode);
    for (const l of r.limitations) assert.notEqual(translate("en-US", l), l);
  }
});
