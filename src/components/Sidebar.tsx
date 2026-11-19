import type { UiKey } from "../i18n/translate";
import { useI18n } from "../lib/preferences";

export type PageId = "dashboard" | "tests" | "reports" | "settings" | "about";

const NAV: { id: PageId; label: UiKey; soon?: boolean }[] = [
  { id: "dashboard", label: "nav.dashboard" },
  { id: "tests", label: "nav.tests" },
  { id: "reports", label: "nav.reports", soon: true },
  { id: "settings", label: "nav.settings" },
  { id: "about", label: "nav.about" },
];

interface Props {
  active: PageId;
  onNavigate: (page: PageId) => void;
  version?: string;
}

export function Sidebar({ active, onNavigate, version }: Props) {
  const { t } = useI18n();
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="px-5 pt-6 pb-4">
        <p className="text-base font-semibold tracking-tight">{t("app.name")}</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">{t("app.tagline")}</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label={t("nav.main")}>
        {NAV.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? "bg-slate-900 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {t(item.label)}
              {item.soon && (
                <span
                  className={`text-[10px] uppercase tracking-wide ${isActive ? "opacity-80" : "text-slate-500 dark:text-slate-400"}`}
                >
                  {t("nav.soon")}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        {t("app.offline")}
        {version && <span className="ml-auto">v{version}</span>}
      </div>
    </aside>
  );
}
