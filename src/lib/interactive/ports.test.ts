/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence } from "../../types/interactive";
import type { PortsSnapshot, ReceptacleStatus, UsbDevice } from "../../types/peripherals";
import { translate } from "../../i18n/translate.ts";
import { hasMeasuredProof } from "./outcome.ts";
import {
  MAX_PORTS,
  PORTS_LIMITATIONS,
  assessPorts,
  canSavePorts,
  cancelledPorts,
  defaultPortCount,
  deviceKey,
  diffPorts,
  externalUsbDevices,
  newDeviceDetected,
  portState,
  recordTrial,
  snapshotUsable,
  structureEvidence,
  trialFromDiff,
} from "./ports.ts";

const META = { durationMs: 5000, finishedAt: "2026-11-19T10:00:00.000Z" };

const dev = (locationId: string, extra: Partial<UsbDevice> = {}): UsbDevice => ({
  builtIn: false,
  linkSpeed: "480 Mb/s",
  power: "2.5 W (500 mA)",
  vendorId: "0x1234",
  locationId,
  ...extra,
});

/** Potret contoh mirip MacBookPro16,2 (BUKAN data perangkat asli). */
function snap(opts: { external?: UsbDevice[]; status?: ReceptacleStatus[]; tbDevices?: number } = {}): PortsSnapshot {
  const status = opts.status ?? ["empty", "empty", "empty", "empty"];
  const external = opts.external ?? [];
  return {
    thunderbolt: [
      {
        index: 0,
        receptacles: [1, 2].map((id) => ({ id, status: status[id - 1], speedGbps: 40, speedIsMax: true, linkStatus: "0x101" })),
        connectedDevices: opts.tbDevices ?? 0,
      },
      {
        index: 1,
        receptacles: [3, 4].map((id) => ({ id, status: status[id - 1], speedGbps: 40, speedIsMax: true, linkStatus: "0x101" })),
        connectedDevices: 0,
      },
    ],
    usb: [
      { usbVersion: "3.1", builtIn: true, appleInternal: false, locationId: "0x0d000000", devices: external },
      {
        usbVersion: null,
        builtIn: true,
        appleInternal: true,
        locationId: "0x80000000",
        devices: [dev("0x80100000", { builtIn: true, vendorId: "0x05ac" }), dev("0x80200000", { builtIn: null })],
      },
    ],
    thunderboltAvailable: true,
    usbAvailable: true,
    receptacleCount: 4,
    externalUsbDevices: external.filter((d) => d.builtIn !== true).length,
    error: null,
  };
}

const codes = (ev: Evidence[]) => ev.map((e) => e.code);
const text = (e: Evidence, lang: "id-ID" | "en-US" = "id-ID") => translate(lang, e.code, e.params);

test("perangkat eksternal: bus internal T2 dan komponen bawaan tidak dihitung", () => {
  const s = snap({ external: [dev("0x0d100000"), dev("0x0d200000", { builtIn: true }), dev("0x0d300000", { builtIn: null })] });
  assert.deepEqual(
    externalUsbDevices(s).map((d) => d.locationId),
    ["0x0d100000", "0x0d300000"],
  );
  assert.equal(deviceKey(dev("0x0d100000")), "0x0d100000|0x1234");
  assert.equal(deviceKey({ ...dev("x"), locationId: null, vendorId: null }), "?|?");
});

test("diff: perangkat USB baru terdeteksi, yang lama tidak dihitung ulang", () => {
  const before = snap({ external: [dev("0x0d100000")] });
  const after = snap({ external: [dev("0x0d100000"), dev("0x0d200000", { linkSpeed: "5 Gb/s" })] });
  const d = diffPorts(before, after);
  assert.equal(d.addedUsb.length, 1);
  assert.equal(d.addedUsb[0].locationId, "0x0d200000");
  assert.deepEqual(d.removedUsb, []);
  assert.ok(newDeviceDetected(d));
});

