// Tes Port USB/Thunderbolt (T11): perbandingan potret port dan penilaian (fungsi murni).
// - Port kosong TIDAK PERNAH dianggap rusak ("kosong" ≠ rusak).
// - Port dinyatakan berfungsi hanya bila perangkat baru TERUKUR muncul setelah
//   pengguna memasangnya (bandingkan potret sebelum/sesudah).
// - Port yang belum dicoba tetap "Belum diuji".
// - "Tidak terdeteksi" hanya dicatat bila pengguna sendiri melaporkannya, dan
//   selalu disertai catatan bahwa kabel/perangkat bisa jadi penyebabnya.
// Isi penyimpanan eksternal tidak pernah dibaca.
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import type { PortsSnapshot, ReceptacleStatus, UsbDevice } from "../../types/peripherals";
import { decideCompletedOutcome } from "./outcome.ts";

export const PORTS_LIMITATIONS: UiKey[] = [
  "portsLimit.emptyNotBroken",
  "portsLimit.knownGood",
  "portsLimit.numbering",
  "portsLimit.noStorage",
  "portsLimit.chargingVideo",
];

/** Batas jumlah port yang bisa dicatat (termasuk port tambahan, mis. USB-A). */
export const MAX_PORTS = 8;

// --- Potret & perbandingan -------------------------------------------------------

/** Perangkat USB eksternal (bukan komponen bawaan / bus internal Apple T2). */
export function externalUsbDevices(s: PortsSnapshot): UsbDevice[] {
  return s.usb.filter((c) => !c.appleInternal).flatMap((c) => c.devices.filter((d) => d.builtIn !== true));
}

/** Kunci perangkat antar-potret: location ID (jalur port) + vendor ID. */
export function deviceKey(d: UsbDevice): string {
  return `${d.locationId ?? "?"}|${d.vendorId ?? "?"}`;
}

function receptacleMap(s: PortsSnapshot): Map<string, ReceptacleStatus> {
  const map = new Map<string, ReceptacleStatus>();
  s.thunderbolt.forEach((bus, b) =>
    bus.receptacles.forEach((r, i) => map.set(`${bus.index ?? `b${b}`}:${r.id ?? `r${i}`}`, r.status)),
  );
  return map;
}

export interface ReceptacleChange {
  /** Nomor receptacle dari macOS (`null` bila tidak dilaporkan). */
  id: number | null;
  before: ReceptacleStatus | null;
  after: ReceptacleStatus | null;
}

export interface PortsDiff {
  addedUsb: UsbDevice[];
  removedUsb: UsbDevice[];
  receptacleChanges: ReceptacleChange[];
  /** Selisih jumlah perangkat Thunderbolt (sesudah − sebelum). */
  thunderboltDevicesDelta: number;
}

/** Selisih multiset perangkat (perangkat kembar dengan kunci sama tetap dihitung). */
function subtract(a: UsbDevice[], b: UsbDevice[]): UsbDevice[] {
  const remaining = new Map<string, number>();
  for (const d of b) remaining.set(deviceKey(d), (remaining.get(deviceKey(d)) ?? 0) + 1);
  return a.filter((d) => {
    const n = remaining.get(deviceKey(d)) ?? 0;
    if (n > 0) {
      remaining.set(deviceKey(d), n - 1);
      return false;
    }
    return true;
  });
}

export function diffPorts(before: PortsSnapshot, after: PortsSnapshot): PortsDiff {
  const usbBefore = externalUsbDevices(before);
  const usbAfter = externalUsbDevices(after);
  const rb = receptacleMap(before);
  const ra = receptacleMap(after);
  const receptacleChanges: ReceptacleChange[] = [];
  for (const key of new Set([...rb.keys(), ...ra.keys()])) {
    const b = rb.get(key) ?? null;
    const a = ra.get(key) ?? null;
    if (a !== b) {
      const id = Number(key.split(":")[1]);
      receptacleChanges.push({ id: Number.isFinite(id) ? id : null, before: b, after: a });
    }
  }
  const tbCount = (s: PortsSnapshot) => s.thunderbolt.reduce((n, bus) => n + bus.connectedDevices, 0);
  return {
    addedUsb: subtract(usbAfter, usbBefore),
    removedUsb: subtract(usbBefore, usbAfter),
    receptacleChanges,
    thunderboltDevicesDelta: tbCount(after) - tbCount(before),
  };
}

