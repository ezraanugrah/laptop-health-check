// Tes Bluetooth (T10): penilaian hasil dari laporan backend (fungsi murni).
// Read-only lewat system_profiler: tanpa pemindaian, penemuan, atau pemasangan,
// dan aplikasi tidak pernah menyalakan/mematikan Bluetooth. Perangkat hanya
// dihitung + jenisnya (tanpa nama/alamat).
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import type { BluetoothReport } from "../../types/peripherals";
import { decideCompletedOutcome } from "./outcome.ts";
import type { UserVerdict } from "./wifi.ts";

export type { UserVerdict } from "./wifi.ts";

export const BLUETOOTH_LIMITATIONS: UiKey[] = [
  "bluetoothLimit.noScan",
  "bluetoothLimit.privacy",
  "bluetoothLimit.noSettings",
  "bluetoothLimit.range",
];

/** Jenis perangkat yang dikenal (minor type macOS) → kunci terjemahan. */
const DEVICE_TYPES: Record<string, UiKey> = {
  headphones: "bluetooth.type.headphones",
  headset: "bluetooth.type.headphones",
  speaker: "bluetooth.type.speaker",
  keyboard: "bluetooth.type.keyboard",
  mouse: "bluetooth.type.mouse",
  trackpad: "bluetooth.type.trackpad",
  gamepad: "bluetooth.type.gamepad",
  phone: "bluetooth.type.phone",
  watch: "bluetooth.type.watch",
  computer: "bluetooth.type.computer",
};

/**
 * Parameter jenis perangkat: kunci terjemahan berawalan "@" bila dikenal,
 * selain itu nilai teknis dari macOS apa adanya.
 */
export function deviceTypeParam(minorType: string | null): string {
  if (!minorType) return "@bluetooth.type.unknown";
  const key = DEVICE_TYPES[minorType.trim().toLowerCase()];
  return key ? `@${key}` : minorType;
}

export function bluetoothEvidence(report: BluetoothReport | null, readError: string | null = null): Evidence[] {
  if (!report || report.state === "unknown") {
    return [
      {
        kind: "measured",
        level: "info",
        code: "bluetoothResult.readError",
        params: { error: readError ?? report?.error ?? "—" },
      },
    ];
  }
  if (report.state === "noController") {
    return [
      { kind: "measured", level: "critical", code: "bluetoothResult.noController" },
      { kind: "measured", level: "info", code: "bluetoothResult.noControllerCaveat" },
    ];
  }
  const chipset = report.chipset ?? "—";
  const ev: Evidence[] = [];
  if (report.state === "off") {
    ev.push({ kind: "measured", level: "info", code: "bluetoothResult.controllerFoundOff", params: { chipset } });
    return ev;
  }
  ev.push({ kind: "measured", level: "ok", code: "bluetoothResult.on", params: { chipset } });
  if (report.firmware || report.transport) {
    ev.push({
      kind: "measured",
      level: "info",
      code: "bluetoothResult.controllerDetails",
      params: { firmware: report.firmware ?? "—", transport: report.transport ?? "—" },
    });
  }
  if (report.connectedCount > 0) {
    ev.push({
      kind: "measured",
      level: "info",
      code: "bluetoothResult.connected",
      params: { n: report.connectedCount, types: report.connectedTypes.map(deviceTypeParam) },
    });
  } else {
    ev.push({ kind: "measured", level: "info", code: "bluetoothResult.noneConnected" });
  }
  if (report.pairedNotConnected > 0) {
    ev.push({ kind: "measured", level: "info", code: "bluetoothResult.paired", params: { n: report.pairedNotConnected } });
  }
  return ev;
}

export interface BluetoothMeta {
  durationMs: number;
  finishedAt: string;
}

export function assessBluetooth(
  report: BluetoothReport | null,
  verdict: UserVerdict,
  meta: BluetoothMeta,
  readError: string | null = null,
): InteractiveResult {
  const evidence = bluetoothEvidence(report, readError);
  const base = { id: "bluetooth" as const, evidence, limitations: BLUETOOTH_LIMITATIONS, ...meta };
  if (!report || report.state === "unknown") {
    return { ...base, outcome: "unavailable", summaryCode: "bluetoothResult.unknownSummary" };
  }
  if (report.state === "off") {
    return { ...base, outcome: "unavailable", summaryCode: "bluetoothResult.offSummary" };
  }
  if (report.state === "noController") {
    return { ...base, outcome: "failed", summaryCode: "bluetoothResult.noControllerSummary" };
  }
  if (verdict === "works") {
    evidence.push({ kind: "userConfirmed", level: "ok", code: "bluetoothResult.userWorks" });
  } else if (verdict === "problem") {
    // Masalah pemasangan bisa karena perangkat lain/jarak: catatan, bukan bukti kerusakan.
    evidence.push({ kind: "userConfirmed", level: "warning", code: "bluetoothResult.userProblem" });
  }
  return {
    ...base,
    outcome: decideCompletedOutcome(evidence),
    summaryCode: "bluetoothResult.passed",
    summaryParams: { n: report.connectedCount },
  };
}

export function cancelledBluetooth(): InteractiveResult {
  return {
    id: "bluetooth",
    outcome: "cancelled",
    summaryCode: "bluetoothResult.cancelled",
    evidence: [],
    limitations: BLUETOOTH_LIMITATIONS,
  };
}
