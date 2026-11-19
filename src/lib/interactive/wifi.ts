// Tes Wi-Fi (T9): penilaian hasil dari laporan backend (fungsi murni).
// Data dibaca read-only lewat CoreWLAN TANPA pemindaian; aplikasi tidak pernah
// menyalakan/mematikan Wi-Fi. Kualitas sinyal bergantung lingkungan, jadi
// hanya informasi dan tidak pernah menggagalkan hardware.
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import type { WifiBand, WifiPhyMode, WifiReport } from "../../types/peripherals";
import { decideCompletedOutcome } from "./outcome.ts";

export const WIFI_LIMITATIONS: UiKey[] = [
  "wifiLimit.noScan",
  "wifiLimit.environment",
  "wifiLimit.route",
  "wifiLimit.noSettings",
  "wifiLimit.permission",
];

/** Konfirmasi opsional dari pengguna (bukan hasil pengukuran). */
export type UserVerdict = "notAnswered" | "works" | "problem";

export type SignalQuality = "excellent" | "good" | "fair" | "weak";

/**
 * Batas RSSI (dBm) untuk label kualitas sinyal. Belum dikalibrasi di Mac asli
 * dan sangat bergantung jarak/penghalang → bukti eksperimental (info saja).
 */
export const RSSI_EXCELLENT = -50;
export const RSSI_GOOD = -60;
export const RSSI_FAIR = -70;

export function signalQuality(rssiDbm: number): SignalQuality {
  if (rssiDbm >= RSSI_EXCELLENT) return "excellent";
  if (rssiDbm >= RSSI_GOOD) return "good";
  if (rssiDbm >= RSSI_FAIR) return "fair";
  return "weak";
}

export const SIGNAL_QUALITY_LABEL: Record<SignalQuality, UiKey> = {
  excellent: "wifi.quality.excellent",
  good: "wifi.quality.good",
  fair: "wifi.quality.fair",
  weak: "wifi.quality.weak",
};

/** "11ac" -> "802.11ac (Wi-Fi 5)". Label teknis, tidak diterjemahkan. */
export function phyLabel(phy: WifiPhyMode): string {
  const generation: Partial<Record<WifiPhyMode, string>> = {
    "11n": "Wi-Fi 4",
    "11ac": "Wi-Fi 5",
    "11ax": "Wi-Fi 6/6E",
    "11be": "Wi-Fi 7",
  };
  if (phy === "none" || phy === "unknown") return phy;
  const gen = generation[phy];
  return gen ? `802.${phy} (${gen})` : `802.${phy}`;
}

/** "2.4GHz" -> "2.4 GHz". Label teknis, tidak diterjemahkan. */
export function bandLabel(band: WifiBand): string {
  return band === "unknown" ? "?" : band.replace("GHz", " GHz");
}

/** Wi-Fi menyala (tersambung atau tidak) → konfirmasi pengguna masuk akal. */
export function adapterOn(report: WifiReport | null): boolean {
  return report?.state === "connected" || report?.state === "notConnected";
}

