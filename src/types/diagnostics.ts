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

/** Kelompok pemeriksaan (D1/D3). */
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

export interface Reason {
  level: ReasonLevel;
  text: string;
}

export interface Metric {
  label: string;
  value: string;
  /** Data eksperimental yang belum diverifikasi di hardware asli (D5). */
  experimental: boolean;
}

export interface CheckResult {
  id: CheckId;
  category: CheckCategory;
  status: Status;
  summary: string;
  reasons: Reason[];
  metrics: Metric[];
  sources: string[];
  notes: string[];
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
}

export interface AppInfo {
  name: string;
  version: string;
  os: string;
  arch: string;
  support: PlatformSupport;
}
