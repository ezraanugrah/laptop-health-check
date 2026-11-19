import { useMemo, useState } from "react";
import type { AppInfo, DiagnosticsReport } from "../types/diagnostics";
import type { InteractiveResults } from "../types/interactive";
import { api, inDesktopApp } from "../lib/api";
import { buildReport, reportFileName, reportJson, reportTestTone } from "../lib/report";
import { STATUS_META, HARDWARE_STATUS_META } from "../lib/status";
import { useI18n } from "../lib/preferences";
import { ToneBadge } from "../components/StatusBadge";
import { PrintableReport } from "../components/report/PrintableReport";

interface Props {
  appInfo: AppInfo | null;
  diagnostics: DiagnosticsReport | null;
  interactive: InteractiveResults;
  running: boolean;
  onRunDiagnostics: () => void;
}

type Message = { kind: "ok" | "info" | "error"; text: string } | null;

export function ReportPage({ appInfo, diagnostics, interactive, running, onRunDiagnostics }: Props) {
  const { t, lang } = useI18n();
  const desktop = inDesktopApp();
  const [includeSerial, setIncludeSerial] = useState(false);
  const [serial, setSerial] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  // Waktu "dibuat" diperbarui setiap data/bahasa/pilihan berubah dan saat ekspor.
  const [stamp, setStamp] = useState(() => new Date());

  const doc = useMemo(
    () =>
      buildReport({
        lang,
        now: stamp,
        appInfo,
        diagnostics,
        interactive,
        serialNumber: includeSerial ? serial : null,
      }),
    [lang, stamp, appInfo, diagnostics, interactive, includeSerial, serial],
  );

  // Nomor seri hanya dibaca saat pengguna mencentang (opt-in), tidak pernah otomatis.
  const toggleSerial = async (checked: boolean) => {
    setIncludeSerial(checked);
    setMessage(null);
    if (!checked) {
      setSerial(null);
      return;
    }
    try {
      const value = await api.getSerialNumber();
      setSerial(value);
      if (!value) setMessage({ kind: "info", text: t("report.page.serialUnavailable") });
    } catch {
      setSerial(null);
      setMessage({ kind: "info", text: t("report.page.serialUnavailable") });
    }
  };

  const exportJson = async () => {
    setBusy(true);
    setMessage(null);
    const now = new Date();
    setStamp(now);
    try {
      const fresh = buildReport({ lang, now, appInfo, diagnostics, interactive, serialNumber: includeSerial ? serial : null });
      const saved = await api.exportReportJson(reportJson(fresh), reportFileName(fresh, now, "json"));
      setMessage(saved ? { kind: "ok", text: t("report.page.saved") } : { kind: "info", text: t("report.page.cancelled") });
    } catch (e) {
      setMessage({ kind: "error", text: t("report.page.failed", { error: String(e) }) });
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    setMessage(null);
    setStamp(new Date());
    // Beri React satu frame untuk merender versi cetak terbaru sebelum dialog dibuka.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      await api.printReport();
    } catch (e) {
      setMessage({ kind: "error", text: t("report.page.failed", { error: String(e) }) });
    }
  };

  const messageClass =
    message?.kind === "error"
      ? "text-red-700 dark:text-red-300"
      : message?.kind === "ok"
        ? "text-emerald-700 dark:text-emerald-300"
        : "text-slate-700 dark:text-slate-300";

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t("report.page.subtitle")}</p>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-slate-900 dark:accent-slate-100"
            checked={includeSerial}
            disabled={!desktop}
            onChange={(e) => void toggleSerial(e.target.checked)}
          />
          <span>
            <span className="font-medium">{t("report.page.includeSerial")}</span>
            <span className="block text-xs text-slate-600 dark:text-slate-400">{t("report.page.includeSerialHint")}</span>
          </span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void exportJson()}
            disabled={!desktop || busy}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {t("report.page.exportJson")}
          </button>
          <button
            type="button"
            onClick={() => void exportPdf()}
            disabled={!desktop || busy}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {t("report.page.exportPdf")}
          </button>
        </div>
        <p className="w-full text-xs text-slate-600 dark:text-slate-400">{t("report.page.pdfHint")}</p>
        {message && (
          <p role="status" className={`w-full text-sm ${messageClass}`}>
            {message.text}
          </p>
        )}
        {!desktop && <p className="w-full text-xs text-slate-600 dark:text-slate-400">{t("report.page.browserMode")}</p>}
      </section>

      {!diagnostics && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <span>{t("report.page.noDiagnostics")}</span>
          <button
            type="button"
            onClick={onRunDiagnostics}
            disabled={!desktop || running}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {running ? t("report.page.running") : t("report.page.runChecks")}
          </button>
        </section>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{t("report.page.preview")}</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="font-semibold">{t("report.doc.device")}</h3>
          <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-1 text-sm">
            {doc.device.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-slate-600 dark:text-slate-400">{d.label}</dt>
                <dd>{d.value}</dd>
              </div>
            ))}
            <dt className="text-slate-600 dark:text-slate-400">{t("report.doc.serial")}</dt>
            <dd>{doc.serialNumber ?? t("report.doc.serialHidden")}</dd>
            <dt className="text-slate-600 dark:text-slate-400">{t("report.doc.generatedAt")}</dt>
            <dd>{doc.generatedAtText}</dd>
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold">{t("report.doc.checks")}</h3>
            {diagnostics && (
              <ToneBadge
                label={t(HARDWARE_STATUS_META[diagnostics.hardware.status].label)}
                tone={HARDWARE_STATUS_META[diagnostics.hardware.status].tone}
              />
            )}
          </div>
          {doc.diagnostics.ran ? (
            <ul className="mt-2 space-y-1.5 text-sm">
              {doc.checks.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-medium">{c.title}</span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">{c.summary}</span>
                  </span>
                  <ToneBadge label={c.statusLabel} tone={STATUS_META[c.status].tone} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{t("report.doc.notRunYet")}</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{t("report.doc.interactive")}</h3>
          <span className="text-xs text-slate-600 dark:text-slate-400">{doc.interactive.summary}</span>
        </div>
        <ul className="mt-2 grid gap-x-6 gap-y-1.5 text-sm md:grid-cols-2">
          {doc.interactive.tests.map((tst) => (
            <li key={tst.id} className="flex items-start justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium">{tst.title}</span>
                {tst.summary && <span className="block text-xs text-slate-600 dark:text-slate-400">{tst.summary}</span>}
              </span>
              <ToneBadge label={tst.outcomeLabel} tone={reportTestTone(tst.outcome)} />
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("report.doc.notes")}</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {doc.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <PrintableReport doc={doc} />
    </div>
  );
}
