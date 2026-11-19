import type { AppInfo, DiagnosticsReport } from "../types/diagnostics";
import { inDesktopApp } from "../lib/api";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  CHECK_ORDER,
  categoryOf,
  checkTitle,
  coverageText,
  missingText,
} from "../lib/status";
import { useI18n } from "../lib/preferences";
import { CheckCard } from "../components/CheckCard";
import { SerialNumberRow } from "../components/SerialNumberRow";
import { HardwareStatusBadge, StatusBadge } from "../components/StatusBadge";

interface Props {
  appInfo: AppInfo | null;
  /** Hasil diagnostik dikelola App agar dipakai bersama halaman Laporan. */
  report: DiagnosticsReport | null;
  running: boolean;
  error: string | null;
  onRun: () => void;
}

export function DashboardPage({ appInfo, report, running, error, onRun }: Props) {
  const { t, tx, dateTime, duration } = useI18n();
  const desktop = inDesktopApp();
  const runChecks = async () => onRun();

  const deviceChecks = report?.checks.filter((c) => c.category === "deviceSecurity") ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">{t("dashboard.subtitle")}</p>
        <button
          type="button"
          onClick={() => void runChecks()}
          disabled={!desktop || running}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {running ? t("dashboard.running") : t("dashboard.rerun")}
        </button>
      </header>

      {appInfo?.support.level === "preview" && (
        <div
          role="note"
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <span className="font-semibold">{t("dashboard.previewTitle")}</span>{" "}
          {tx({ text: appInfo.support.note, code: appInfo.support.noteCode })}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {error === "notDesktop" ? t("dashboard.notDesktop") : error}
        </div>
      )}

      {report && (
        <section
          aria-label={t("dashboard.resultSummary")}
          className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{t("dashboard.hardwareHealth")}</span>
              <HardwareStatusBadge status={report.hardware.status} />
            </div>
            <span className="text-slate-600 dark:text-slate-400">
              {coverageText(report.hardware, t)}
            </span>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              {t("dashboard.checkedAt", { time: dateTime(report.generatedAt), duration: duration(report.durationMs) })}
            </span>
          </div>
          {missingText(report.hardware, t).map((line) => (
            <p key={line} className="text-xs text-slate-600 dark:text-slate-400">
              {line}
            </p>
          ))}
          {deviceChecks.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <span>{t("dashboard.assessedSeparately")}</span>
              {deviceChecks.map((c) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  {checkTitle(c.id, t)} <StatusBadge status={c.status} />
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {CATEGORY_ORDER.map((category) => (
        <section key={category} aria-label={t(CATEGORY_META[category].title)} className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {t(CATEGORY_META[category].title)}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t(CATEGORY_META[category].description)}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CHECK_ORDER.filter((id) => categoryOf(id) === category).map((id) => (
              <CheckCard
                key={id}
                id={id}
                title={checkTitle(id, t)}
                result={report?.checks.find((c) => c.id === id)}
                loading={running && !report}
              >
                {id === "system" && desktop && <SerialNumberRow />}
              </CheckCard>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
