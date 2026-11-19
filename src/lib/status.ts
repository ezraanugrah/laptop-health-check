// Helper murni (tanpa React/Tauri) agar bisa dites dengan `node --test`.
import type { CheckId, CheckResult, ReasonLevel, Status } from "../types/diagnostics";

export type Tone = "success" | "warning" | "danger" | "neutral" | "muted";

export const STATUS_META: Record<Status, { label: string; tone: Tone }> = {
  healthy: { label: "Sehat", tone: "success" },
  warning: { label: "Peringatan", tone: "warning" },
  critical: { label: "Kritis", tone: "danger" },
  unknown: { label: "Tidak diketahui", tone: "neutral" },
  notApplicable: { label: "Tidak berlaku", tone: "muted" },
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

export const CHECK_TITLES: Record<CheckId, string> = {
  system: "Sistem",
  battery: "Baterai",
  storage: "SSD/HDD",
  memory: "RAM & Memori",
  cpu: "CPU & Status Termal",
  temperature: "Temperatur",
  fans: "Kipas",
  gpu: "GPU",
  ownership: "Activation Lock & MDM",
};

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

/** Ringkasan jumlah per status, hanya yang bernilai > 0. Contoh: "6 sehat · 2 peringatan". */
export function summarizeCounts(counts: Record<Status, number>): string {
  const order: Status[] = ["critical", "warning", "unknown", "healthy", "notApplicable"];
  return order
    .filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${STATUS_META[s].label.toLowerCase()}`)
    .join(" · ");
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} dtk`;
}

export function formatTimestamp(ms: number, locale = "id-ID"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(ms),
  );
}
