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

export type Status = "healthy" | "warning" | "critical" | "unknown" | "notApplicable";

export type ReasonLevel = "critical" | "warning" | "ok" | "info";

export interface Reason {
  level: ReasonLevel;
  text: string;
}

export interface Metric {
  label: string;
  value: string;
}

export interface CheckResult {
  id: CheckId;
  status: Status;
  summary: string;
  reasons: Reason[];
  metrics: Metric[];
  sources: string[];
  notes: string[];
}

export interface DiagnosticsReport {
  overall: Status;
  /** Milidetik sejak UNIX epoch. */
  generatedAt: number;
  durationMs: number;
  checks: CheckResult[];
}

export interface AppInfo {
  name: string;
  version: string;
  os: string;
  arch: string;
}
