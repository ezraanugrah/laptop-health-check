import { useI18n } from "../../lib/preferences";
import { LanguageMenu } from "./LanguageMenu";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Header global di area konten (kanan sidebar): judul halaman aktif di kiri,
 * bahasa & tema di kanan. Berada di luar area gulir sehingga selalu terlihat.
 * `z-30` berada di bawah overlay tes layar/keyboard (`z-40`/`z-50`).
 */
export function AppHeader({ title }: { title: string }) {
  const { t, saveState, saveError } = useI18n();
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      <h1 className="min-w-0 truncate text-lg font-semibold tracking-tight">{title}</h1>
      <div role="group" aria-label={t("prefs.controls")} className="flex shrink-0 items-center gap-2">
        <span role="status" className="text-xs font-medium text-red-700 dark:text-red-300">
          {saveState === "error" && (
            <span title={t("prefs.saveFailed", { error: saveError ?? "" })}>⚠ {t("prefs.saveFailedShort")}</span>
          )}
        </span>
        <LanguageMenu />
        <ThemeToggle />
      </div>
    </header>
  );
}
