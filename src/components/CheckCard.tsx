import type { CheckId, CheckResult } from "../types/diagnostics";
import { CHECK_TITLES } from "../lib/status";
import { StatusBadge } from "./StatusBadge";

interface Props {
  id: CheckId;
  /** `undefined` = pemeriksaan belum dijalankan. */
  result?: CheckResult;
}

export function CheckCard({ id, result }: Props) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{CHECK_TITLES[id]}</h3>
        {result && <StatusBadge status={result.status} />}
      </header>

      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {result ? result.summary : "Belum dijalankan."}
      </p>

      {result && result.metrics.length > 0 && (
        <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          {result.metrics.map((m) => (
            <div key={m.label} className="flex justify-between gap-4">
              <dt className="shrink-0 text-slate-500 dark:text-slate-400">{m.label}</dt>
              <dd className="truncate text-right font-medium" title={m.value}>
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
