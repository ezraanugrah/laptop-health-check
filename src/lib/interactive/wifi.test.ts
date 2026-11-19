/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence } from "../../types/interactive";
import type { WifiReport } from "../../types/peripherals";
import { translate } from "../../i18n/translate.ts";
import { hasMeasuredProof, outcomeLabelKey } from "./outcome.ts";
import {
  RSSI_EXCELLENT,
  RSSI_FAIR,
  RSSI_GOOD,
  WIFI_LIMITATIONS,
  adapterOn,
  assessWifi,
  bandLabel,
  cancelledWifi,
  phyLabel,
  signalQuality,
  wifiEvidence,
} from "./wifi.ts";

const META = { durationMs: 1200, finishedAt: "2026-11-19T10:00:00.000Z" };

/** Laporan contoh (BUKAN data perangkat asli). */
function report(overrides: Partial<WifiReport> = {}): WifiReport {
  return {
    state: "connected",
    interfaceName: "en0",
    powerOn: true,
    serviceActive: true,
    rssiDbm: -47,
    noiseDbm: -95,
    snrDb: 48,
    transmitRateMbps: 144,
    phyMode: "11n",
    channelNumber: 13,
    channelBand: "2.4GHz",
    channelWidthMhz: 20,
    interfaceMode: "station",
    error: null,
    route: { state: "reported", interfaceCount: 1, wifiInterfaceListed: true, ipv4: true, ipv6: true, error: null },
    internetTest: "awaitingOwnerDecision",
    ...overrides,
  };
}

const codes = (ev: Evidence[]) => ev.map((e) => e.code);
const text = (e: Evidence, lang: "id-ID" | "en-US" = "id-ID") => translate(lang, e.code, e.params);

test("kualitas sinyal: setiap batas ambang RSSI", () => {
  assert.equal(signalQuality(RSSI_EXCELLENT), "excellent");
  assert.equal(signalQuality(RSSI_EXCELLENT - 1), "good");
  assert.equal(signalQuality(RSSI_GOOD), "good");
  assert.equal(signalQuality(RSSI_GOOD - 1), "fair");
  assert.equal(signalQuality(RSSI_FAIR), "fair");
  assert.equal(signalQuality(RSSI_FAIR - 1), "weak");
  assert.equal(signalQuality(-30), "excellent");
});

test("label teknis standar dan pita frekuensi", () => {
  assert.equal(phyLabel("11ac"), "802.11ac (Wi-Fi 5)");
  assert.equal(phyLabel("11g"), "802.11g");
  assert.equal(phyLabel("11be"), "802.11be (Wi-Fi 7)");
  assert.equal(bandLabel("2.4GHz"), "2.4 GHz");
  assert.equal(bandLabel("unknown"), "?");
});

test("tersambung: adaptor menyala = terukur ok; sinyal hanya informasi (kualitas eksperimental)", () => {
  const r = assessWifi(report(), "notAnswered", META);
  assert.equal(r.id, "wifi");
  assert.equal(r.outcome, "passed");
  assert.ok(hasMeasuredProof(r.evidence));
  assert.equal(r.summaryCode, "wifiResult.passedConnected");
  assert.deepEqual(codes(r.evidence), [
    "wifiResult.adapterOn",
    "wifiResult.signalNoise",
    "wifiResult.quality",
    "wifiResult.rate",
    "wifiResult.phy",
    "wifiResult.channelWidth",
    "wifiResult.routeReported",
  ]);
  for (const e of r.evidence.slice(1)) assert.equal(e.level, "info", e.code);
  assert.equal(r.evidence.find((e) => e.code === "wifiResult.quality")?.experimental, true);
  assert.equal(text(r.evidence[2]), "Kualitas sinyal saat ini: sangat baik (bergantung jarak dan lingkungan, bukan kondisi hardware).");
  assert.equal(text(r.evidence[5], "en-US"), "Channel 13 (2.4 GHz, 20 MHz wide).");
  assert.deepEqual(r.limitations, WIFI_LIMITATIONS);
  assert.equal(r.durationMs, 1200);
});

test("sinyal lemah TIDAK PERNAH menggagalkan hardware", () => {
  const r = assessWifi(report({ rssiDbm: -90, noiseDbm: null, snrDb: null }), "notAnswered", META);
  assert.equal(r.outcome, "passed");
  assert.ok(codes(r.evidence).includes("wifiResult.signal"));
  assert.ok(!r.evidence.some((e) => e.level === "critical" || e.level === "warning"));
});

