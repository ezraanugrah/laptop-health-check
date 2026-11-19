// Cermin dari `src-tauri/src/diagnostics/types.rs`.
// Setiap perubahan di Rust WAJIB disalin ke sini (field dalam camelCase).

export type CheckId = "system" | "battery" | "storage" | "cpu" | "memory";

export type Status =
  | "pass"
  | "warning"
  | "fail"
  | "unknown"
  | "notImplemented"
  | "unsupported";

export interface Metric {
  label: string;
  value: string;
}

export interface CheckResult {
  id: CheckId;
  status: Status;
  summary: string;
  metrics: Metric[];
}

export interface DiagnosticsReport {
  overall: Status;
  /** Milidetik sejak UNIX epoch. */
  generatedAt: number;
  checks: CheckResult[];
}

export interface SystemOverview {
  osName: string;
  osVersion: string | null;
  osBuild: string | null;
  arch: string;
  model: string | null;
  cpu: string | null;
  logicalCpus: number | null;
  memoryBytes: number | null;
}

export interface AppInfo {
  name: string;
  version: string;
  os: string;
  arch: string;
}
