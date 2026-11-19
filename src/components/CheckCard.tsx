import type { ReactNode } from "react";
import type { CheckId, CheckResult } from "../types/diagnostics";
import { REASON_TONE } from "../lib/status";
import { StatusBadge, TONE_DOT } from "./StatusBadge";

interface Props {
  id: CheckId;
  /** Judul sesuai OS (lihat `checkTitle`). */
  title: string;
  /** `undefined` = pemeriksaan belum selesai/dijalankan. */
  result?: CheckResult;
  loading?: boolean;
  children?: ReactNode;
}

export function CheckCard({ id, title, result, loading, children }: Props) {
  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-6">{title}</h3>
        {result ? (
          <StatusBadge status={result.status} />
        ) : (
          loading && <span className="text-xs text-slate-400">Memeriksa…</span>
        )}
      </header>

      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        {result ? result.summary : loading ? "Membaca data dari perangkat…" : "Belum dijalankan."}
      </p>

      {result && result.reasons.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs leading-snug" aria-label="Alasan status">
          {result.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span
                className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[REASON_TONE[r.level]]}`}
                aria-hidden
              />
              <span className="text-slate-700 dark:text-slate-300">{r.text}</span>
            </li>
          ))}
        </ul>
      )}

      {result && result.metrics.length > 0 && (
        <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
          {result.metrics.map((m) => (
            <div key={m.label} className="flex justify-between gap-3">
              <dt className="flex shrink-0 items-center gap-1.5 text-slate-500 dark:text-slate-400">
                {m.label}
                {m.experimental && (
                  <span
                    className="rounded bg-amber-100 px-1 py-px text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    title="Data eksperimental: belum diverifikasi di hardware asli dan tidak memengaruhi status."
                  >
                    eksperimental
                  </span>
                )}
              </dt>
              <dd className="truncate text-right font-medium" title={m.value}>
                {m.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {result && (result.sources.length > 0 || result.notes.length > 0) && (
        <footer className="mt-auto space-y-1 pt-3 text-[11px] leading-snug text-slate-400 dark:text-slate-500">
          {result.sources.length > 0 && <p>Sumber: {result.sources.join(" · ")}</p>}
          {result.notes.length > 0 && (
            <details open={id === "ownership"}>
              <summary className="cursor-pointer select-none text-slate-500 dark:text-slate-400">
                Keterbatasan deteksi
              </summary>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {result.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </details>
          )}
        </footer>
      )}
    </article>
  );
}