test("menyala tetapi tidak tersambung: lulus dengan catatan tidak bisa mengukur sinyal", () => {
  const r = assessWifi(
    report({ state: "notConnected", rssiDbm: null, noiseDbm: null, snrDb: null, transmitRateMbps: null, channelNumber: null }),
    "notAnswered",
    META,
  );
  assert.equal(r.outcome, "passed");
  assert.equal(r.summaryCode, "wifiResult.passedNotConnected");
  assert.ok(codes(r.evidence).includes("wifiResult.notConnected"));
  assert.ok(!codes(r.evidence).includes("wifiResult.quality"));
  assert.ok(adapterOn(report({ state: "notConnected" })));
});

test("Wi-Fi dimatikan: Tidak tersedia + instruksi (aplikasi tidak mengubah pengaturan)", () => {
  const r = assessWifi(report({ state: "poweredOff", powerOn: false }), "works", META);
  assert.equal(r.outcome, "unavailable");
  assert.equal(r.summaryCode, "wifiResult.poweredOffSummary");
  assert.deepEqual(codes(r.evidence), ["wifiResult.adapterFoundOff"]);
  assert.ok(!r.evidence.some((e) => e.kind === "userConfirmed"), "konfirmasi diabaikan saat Wi-Fi mati");
  assert.ok(!adapterOn(report({ state: "poweredOff" })));
});

test("antarmuka tidak ditemukan: Gagal dengan catatan kehati-hatian", () => {
  const r = assessWifi(report({ state: "noInterface", interfaceName: null }), "notAnswered", META);
  assert.equal(r.outcome, "failed");
  assert.deepEqual(codes(r.evidence), ["wifiResult.noInterface", "wifiResult.noInterfaceCaveat"]);
  assert.equal(r.evidence[0].level, "critical");
});

test("gagal membaca: Tidak tersedia, bukan Gagal dan bukan Lulus", () => {
  const unknown = assessWifi(report({ state: "unknown", error: "CoreWLAN: x" }), "works", META);
  assert.equal(unknown.outcome, "unavailable");
  assert.equal(text(unknown.evidence[0]), "Status Wi-Fi tidak dapat dibaca (CoreWLAN: x).");
  const ipcError = assessWifi(null, "notAnswered", META, "invoke gagal");
  assert.equal(ipcError.outcome, "unavailable");
  assert.equal(ipcError.evidence[0].params?.error, "invoke gagal");
  assert.equal(wifiEvidence(null)[0].params?.error, "—");
});

test("konfirmasi pengguna diberi label dan masalah hanya menjadi catatan", () => {
  const works = assessWifi(report(), "works", META);
  const userOk = works.evidence.find((e) => e.kind === "userConfirmed");
  assert.equal(userOk?.level, "ok");
  const problem = assessWifi(report(), "problem", META);
  assert.equal(problem.outcome, "passed", "masalah koneksi bisa karena router/lingkungan");
  assert.equal(problem.evidence.find((e) => e.kind === "userConfirmed")?.level, "warning");
});

test("rute: tidak dilaporkan = informasi; tidak diketahui = tidak ditampilkan", () => {
  const notReported = report({ route: { ...report().route, state: "notReported" } });
  assert.ok(codes(wifiEvidence(notReported)).includes("wifiResult.routeNotReported"));
  const unknown = report({ route: { ...report().route, state: "unknown" } });
  assert.ok(!codes(wifiEvidence(unknown)).some((c) => c.startsWith("wifiResult.route")));
});

test("dibatalkan dan semua teks tersedia dalam dua bahasa", () => {
  const c = cancelledWifi();
  assert.equal(c.outcome, "cancelled");
  assert.equal(outcomeLabelKey(c), "outcome.cancelled");
  const all = [assessWifi(report(), "problem", META), assessWifi(report({ state: "noInterface" }), "works", META), c];
  for (const r of all) {
    for (const e of r.evidence) assert.notEqual(text(e, "en-US"), e.code);
    assert.notEqual(translate("en-US", r.summaryCode, r.summaryParams), r.summaryCode);
    for (const l of r.limitations) assert.notEqual(translate("en-US", l), l);
  }
});
