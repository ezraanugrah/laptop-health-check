import type { AppInfo } from "../types/diagnostics";
import { useI18n } from "../lib/preferences";

export function AboutPage({ info }: { info: AppInfo | null }) {
  const { t } = useI18n();
  const rows: [string, string][] = info
    ? [
        [t("about.version"), info.version],
        [t("about.platform"), `${info.os} (${info.arch})`],
        [t("about.verification"), info.support.level === "verified" ? t("about.verified") : t("about.preview")],
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="font-semibold">{t("app.name")}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("about.description")}</p>
        {rows.length > 0 && (
          <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            {rows.map(([label, value]) => (
              <div key={label} className="flex flex-wrap justify-between gap-x-4">
                <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
