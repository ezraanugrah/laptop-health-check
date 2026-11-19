// Tipe Tes Touch Bar. Bagian yang berasal dari Rust adalah CERMIN dari
// src-tauri/src/touchbar.rs (serde camelCase, dijaga test `serializes_camel_case_for_frontend`).

/** Cermin `touchbar::SessionInfo` (hasil `touchbar_test_start`). */
export interface TouchBarSession {
  session: number;
  segments: number;
  /** Bar uji terpasang di NSWindow utama. */
  windowInstalled: boolean;
  /** Bar uji terpasang di WKWebView utama. */
  webviewInstalled: boolean;
}

/** Cermin `touchbar::TouchBarStatus` (hasil `touchbar_test_status`). */
export interface TouchBarStatus {
  active: boolean;
  session: number | null;
  segments: number;
  /** `NSTouchBar.isVisible` menurut macOS; `null` bila tidak ada sesi. */
  visible: boolean | null;
  taps: number;
  windowInstalled: boolean;
  webviewInstalled: boolean;
}

/** Cermin `touchbar::TapEvent` (event `touchbar-tap`). `index` mulai dari 0. */
export interface TouchBarTap {
  session: number;
  index: number;
  segments: number;
}
