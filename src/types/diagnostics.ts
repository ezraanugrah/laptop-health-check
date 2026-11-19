// Cermin dari `src-tauri/src/diagnostics/types.rs`.
// Setiap perubahan di Rust WAJIB disalin ke sini (field dalam camelCase).

export type CheckId =
  | "system"
  | "battery"
  | "storage"
  | "memory"
  | "cpu"
  | "temperature"
  | "fans"
  | "gpu"
  | "ownership";

/** Kelompok pemeriksaan (lihat ARCHITECTURE.md §4). */
export type CheckCategory = "coreHardware" | "supplementaryHardware" | "deviceSecurity";

export type Status = "healthy" | "warning" | "critical" | "unknown" | "notApplicable";

/** Kesimpulan kesehatan hardware; "incomplete" = data inti belum lengkap. */
export type HardwareStatus = "healthy" | "warning" | "critical" | "incomplete";

export interface HardwareSummary {
  status: HardwareStatus;
  measured: number;
  total: number;
  missingCore: CheckId[];
  missingSupplementary: CheckId[];
}

export type ReasonLevel = "critical" | "warning" | "ok" | "info";

/**
 * Pesan berkode dari Rust (`diagnostics/text.rs`): `text` = Bahasa Indonesia
 * (fallback), `code` + `params` diterjemahkan frontend (src/i18n).
 */
export interface Reason {
  level: ReasonLevel;
  text: string;
  code?: string;
  params?: Record<string, string>;
}

export interface Metric {
  label: string;
  labelCode?: string;
  /** Bisa berisi `group` (mis. "disk0") yang ditampilkan di depan label. */
  labelParams?: Record<string, string>;
  value: string;
  valueCode?: string;
  valueParams?: Record<string, string>;
  /** Data eksperimental yang belum diverifikasi di hardware asli; tidak pernah mengubah status. */
  experimental: boolean;
}

export interface CheckResult {
  id: CheckId;
  category: CheckCategory;
  status: Status;
  summary: string;
  summaryCode?: string;
  summaryParams?: Record<string, string>;
  reasons: Reason[];
  metrics: Metric[];
  sources: string[];
  /** Keterbatasan deteksi: teks Indonesia + kode terjemahan. */
  notes: { text: string; code?: string; params?: Record<string, string> }[];
}

export interface DiagnosticsReport {
  hardware: HardwareSummary;
  /** Milidetik sejak UNIX epoch. */
  generatedAt: number;
  durationMs: number;
  checks: CheckResult[];
}

export type SupportLevel = "verified" | "preview";

export interface PlatformSupport {
  level: SupportLevel;
  note: string;
  noteCode?: string;
}

export interface AppInfo {
  name: string;
  version: string;
  os: string;
  arch: string;
  support: PlatformSupport;
}