/** Bukti terukur dari laporan backend (tanpa konfirmasi pengguna). */
export function wifiEvidence(report: WifiReport | null, readError: string | null = null): Evidence[] {
  if (!report || report.state === "unknown") {
    return [
      {
        kind: "measured",
        level: "info",
        code: "wifiResult.readError",
        params: { error: readError ?? report?.error ?? "—" },
      },
    ];
  }
  const iface = report.interfaceName ?? "—";
  const ev: Evidence[] = [];
  switch (report.state) {
    case "noInterface":
      ev.push({ kind: "measured", level: "critical", code: "wifiResult.noInterface" });
      ev.push({ kind: "measured", level: "info", code: "wifiResult.noInterfaceCaveat" });
      return ev;
    case "poweredOff":
      ev.push({ kind: "measured", level: "info", code: "wifiResult.adapterFoundOff", params: { iface } });
      return ev;
    case "notConnected":
    case "connected":
      ev.push({ kind: "measured", level: "ok", code: "wifiResult.adapterOn", params: { iface } });
      break;
  }
  if (report.state === "connected") {
    if (report.rssiDbm !== null) {
      ev.push({
        kind: "measured",
        level: "info",
        code: report.noiseDbm !== null ? "wifiResult.signalNoise" : "wifiResult.signal",
        params:
          report.noiseDbm !== null
            ? { rssi: report.rssiDbm, noise: report.noiseDbm, snr: report.snrDb ?? "—" }
            : { rssi: report.rssiDbm },
      });
      ev.push({
        kind: "measured",
        level: "info",
        code: "wifiResult.quality",
        params: { quality: `@${SIGNAL_QUALITY_LABEL[signalQuality(report.rssiDbm)]}` },
        experimental: true,
      });
    }
    if (report.transmitRateMbps !== null) {
      ev.push({ kind: "measured", level: "info", code: "wifiResult.rate", params: { rate: Math.round(report.transmitRateMbps) } });
    }
    if (report.phyMode !== null && report.phyMode !== "none" && report.phyMode !== "unknown") {
      ev.push({ kind: "measured", level: "info", code: "wifiResult.phy", params: { phy: phyLabel(report.phyMode) } });
    }
    if (report.channelNumber !== null) {
      ev.push({
        kind: "measured",
        level: "info",
        code: report.channelWidthMhz !== null ? "wifiResult.channelWidth" : "wifiResult.channel",
        params: {
          channel: report.channelNumber,
          band: bandLabel(report.channelBand ?? "unknown"),
          width: report.channelWidthMhz ?? "—",
        },
      });
    }
  } else {
    ev.push({ kind: "measured", level: "info", code: "wifiResult.notConnected" });
  }
  if (report.route.state === "reported") {
    ev.push({ kind: "measured", level: "info", code: "wifiResult.routeReported" });
  } else if (report.route.state === "notReported") {
    ev.push({ kind: "measured", level: "info", code: "wifiResult.routeNotReported" });
  }
  return ev;
}

export interface WifiMeta {
  durationMs: number;
  finishedAt: string;
}

export function assessWifi(
  report: WifiReport | null,
  verdict: UserVerdict,
  meta: WifiMeta,
  readError: string | null = null,
): InteractiveResult {
  const evidence = wifiEvidence(report, readError);
  const base = { id: "wifi" as const, evidence, limitations: WIFI_LIMITATIONS, ...meta };
  if (!report || report.state === "unknown") {
    return { ...base, outcome: "unavailable", summaryCode: "wifiResult.unknownSummary" };
  }
  if (report.state === "poweredOff") {
    return { ...base, outcome: "unavailable", summaryCode: "wifiResult.poweredOffSummary" };
  }
  if (report.state === "noInterface") {
    return { ...base, outcome: "failed", summaryCode: "wifiResult.noInterfaceSummary" };
  }
  if (verdict === "works") {
    evidence.push({ kind: "userConfirmed", level: "ok", code: "wifiResult.userWorks" });
  } else if (verdict === "problem") {
    // Masalah koneksi bisa karena router/lingkungan: catatan, bukan bukti kerusakan.
    evidence.push({ kind: "userConfirmed", level: "warning", code: "wifiResult.userProblem" });
  }
  const outcome = decideCompletedOutcome(evidence);
  return {
    ...base,
    outcome,
    summaryCode: report.state === "connected" ? "wifiResult.passedConnected" : "wifiResult.passedNotConnected",
    summaryParams: { iface: report.interfaceName ?? "—" },
  };
}

export function cancelledWifi(): InteractiveResult {
  return {
    id: "wifi",
    outcome: "cancelled",
    summaryCode: "wifiResult.cancelled",
    evidence: [],
    limitations: WIFI_LIMITATIONS,
  };
}
