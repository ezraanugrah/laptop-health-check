// Helper murni (tanpa React/Tauri) agar bisa dites dengan `node --test`.
import type {
  CheckCategory,
  CheckId,
  CheckResult,
  HardwareStatus,
  HardwareSummary,
  ReasonLevel,
  Status,
} from "../types/diagnostics";

export type Tone = "success" | "warning" | "danger" | "neutral" | "muted";

export const STATUS_META: Record<Status, { label: string; tone: Tone }> = {
  healthy: { label: "Sehat", tone: "success" },
  warning: { label: "Peringatan", tone: "warning" },
  critical: { label: "Kritis", tone: "danger" },
  unknown: { label: "Tidak diketahui", tone: "neutral" },
  notApplicable: { label: "Tidak berlaku", tone: "muted" },
};

export const HARDWARE_STATUS_META: Record<HardwareStatus, { label: string; tone: Tone }> = {
  healthy: { label: "Sehat", tone: "success" },
  warning: { label: "Peringatan", tone: "warning" },
  critical: { label: "Kritis", tone: "danger" },
  incomplete: { label: "Pemeriksaan belum lengkap", tone: "neutral" },
};

export const REASON_TONE: Record<ReasonLevel, Tone> = {
  critical: "danger",
  warning: "warning",
  ok: "success",
  info: "neutral",
};

/** Urutan tampil kartu pemeriksaan (sama dengan urutan backend). */
export const CHECK_ORDER: CheckId[] = [
  "system",
  "battery",
  "storage",
  "memory",
  "cpu",
  "temperature",
  "fans",
  "gpu",
  "ownership",
];

export const CATEGORY_ORDER: CheckCategory[] = [
  "coreHardware",
  "supplementaryHardware",
  "deviceSecurity",
];

export const CATEGORY_META: Record<CheckCategory, { title: string; description: string }> = {
  coreHardware: {
    title: "Hardware inti",
    description: "Bila salah satu tidak terbaca, hasil hardware dinyatakan belum lengkap.",
  },
  supplementaryHardware: {
    title: "Hardware pelengkap",
    description: "Boleh tidak terukur tanpa mengubah kesimpulan inti; tetap dicatat di cakupan.",
  },
  deviceSecurity: {
    title: "Perangkat, keamanan OS & kepemilikan",
    description: "Dinilai terpisah dan tidak memengaruhi kesimpulan kesehatan hardware.",
  },
};

const BASE_TITLES: Record<CheckId, string> = {
  system: "Sistem",
  battery: "Baterai",
  storage: "SSD/HDD",
  memory: "RAM & Memori",
  cpu: "CPU & Status Termal",
  temperature: "Temperatur",
  fans: "Kipas",
  gpu: "GPU",
  ownership: "Kepemilikan & Manajemen",
};

/** Judul kartu sesuai OS (D2). `os` = `AppInfo.os` ("macos", "windows", ...). */
export function checkTitle(id: CheckId, os?: string): string {
  if (id === "ownership") {
    if (os === "macos") return "Activation Lock & MDM";
    if (os === "windows") return "Aktivasi & Manajemen Perangkat";
  }
  return BASE_TITLES[id];
}

/** Kategori pemeriksaan bila laporan belum tersedia (sama dengan backend). */
export function categoryOf(id: CheckId): CheckCategory {
  switch (id) {
    case "battery":
    case "storage":
    case "memory":
    case "cpu":
      return "coreHardware";
    case "temperature":
    case "fans":
    case "gpu":
      return "supplementaryHardware";
    default:
      return "deviceSecurity";
  }
}

/** Teks cakupan, mis. "7 dari 7 pemeriksaan hardware terukur". */
export function coverageText(summary: HardwareSummary): string {
  return `${summary.measured} dari ${summary.total} pemeriksaan hardware terukur`;
}

/** Daftar pemeriksaan yang belum terukur, dipisah inti/pelengkap. */
export function missingText(summary: HardwareSummary, os?: string): string[] {
  const list = (ids: CheckId[]) => ids.map((id) => checkTitle(id, os)).join(", ");
  const lines: string[] = [];
  if (summary.missingCore.length > 0) {
    lines.push(`Data inti belum tersedia: ${list(summary.missingCore)}.`);
  }
  if (summary.missingSupplementary.length > 0) {
    lines.push(`Pelengkap tidak terukur: ${list(summary.missingSupplementary)}.`);
  }
  return lines;
}

export function countByStatus(checks: CheckResult[]): Record<Status, number> {
  const counts: Record<Status, number> = {
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
    notApplicable: 0,
  };
  for (const check of checks) counts[check.status] += 1;
  return counts;
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} dtk`;
}

export function formatTimestamp(ms: number, locale = "id-ID"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(ms),
  );
}
