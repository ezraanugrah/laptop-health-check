// Preferensi tema & bahasa (fungsi murni). Cermin `src-tauri/src/settings.rs`.
import { DEFAULT_LANG, isLang, type Lang } from "../i18n/translate.ts";

export type Theme = "dark" | "light";

export interface Settings {
  theme: Theme;
  language: Lang;
}

/** Default saat belum ada preferensi: Gelap + Bahasa Indonesia (keputusan pemilik). */
export const DEFAULT_SETTINGS: Settings = { theme: "dark", language: DEFAULT_LANG };

export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/** Nilai tidak dikenal jatuh ke default per field (sama seperti backend). */
export function sanitizeSettings(value: unknown): Settings {
  const v = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    theme: isTheme(v.theme) ? v.theme : DEFAULT_SETTINGS.theme,
    language: isLang(v.language) ? v.language : DEFAULT_SETTINGS.language,
  };
}

/** Kelas/atribut dokumen untuk tema & bahasa (tanpa style inline, sesuai CSP). */
export function documentAttributes(settings: Settings): { dark: boolean; lang: string } {
  return { dark: settings.theme === "dark", lang: settings.language === "en-US" ? "en" : "id" };
}
