import { useCallback, useEffect, useRef, useState } from "react";
import type { AppInfo, DiagnosticsReport } from "../types/diagnostics";
import { api, inDesktopApp } from "../lib/api";
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  CHECK_ORDER,
  categoryOf,
  checkTitle,
  coverageText,
  formatDuration,
  formatTimestamp,
  missingText,
} from "../lib/status";
import { CheckCard } from "../components/CheckCard";
import { SerialNumberRow } from "../components/SerialNumberRow";
import { HardwareStatusBadge, StatusBadge } from "../components/StatusBadge";

const NOT_DESKTOP =
  "Halaman ini dibuka di browser biasa. Jalankan lewat aplikasi desktop (npm run tauri dev) untuk membaca data perangkat.";

export function DashboardPage({ appInfo }: { appInfo: AppInfo | null }) {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktop = inDesktopApp();
  const started = useRef(false);
  const os = appInfo?.os;

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

  const deviceChecks = report?.checks.filter((c) => c.category === "deviceSecurity") ?? [];

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

      {appInfo?.support.level === "preview" && (
        <div
          role="note"
          className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200"
        >
          <span className="font-semibold">Pratinjau — belum diverifikasi di hardware asli.</span>{" "}
          {appInfo.support.note}
        </div>
      )}

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
          aria-label="Ringkasan hasil"
          className="space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Kesehatan hardware</span>
              <HardwareStatusBadge status={report.hardware.status} />
            </div>
            <span className="text-slate-600 dark:text-slate-400">
              {coverageText(report.hardware)}
            </span>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              Diperiksa {formatTimestamp(report.generatedAt)} · {formatDuration(report.durationMs)}
            </span>
          </div>
          {missingText(report.hardware, os).map((line) => (
            <p key={line} className="text-xs text-slate-600 dark:text-slate-400">
              {line}
            </p>
          ))}
          {deviceChecks.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <span>Dinilai terpisah:</span>
              {deviceChecks.map((c) => (
                <span key={c.id} className="flex items-center gap-1.5">
                  {checkTitle(c.id, os)} <StatusBadge status={c.status} />
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {CATEGORY_ORDER.map((category) => (
        <section key={category} aria-label={CATEGORY_META[category].title} className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {CATEGORY_META[category].title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {CATEGORY_META[category].description}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {CHECK_ORDER.filter((id) => categoryOf(id) === category).map((id) => (
              <CheckCard
                key={id}
                id={id}
                title={checkTitle(id, os)}
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
