import { useEffect, useState } from "react";
import type { DiagnosticsReport, SystemOverview } from "../types/diagnostics";
import { api, inDesktopApp } from "../lib/api";
import { CHECK_ORDER, countByStatus, formatBytes, formatTimestamp } from "../lib/status";
import { CheckCard } from "../components/CheckCard";
import { StatusBadge } from "../components/StatusBadge";

const NOT_DESKTOP =
  "Halaman ini dibuka di browser biasa. Jalankan lewat aplikasi desktop (npm run tauri dev) untuk membaca data perangkat.";

export function DashboardPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = inDesktopApp();

  useEffect(() => {
    if (!desktop) {
      setError(NOT_DESKTOP);
      return;
    }
    api
      .getSystemOverview()
      .then(setOverview)
      .catch((e) => setError(String(e)));
  }, [desktop]);

  async function runChecks() {
    setRunning(true);
    setError(null);
    try {
      setReport(await api.runDiagnostics());
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }

  const facts: [string, string][] = overview
    ? [
        ["Sistem operasi", [overview.osName, overview.osVersion].filter(Boolean).join(" ")],
        ["Model", overview.model ?? "Tidak diketahui"],
        ["Prosesor", overview.cpu ?? "Tidak diketahui"],
        ["RAM", formatBytes(overview.memoryBytes)],
        ["Arsitektur", overview.arch],
        ["Core logis", overview.logicalCpus?.toString() ?? "Tidak diketahui"],
      ]
    : [];

  const counts = report ? countByStatus(report.checks) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ringkasan</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Semua pemeriksaan berjalan di perangkat ini, tanpa koneksi internet.
          </p>
        </div>
        <button
          type="button"
          onClick={runChecks}
          disabled={!desktop || running}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {running ? "Memeriksa…" : "Jalankan Pemeriksaan"}
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {error}
        </div>
      )}

      <section
        aria-label="Informasi perangkat"
        className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Perangkat ini</h2>
        {overview ? (
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-3">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="truncate text-sm font-medium" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{desktop ? "Membaca informasi…" : "—"}</p>
        )}
      </section>

      {report && counts && (
        <section
          aria-label="Hasil keseluruhan"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status keseluruhan</span>
            <StatusBadge status={report.overall} />
          </div>
          <span className="text-slate-500 dark:text-slate-400">
            {counts.pass} baik · {counts.warning} perlu perhatian · {counts.fail} bermasalah ·{" "}
            {counts.notImplemented} segera hadir
          </span>
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            Diperiksa {formatTimestamp(report.generatedAt)}
          </span>
        </section>
      )}

      <section aria-label="Pemeriksaan" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CHECK_ORDER.map((id) => (
          <CheckCard key={id} id={id} result={report?.checks.find((c) => c.id === id)} />
        ))}
      </section>
    </div>
  );
}
