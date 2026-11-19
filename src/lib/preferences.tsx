// Provider preferensi (tema + bahasa) dan hook i18n untuk komponen.
// Perubahan diterapkan seketika (kelas `dark` di <html>, atribut lang) lalu
// disimpan lokal: di aplikasi desktop lewat Rust (settings.json), di browser
// pratinjau lewat localStorage. Tidak pernah dikirim ke mana pun.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, inDesktopApp } from "./api";
import { DEFAULT_SETTINGS, documentAttributes, sanitizeSettings, type Settings } from "./settings";
import {
  bind,
  formatDateTime,
  formatDuration,
  formatTime,
  translateLabel,
  translateText,
  type CodedText,
  type Lang,
  type T,
} from "../i18n/translate";

const BROWSER_KEY = "lhc-settings";

type SaveState = "idle" | "saving" | "saved" | "error";

interface PreferencesContext {
  settings: Settings;
  loaded: boolean;
  saveState: SaveState;
  saveError: string | null;
  update: (patch: Partial<Settings>) => void;
  lang: Lang;
  t: T;
  tx: (message: CodedText) => string;
  label: (text: string, code?: string, params?: Record<string, string>) => string;
  dateTime: (ms: number) => string;
  time: (iso: string) => string;
  duration: (ms: number) => string;
}

const Ctx = createContext<PreferencesContext | null>(null);

function applyToDocument(settings: Settings) {
  const { dark, lang } = documentAttributes(settings);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.lang = lang;
}

function readBrowser(): Settings {
  try {
    const raw = window.localStorage.getItem(BROWSER_KEY);
    return raw ? sanitizeSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const desktop = inDesktopApp();

  useEffect(() => {
    let cancelled = false;
    const done = (s: Settings) => {
      if (cancelled) return;
      setSettings(s);
      setLoaded(true);
    };
    if (desktop) {
      api
        .getSettings()
        .then((s) => done(sanitizeSettings(s)))
        .catch(() => done(DEFAULT_SETTINGS));
    } else {
      done(readBrowser());
    }
    return () => {
      cancelled = true;
    };
  }, [desktop]);

  useEffect(() => applyToDocument(settings), [settings]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      const next = sanitizeSettings({ ...settings, ...patch });
      setSettings(next);
      setSaveState("saving");
      setSaveError(null);
      const persist = desktop
        ? api.saveSettings(next).then(() => undefined)
        : Promise.resolve().then(() => window.localStorage.setItem(BROWSER_KEY, JSON.stringify(next)));
      persist
        .then(() => setSaveState("saved"))
        .catch((e: unknown) => {
          setSaveState("error");
          setSaveError(String(e));
        });
    },
    [settings, desktop],
  );

  const value = useMemo<PreferencesContext>(() => {
    const lang = settings.language;
    return {
      settings,
      loaded,
      saveState,
      saveError,
      update,
      lang,
      t: bind(lang),
      tx: (m) => translateText(lang, m),
      label: (text, code, params) => translateLabel(lang, text, code, params),
      dateTime: (ms) => formatDateTime(lang, ms),
      time: (iso) => formatTime(lang, iso),
      duration: (ms) => formatDuration(lang, ms),
    };
  }, [settings, loaded, saveState, saveError, update]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences(): PreferencesContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePreferences harus dipakai di dalam PreferencesProvider");
  return ctx;
}

/** Hook i18n singkat untuk komponen. */
export const useI18n = usePreferences;