test("diff: perangkat dilepas bukan deteksi baru; perangkat kembar dihitung per unit", () => {
  const twin = dev("0x0d100000");
  const removed = diffPorts(snap({ external: [twin] }), snap());
  assert.equal(removed.removedUsb.length, 1);
  assert.ok(!newDeviceDetected(removed));
  const added = diffPorts(snap({ external: [twin] }), snap({ external: [twin, { ...twin }] }));
  assert.equal(added.addedUsb.length, 1, "unit kedua dengan kunci sama tetap terdeteksi");
});

test("diff: receptacle berubah menjadi terhubung atau perangkat Thunderbolt bertambah", () => {
  const before = snap();
  const recept = diffPorts(before, snap({ status: ["empty", "connected", "empty", "empty"] }));
  assert.deepEqual(recept.receptacleChanges, [{ id: 2, before: "empty", after: "connected" }]);
  assert.ok(newDeviceDetected(recept));
  const tb = diffPorts(before, snap({ tbDevices: 1 }));
  assert.equal(tb.thunderboltDevicesDelta, 1);
  assert.ok(newDeviceDetected(tb));
  const unplug = diffPorts(snap({ status: ["connected", "empty", "empty", "empty"] }), before);
  assert.ok(!newDeviceDetected(unplug), "dari terhubung ke kosong bukan deteksi baru");
  assert.ok(!newDeviceDetected(diffPorts(before, snap())), "tanpa perubahan");
});

test("percobaan port: hasil diff, catatan terbaru menggantikan, status per port", () => {
  const detected = trialFromDiff(1, diffPorts(snap(), snap({ external: [dev("0x0d100000")] })));
  assert.equal(detected.verdict, "detected");
  assert.deepEqual(detected.addedUsb, [{ linkSpeed: "480 Mb/s", power: "2.5 W (500 mA)", vendorId: "0x1234" }]);
  const nothing = trialFromDiff(2, diffPorts(snap(), snap()));
  assert.equal(nothing.verdict, "notDetectedUnsure", "tanpa laporan pengguna = belum pasti");
  let trials = recordTrial([], nothing);
  trials = recordTrial(trials, detected);
  assert.deepEqual(
    trials.map((t) => t.port),
    [1, 2],
  );
  trials = recordTrial(trials, { ...nothing, port: 1 });
  assert.equal(portState(trials, 1), "unsure");
  assert.equal(portState(trials, 2), "unsure");
  assert.equal(portState(trials, 3), "notTested");
  assert.equal(portState(recordTrial([], trialFromDiff(4, diffPorts(snap(), snap()), "notDetectedSure")), 4), "problem");
  assert.equal(portState([detected], 1), "ok");
});

test("jumlah port awal, potret yang bisa dipakai, dan syarat simpan", () => {
  assert.equal(defaultPortCount(snap()), 4);
  assert.equal(defaultPortCount(null), 1);
  assert.equal(defaultPortCount({ ...snap(), receptacleCount: 0 }), 1);
  assert.equal(defaultPortCount({ ...snap(), receptacleCount: 20 }), MAX_PORTS);
  assert.ok(snapshotUsable(snap()));
  assert.ok(!snapshotUsable(null));
  assert.ok(!snapshotUsable({ ...snap(), error: "gagal" }));
  assert.ok(!snapshotUsable({ ...snap(), thunderboltAvailable: false, usbAvailable: false }));
  assert.ok(!canSavePorts([]));
});

test("port kosong TIDAK PERNAH dianggap rusak; struktur hanya informasi", () => {
  const ev = structureEvidence(snap({ external: [dev("0x0d100000")] }));
  assert.deepEqual(codes(ev), ["portsResult.structure", "portsResult.emptyReceptacles", "portsResult.externalNow"]);
  assert.ok(ev.every((e) => e.level === "info" && e.kind === "measured"));
  assert.equal(text(ev[0]), "Terdeteksi: 2 bus Thunderbolt, 4 receptacle, 1 pengontrol USB.");
});

test("tanpa port yang dicoba: tidak pernah Lulus (deteksi struktur saja tidak cukup)", () => {
  const r = assessPorts(snap(), [], 4, META);
  assert.equal(r.outcome, "cancelled");
  assert.ok(!hasMeasuredProof(r.evidence));
});