/** Ada perangkat baru yang terukur setelah pengguna memasang perangkat? */
export function newDeviceDetected(diff: PortsDiff): boolean {
  return (
    diff.addedUsb.length > 0 ||
    diff.thunderboltDevicesDelta > 0 ||
    diff.receptacleChanges.some((c) => c.after === "connected" && c.before !== "connected")
  );
}

// --- Percobaan per port ------------------------------------------------------------

/**
 * - detected          : perangkat baru terdeteksi (terukur)
 * - notDetectedSure   : pengguna melapor perangkat & kabel sudah terbukti baik, tetap tidak terdeteksi
 * - notDetectedUnsure : tidak terdeteksi, pengguna belum yakin perangkat/kabelnya
 */
export type PortVerdict = "detected" | "notDetectedSure" | "notDetectedUnsure";

export interface PortTrial {
  /** Nomor port pilihan pengguna (1..N). */
  port: number;
  verdict: PortVerdict;
  /** Ringkasan perubahan terukur (tanpa nama perangkat). */
  addedUsb: Pick<UsbDevice, "linkSpeed" | "power" | "vendorId">[];
  receptaclesConnected: (number | null)[];
  thunderboltDevicesAdded: number;
}

export function trialFromDiff(port: number, diff: PortsDiff, verdict?: PortVerdict): PortTrial {
  return {
    port,
    verdict: verdict ?? (newDeviceDetected(diff) ? "detected" : "notDetectedUnsure"),
    addedUsb: diff.addedUsb.map((d) => ({ linkSpeed: d.linkSpeed, power: d.power, vendorId: d.vendorId })),
    receptaclesConnected: diff.receptacleChanges.filter((c) => c.after === "connected").map((c) => c.id),
    thunderboltDevicesAdded: Math.max(0, diff.thunderboltDevicesDelta),
  };
}

/** Catatan percobaan terakhir per port (percobaan baru menggantikan yang lama). */
export function recordTrial(trials: PortTrial[], trial: PortTrial): PortTrial[] {
  return [...trials.filter((t) => t.port !== trial.port), trial].sort((a, b) => a.port - b.port);
}

export type PortState = "notTested" | "ok" | "problem" | "unsure";

export function portState(trials: PortTrial[], port: number): PortState {
  const t = trials.find((x) => x.port === port);
  if (!t) return "notTested";
  if (t.verdict === "detected") return "ok";
  return t.verdict === "notDetectedSure" ? "problem" : "unsure";
}

/** Jumlah port awal: jumlah receptacle yang dilaporkan macOS (minimal 1). */
export function defaultPortCount(s: PortsSnapshot | null): number {
  return Math.min(MAX_PORTS, Math.max(1, s?.receptacleCount ?? 0));
}

/** Potret bisa dipakai untuk tes manual (minimal satu bagian terbaca)? */
export function snapshotUsable(s: PortsSnapshot | null): boolean {
  return !!s && !s.error && (s.thunderboltAvailable || s.usbAvailable);
}

export function canSavePorts(trials: PortTrial[]): boolean {
  return trials.length > 0;
}

// --- Penilaian ---------------------------------------------------------------------

/** Bukti struktur port yang terdeteksi (terukur, informasi). */
export function structureEvidence(s: PortsSnapshot): Evidence[] {
  const empty = s.thunderbolt.flatMap((b) => b.receptacles).filter((r) => r.status === "empty").length;
  const ev: Evidence[] = [
    {
      kind: "measured",
      level: "info",
      code: "portsResult.structure",
      params: {
        buses: s.thunderbolt.length,
        receptacles: s.receptacleCount,
        controllers: s.usb.filter((c) => !c.appleInternal).length,
      },
    },
  ];
  if (empty > 0) ev.push({ kind: "measured", level: "info", code: "portsResult.emptyReceptacles", params: { n: empty } });
  const external = externalUsbDevices(s).length;
  if (external > 0) ev.push({ kind: "measured", level: "info", code: "portsResult.externalNow", params: { n: external } });
  return ev;
}

