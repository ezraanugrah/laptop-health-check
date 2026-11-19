import type { ReactNode } from "react";
import type { UiKey } from "../i18n/translate";
import type { Lang } from "../i18n/types";
import { inDesktopApp } from "../lib/api";
import { useI18n } from "../lib/preferences";
import type { Theme } from "../lib/settings";

interface Option<V extends string> {
  value: V;
  label: UiKey;
}

const THEMES: Option<Theme>[] = [
  { value: "light", label: "settings.theme.light" },
  { value: "dark", label: "settings.theme.dark" },
];

const LANGUAGES: Option<Lang>[] = [
  { value: "id-ID", label: "settings.lang.id" },
  { value: "en-US", label: "settings.lang.en" },
];

function Choice<V extends string>({
  name,
  options,
  value,
  onChange,
}: {
  name: string;
  options: Option<V>[];
  value: V;
  onChange: (v: V) => void;
}) {
  const { t } = useI18n();
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
              active
                ? "border-slate-900 bg-slate-900 font-medium text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            }`}
          >
            <span>{t(o.label)}</span>
            {active && <span className="text-xs font-normal opacity-90">✓ {t("settings.active")}</span>}
          </button>
        );
      })}
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function SettingsPage() {
  const { t, settings, update, saveState, saveError } = useI18n();
  return (
    <div className="mx-auto max-w-3xl space-y-5 p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("settings.title")}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("settings.subtitle")}</p>
      </header>

      <Section title={t("settings.appearance")} hint={t("settings.appearanceHint")}>
        <Choice name={t("settings.appearance")} options={THEMES} value={settings.theme} onChange={(theme) => update({ theme })} />
      </Section>

      <Section title={t("settings.language")} hint={t("settings.languageHint")}>
        <Choice
          name={t("settings.language")}
          options={LANGUAGES}
          value={settings.language}
          onChange={(language) => update({ language })}
        />
      </Section>

      <p className="min-h-5 text-xs text-slate-600 dark:text-slate-400" aria-live="polite">
        {saveState === "saved" && `✓ ${t("settings.saved")}`}
        {saveState === "error" && t("settings.saveFailed", { error: saveError ?? "" })}
      </p>
      {!inDesktopApp() && <p className="text-xs text-slate-600 dark:text-slate-400">{t("settings.browserNote")}</p>}
    </div>
  );
}
