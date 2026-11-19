// Helper murni (tanpa React/Tauri) agar bisa dites dengan `node --test`.
import type { CheckId, CheckResult, Status } from "../types/diagnostics";

export type Tone = "success" | "warning" | "danger" | "neutral" | "muted";

export const STATUS_META: Record<Status, { label: string; tone: Tone }> = {
  pass: { label: "Baik", tone: "success" },
  warning: { label: "Perlu perhatian", tone: "warning" },
  fail: { label: "Bermasalah", tone: "danger" },
  unknown: { label: "Tidak diketahui", tone: "neutral" },
  notImplemented: { label: "Segera hadir", tone: "muted" },
  unsupported: { label: "Tidak berlaku", tone: "muted" },
};

/** Urutan tampil kartu pemeriksaan. */
export const CHECK_ORDER: CheckId[] = ["system", "battery", "storage", "cpu", "memory"];

export const CHECK_TITLES: Record<CheckId, string> = {
  system: "Sistem",
  battery: "Baterai",
  storage: "Penyimpanan",
  cpu: "CPU & Suhu",
  memory: "Memori",
};

export function countByStatus(checks: CheckResult[]): Record<Status, number> {
  const counts: Record<Status, number> = {
    pass: 0,
    warning: 0,
    fail: 0,
    unknown: 0,
    notImplemented: 0,
    unsupported: 0,
  };
  for (const check of checks) counts[check.status] += 1;
  return counts;
}

/** Byte -> GB basis 1024, konsisten dengan `format_gib` di Rust. */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "Tidak diketahui";
  const gib = bytes / 1024 ** 3;
  return Math.abs(gib - Math.round(gib)) < 0.05 ? `${Math.round(gib)} GB` : `${gib.toFixed(1)} GB`;
}

export function formatTimestamp(ms: number, locale = "id-ID"): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(ms),
  );
}
