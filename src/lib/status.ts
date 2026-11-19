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
import type { T, UiKey } from "../i18n/translate.ts";

export type Tone = "success" | "warning" | "danger" | "neutral" | "muted";

export const STATUS_META: Record<Status, { label: UiKey; tone: Tone }> = {
  healthy: { label: "status.healthy", tone: "success" },
  warning: { label: "status.warning", tone: "warning" },
  critical: { label: "status.critical", tone: "danger" },
  unknown: { label: "status.unknown", tone: "neutral" },
  notApplicable: { label: "status.notApplicable", tone: "muted" },
};

export const HARDWARE_STATUS_META: Record<HardwareStatus, { label: UiKey; tone: Tone }> = {
  healthy: { label: "status.healthy", tone: "success" },
  warning: { label: "status.warning", tone: "warning" },
  critical: { label: "status.critical", tone: "danger" },
  incomplete: { label: "status.incomplete", tone: "neutral" },
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

export const CATEGORY_META: Record<CheckCategory, { title: UiKey; description: UiKey }> = {
  coreHardware: {
    title: "category.coreHardware.title",
    description: "category.coreHardware.description",
  },
  supplementaryHardware: {
    title: "category.supplementaryHardware.title",
    description: "category.supplementaryHardware.description",
  },
  deviceSecurity: {
    title: "category.deviceSecurity.title",
    description: "category.deviceSecurity.description",
  },
};

/** Kunci judul kartu pemeriksaan (aplikasi khusus macOS). */
export function checkTitleKey(id: CheckId): UiKey {
  return `check.${id}`;
}

export function checkTitle(id: CheckId, t: T): string {
  return t(checkTitleKey(id));
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
export function coverageText(summary: HardwareSummary, t: T): string {
  return t("dashboard.coverage", { measured: summary.measured, total: summary.total });
}

/** Daftar pemeriksaan yang belum terukur, dipisah inti/pelengkap. */
export function missingText(summary: HardwareSummary, t: T): string[] {
  const list = (ids: CheckId[]) => ids.map((id) => checkTitle(id, t)).join(", ");
  const lines: string[] = [];
  if (summary.missingCore.length > 0) {
    lines.push(t("dashboard.missingCore", { list: list(summary.missingCore) }));
  }
  if (summary.missingSupplementary.length > 0) {
    lines.push(t("dashboard.missingSupplementary", { list: list(summary.missingSupplementary) }));
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