test("satu port terdeteksi: Lulus terukur, port lain tetap Belum diuji", () => {
  const trial = trialFromDiff(2, diffPorts(snap(), snap({ external: [dev("0x0d100000")], status: ["empty", "connected", "empty", "empty"] })));
  const r = assessPorts(snap(), [trial], 4, META);
  assert.equal(r.id, "ports");
  assert.equal(r.outcome, "passed");
  assert.ok(hasMeasuredProof(r.evidence));
  assert.deepEqual(r.summaryParams, { ok: 1, total: 4, untested: 3 });
  const untested = r.evidence.find((e) => e.code === "portsResult.untested") as Evidence;
  assert.equal(text(untested), "Belum diuji: port 1, 3, 4.");
  assert.ok(codes(r.evidence).includes("portsResult.newUsb"));
  assert.ok(codes(r.evidence).includes("portsResult.receptacleConnected"));
  assert.equal(translate("id-ID", r.summaryCode, r.summaryParams), "1 dari 4 port terbukti berfungsi; 3 belum diuji.");
  assert.deepEqual(r.limitations, PORTS_LIMITATIONS);
});

test("tidak terdeteksi & belum yakin perangkat/kabel: hanya catatan (tidak Gagal)", () => {
  const unsure = trialFromDiff(1, diffPorts(snap(), snap()), "notDetectedUnsure");
  const r = assessPorts(snap(), [unsure], 4, META);
  assert.equal(r.outcome, "passed");
  const user = r.evidence.find((e) => e.kind === "userConfirmed") as Evidence;
  assert.equal(user.level, "warning");
  assert.ok(codes(r.evidence).includes("portsResult.noChange"));
});

test("pengguna melapor perangkat terbukti baik tidak terdeteksi: Gagal + catatan kabel/perangkat", () => {
  const sure = trialFromDiff(3, diffPorts(snap(), snap()), "notDetectedSure");
  const ok = trialFromDiff(1, diffPorts(snap(), snap({ external: [dev("0x0d100000")] })));
  const r = assessPorts(snap(), [ok, sure], 4, META);
  assert.equal(r.outcome, "failed");
  assert.deepEqual(r.summaryParams, { n: 1, total: 4 });
  const crit = r.evidence.find((e) => e.level === "critical") as Evidence;
  assert.equal(crit.kind, "userConfirmed", "laporan pengguna, bukan pengukuran");
  assert.match(text(crit), /perangkat\/kabel lain/);
});

test("percobaan untuk port di luar jumlah port diabaikan", () => {
  const trial = trialFromDiff(6, diffPorts(snap(), snap({ external: [dev("0x0d100000")] })));
  assert.equal(assessPorts(snap(), [trial], 4, META).outcome, "cancelled");
});

test("data port tidak terbaca: Tidak tersedia", () => {
  const r = assessPorts(null, [], 1, META, "invoke gagal");
  assert.equal(r.outcome, "unavailable");
  assert.equal(text(r.evidence[0], "en-US"), "Port data could not be read (invoke gagal).");
  assert.equal(assessPorts({ ...snap(), error: "system_profiler: x" }, [], 4, META).evidence[0].params?.error, "system_profiler: x");
});

test("dibatalkan dan teks dua bahasa", () => {
  const c = cancelledPorts(2);
  assert.equal(c.outcome, "cancelled");
  assert.equal(translate("id-ID", c.summaryCode, c.summaryParams), "Tes port dibatalkan (2 port sudah dicoba).");
  const sure = trialFromDiff(3, diffPorts(snap(), snap()), "notDetectedSure");
  const tb = trialFromDiff(1, diffPorts(snap(), snap({ tbDevices: 1 })));
  for (const r of [assessPorts(snap(), [tb, sure], 4, META), c]) {
    for (const e of r.evidence) assert.notEqual(text(e, "en-US"), e.code);
    assert.notEqual(translate("en-US", r.summaryCode, r.summaryParams), r.summaryCode);
    for (const l of r.limitations) assert.notEqual(translate("en-US", l), l);
  }
});
