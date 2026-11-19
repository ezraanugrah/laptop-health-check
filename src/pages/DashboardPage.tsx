import { useCallback, useEffect, useRef, useState } from "react";
import type { DiagnosticsReport } from "../types/diagnostics";
import { api, inDesktopApp } from "../lib/api";
import {
  CHECK_ORDER,
  countByStatus,
  formatDuration,
  formatTimestamp,
  summarizeCounts,
} from "../lib/status";
import { CheckCard } from "../components/CheckCard";
import { SerialNumberRow } from "../components/SerialNumberRow";
import { StatusBadge } from "../components/StatusBadge";

const NOT_DESKTOP =
  "Halaman ini dibuka di browser biasa. Jalankan lewat aplikasi desktop (npm run tauri dev) untuk membaca data perangkat.";

export function DashboardPage() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = inDesktopApp();
  const started = useRef(false);

  const runChecks = useCallback(async () => {
    setRunning(true);
    setError(null);
    try {
      setReport(await api.runDiagnostics());
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  }, []);

  // Pemeriksaan otomatis saat aplikasi dibuka (sekali, aman untuk StrictMode).
  useEffect(() => {
    if (!desktop) {
      setError(NOT_DESKTOP);
      return;
    }
    if (started.current) return;
    started.current = true;
    void runChecks();
  }, [desktop, runChecks]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ringkasan</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Data dibaca langsung dari perangkat ini, tanpa koneksi internet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runChecks()}
          disabled={!desktop || running}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {running ? "Memeriksa…" : "Periksa ulang"}
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

      {report && (
        <section
          aria-label="Hasil keseluruhan"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status keseluruhan</span>
            <StatusBadge status={report.overall} />
          </div>
          <span className="text-slate-600 dark:text-slate-400">
            {summarizeCounts(countByStatus(report.checks))}
          </span>
          <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
            Diperiksa {formatTimestamp(report.generatedAt)} · {formatDuration(report.durationMs)}
          </span>
        </section>
      )}

      <section aria-label="Pemeriksaan" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CHECK_ORDER.map((id) => (
          <CheckCard
            key={id}
            id={id}
            result={report?.checks.find((c) => c.id === id)}
            loading={running && !report}
          >
            {id === "system" && desktop && <SerialNumberRow />}
          </CheckCard>
        ))}
      </section>
    </div>
  );
}
