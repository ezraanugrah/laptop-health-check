// Preferensi tema & bahasa (fungsi murni). Cermin `src-tauri/src/settings.rs`.
import { DEFAULT_LANG, isLang, type Lang, type UiKey } from "../i18n/translate.ts";

export type Theme = "dark" | "light";

/** Pilihan di menu bahasa header. Kode & bendera bukan teks terjemahan; nama bahasa lewat i18n. */
export interface LanguageOption {
  value: Lang;
  code: string;
  flag: string;
  label: UiKey;
  /** Nilai atribut `lang` HTML. */
  htmlLang: string;
}

export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { value: "id-ID", code: "ID", flag: "🇮🇩", label: "prefs.lang.id", htmlLang: "id" },
  { value: "en-US", code: "EN", flag: "🇬🇧", label: "prefs.lang.en", htmlLang: "en" },
];

export function languageOption(lang: Lang): LanguageOption {
  return LANGUAGE_OPTIONS.find((o) => o.value === lang) ?? LANGUAGE_OPTIONS[0];
}

export const THEME_LABEL: Record<Theme, UiKey> = { light: "prefs.theme.light", dark: "prefs.theme.dark" };

/** Tema tujuan tombol tema di header. */
export function otherTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

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
  return { dark: settings.theme === "dark", lang: languageOption(settings.language).htmlLang };
}
