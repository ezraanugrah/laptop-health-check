// Inti i18n (fungsi murni, tanpa React) — satu-satunya tempat terjemahan dipilih.
//
// Urutan fallback:
//   1. bahasa aktif,
//   2. Bahasa Indonesia (bahasa default),
//   3. untuk pesan backend: teks Indonesia dari Rust (`text`),
//   4. nama kunci itu sendiri (agar kunci yang hilang terlihat, bukan kosong).
// Kunci yang hilang dicatat sekali di konsol (mode pengembangan) dan bisa
// dibaca lewat `missingKeys()` untuk test.
import { BACKEND_MESSAGES } from "./backend.ts";
import { UI_MESSAGES } from "./ui.ts";
import type { CodedText, Entry, Lang, Params } from "./types.ts";

export type { CodedText, Lang, Params } from "./types.ts";
export type UiKey = keyof typeof UI_MESSAGES;

export const LANGS: Lang[] = ["id-ID", "en-US"];
export const DEFAULT_LANG: Lang = "id-ID";

const CATALOG: Record<string, Entry> = { ...BACKEND_MESSAGES, ...UI_MESSAGES };
const missing = new Set<string>();

export function isLang(value: unknown): value is Lang {
  return value === "id-ID" || value === "en-US";
}

/** Template untuk kunci di bahasa tertentu, dengan fallback ke Indonesia. */
export function lookup(lang: Lang, key: string): string | undefined {
  const entry = CATALOG[key];
  if (!entry) return undefined;
  const text = lang === "en-US" ? entry.en : entry.id;
  return text || entry.id || undefined;
}

function resolveParam(lang: Lang, value: string | number | string[]): string {
  if (Array.isArray(value)) return value.map((v) => resolveParam(lang, v)).join(", ");
  if (typeof value === "string" && value.startsWith("@")) {
    const nested = lookup(lang, value.slice(1));
    if (nested !== undefined) return nested;
  }
  return String(value);
}

export function interpolate(template: string, params?: Params, lang: Lang = DEFAULT_LANG): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    params[name] === undefined ? whole : resolveParam(lang, params[name]),
  );
}

function reportMissing(key: string): void {
  if (missing.has(key)) return;
  missing.add(key);
  if (typeof console !== "undefined" && (globalThis as { process?: unknown }).process === undefined) {
    console.warn(`[i18n] kunci tidak ditemukan: ${key}`);
  }
}

export function missingKeys(): string[] {
  return [...missing];
}

/** Terjemahan kunci UI/backend. Kunci yang tidak ada dikembalikan apa adanya. */
export function translate(lang: Lang, key: string, params?: Params): string {
  const template = lookup(lang, key);
  if (template === undefined) {
    reportMissing(key);
    return key;
  }
  return interpolate(template, params, lang);
}

/** Pesan backend: pakai kode bila dikenal, selain itu teks Indonesia dari Rust. */
export function translateText(lang: Lang, message: CodedText): string {
  if (message.code) {
    const template = lookup(lang, message.code);
    if (template !== undefined) return interpolate(template, message.params, lang);
    reportMissing(message.code);
  }
  return message.text;
}

/**
 * Label metrik. Bila backend mengirim parameter `group` (mis. "disk0", "GPU 1"),
 * grup ditampilkan di depan label terjemahan: "disk0 · Model".
 */
export function translateLabel(
  lang: Lang,
  text: string,
  code: string | undefined,
  params: Record<string, string> | undefined,
): string {
  if (!code) return text;
  const template = lookup(lang, code);
  if (template === undefined) {
    reportMissing(code);
    return text;
  }
  const label = interpolate(template, params, lang);
  return params?.group ? `${params.group} · ${label}` : label;
}

export function formatDateTime(lang: Lang, ms: number): string {
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(ms));
}

export function formatTime(lang: Lang, iso: string): string {
  return new Intl.DateTimeFormat(lang, { timeStyle: "medium" }).format(new Date(iso));
}

export function formatDuration(lang: Lang, ms: number): string {
  return ms < 1000
    ? translate(lang, "duration.ms", { n: Math.round(ms) })
    : translate(lang, "duration.seconds", { n: (ms / 1000).toFixed(1) });
}

/** Fungsi terjemahan terikat bahasa (dipakai komponen dan helper murni). */
export type T = (key: UiKey, params?: Params) => string;

export function bind(lang: Lang): T {
  return (key, params) => translate(lang, key, params);
}
