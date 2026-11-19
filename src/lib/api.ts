// Wrapper bertipe untuk command Tauri (lihat src-tauri/src/commands.rs).
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppInfo, DiagnosticsReport, SystemOverview } from "../types/diagnostics";

/** `false` bila halaman dibuka di browser biasa (mis. `npm run dev`), bukan di aplikasi desktop. */
export const inDesktopApp = isTauri;

export const api = {
  getAppInfo: () => invoke<AppInfo>("get_app_info"),
  getSystemOverview: () => invoke<SystemOverview>("get_system_overview"),
  runDiagnostics: () => invoke<DiagnosticsReport>("run_diagnostics"),
};