function trialEvidence(t: PortTrial): Evidence[] {
  if (t.verdict === "detected") {
    const ev: Evidence[] = [{ kind: "measured", level: "ok", code: "portsResult.portDetected", params: { port: t.port } }];
    for (const d of t.addedUsb) {
      ev.push({
        kind: "measured",
        level: "info",
        code: "portsResult.newUsb",
        params: { port: t.port, speed: d.linkSpeed ?? "—", power: d.power ?? "—", vendor: d.vendorId ?? "—" },
      });
    }
    for (const id of t.receptaclesConnected) {
      ev.push({ kind: "measured", level: "info", code: "portsResult.receptacleConnected", params: { port: t.port, id: id ?? "—" } });
    }
    if (t.thunderboltDevicesAdded > 0) {
      ev.push({ kind: "measured", level: "info", code: "portsResult.newThunderbolt", params: { port: t.port, n: t.thunderboltDevicesAdded } });
    }
    return ev;
  }
  return [
    { kind: "measured", level: "info", code: "portsResult.noChange", params: { port: t.port } },
    t.verdict === "notDetectedSure"
      ? { kind: "userConfirmed", level: "critical", code: "portsResult.notDetectedSure", params: { port: t.port } }
      : { kind: "userConfirmed", level: "warning", code: "portsResult.notDetectedUnsure", params: { port: t.port } },
  ];
}

export interface PortsMeta {
  durationMs: number;
  finishedAt: string;
}

export function assessPorts(
  snapshot: PortsSnapshot | null,
  trials: PortTrial[],
  portCount: number,
  meta: PortsMeta,
  readError: string | null = null,
): InteractiveResult {
  if (!snapshotUsable(snapshot)) {
    return {
      id: "ports",
      outcome: "unavailable",
      summaryCode: "portsResult.unavailable",
      evidence: [
        {
          kind: "measured",
          level: "info",
          code: "portsResult.readError",
          params: { error: readError ?? snapshot?.error ?? "—" },
        },
      ],
      limitations: PORTS_LIMITATIONS,
      ...meta,
    };
  }
  const evidence = structureEvidence(snapshot as PortsSnapshot);
  const tried = trials.filter((t) => t.port >= 1 && t.port <= portCount);
  // Tanpa satu pun port yang dicoba, deteksi struktur saja tidak cukup untuk "Lulus".
  if (tried.length === 0) return { ...cancelledPorts(0), evidence, ...meta };
  for (const t of tried) evidence.push(...trialEvidence(t));
  const untested: number[] = [];
  for (let p = 1; p <= portCount; p++) if (!tried.some((t) => t.port === p)) untested.push(p);
  if (untested.length > 0) {
    evidence.push({ kind: "measured", level: "info", code: "portsResult.untested", params: { ports: untested.map(String) } });
  }
  const ok = tried.filter((t) => t.verdict === "detected").length;
  const problems = tried.filter((t) => t.verdict === "notDetectedSure").length;
  const outcome = decideCompletedOutcome(evidence);
  return {
    id: "ports",
    outcome,
    summaryCode: outcome === "failed" ? "portsResult.failed" : "portsResult.passed",
    summaryParams: outcome === "failed" ? { n: problems, total: portCount } : { ok, total: portCount, untested: untested.length },
    evidence,
    limitations: PORTS_LIMITATIONS,
    ...meta,
  };
}

export function cancelledPorts(tested: number): InteractiveResult {
  return {
    id: "ports",
    outcome: "cancelled",
    summaryCode: "portsResult.cancelled",
    summaryParams: { n: tested },
    evidence: [],
    limitations: PORTS_LIMITATIONS,
  };
}
