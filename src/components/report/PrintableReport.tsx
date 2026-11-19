import { createPortal } from "react-dom";
import type { ReportDoc } from "../../lib/report";
import { useI18n } from "../../lib/preferences";

const LEVEL_MARK: Record<string, string> = { critical: "✕", warning: "!", ok: "✓", info: "·" };

/**
 * Versi cetak laporan (untuk "Simpan sebagai PDF"). Hanya tampil saat mencetak
 * (`hidden print:block`) dan dirender langsung di <body> agar halaman bisa terpotong
 * normal. Warna selalu gelap-di-atas-putih, tidak mengikuti tema gelap.
 */
export function PrintableReport({ doc }: { doc: ReportDoc }) {
  const { t } = useI18n();
  return createPortal(
    <div className="hidden bg-white p-8 text-[11pt] leading-snug text-slate-900 print:block" lang={doc.language === "en-US" ? "en" : "id"}>
      <header className="border-b border-slate-300 pb-3">
        <h1 className="text-xl font-bold">{doc.title}</h1>
        <p className="mt-1 text-slate-700">
          {t("report.doc.generatedAt")}: {doc.generatedAtText} · {t("report.doc.app")}: {doc.app.name}
          {doc.app.version ? ` ${doc.app.version}` : ""}
          {doc.app.arch ? ` (${doc.app.arch})` : ""}
        </p>
        {doc.support && (
          <p className="text-slate-700">
            {t("report.doc.support")}: {doc.support.label}
          </p>
        )}
      </header>

      <section className="mt-4 break-inside-avoid">
        <h2 className="text-base font-bold">{t("report.doc.device")}</h2>
        <table className="mt-1 w-full">
          <tbody>
            {doc.device.map((d) => (
              <tr key={d.label}>
                <td className="w-1/3 py-0.5 pr-3 align-top text-slate-700">{d.label}</td>
                <td className="py-0.5">{d.value}</td>
              </tr>
            ))}
            <tr>
              <td className="w-1/3 py-0.5 pr-3 align-top text-slate-700">{t("report.doc.serial")}</td>
              <td className="py-0.5">{doc.serialNumber ?? t("report.doc.serialHidden")}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-4">
        <h2 className="text-base font-bold">{t("report.doc.checks")}</h2>
        {doc.diagnostics.ran ? (
          <p className="text-slate-700">
            {t("report.doc.hardware")}: <span className="font-semibold text-slate-900">{doc.diagnostics.hardwareStatusLabel}</span> ·{" "}
            {doc.diagnostics.coverage} · {t("report.doc.checkedAt")}: {doc.diagnostics.checkedAtText}
          </p>
        ) : (
          <p className="text-slate-700">{t("report.doc.notRunYet")}</p>
        )}
        {doc.diagnostics.missing.map((m) => (
          <p key={m} className="text-slate-700">
            {m}
          </p>
        ))}
        {doc.checks.map((c) => (
          <article key={c.id} className="mt-3 break-inside-avoid border-t border-slate-200 pt-2">
            <h3 className="font-semibold">
              {c.title} — {c.statusLabel}
            </h3>
            <p>{c.summary}</p>
            {c.reasons.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {c.reasons.map((r, i) => (
                  <li key={i}>
                    <span className="mr-1 font-mono text-slate-700">{LEVEL_MARK[r.level] ?? "·"}</span>
                    {r.text}
                  </li>
                ))}
              </ul>
            )}
            {c.metrics.length > 0 && (
              <table className="mt-1 w-full text-[10pt]">
                <tbody>
                  {c.metrics.map((m, i) => (
                    <tr key={i}>
                      <td className="w-1/3 pr-3 align-top text-slate-700">{m.label}</td>
                      <td>
                        {m.value}
                        {m.experimental ? ` (${t("report.doc.experimental")})` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        ))}
      </section>

      <section className="mt-4">
        <h2 className="text-base font-bold">{t("report.doc.interactive")}</h2>
        <p className="text-slate-700">{doc.interactive.summary}</p>
        {doc.interactive.tests.map((tst) => (
          <article key={tst.id} className="mt-2 break-inside-avoid border-t border-slate-200 pt-2">
            <h3 className="font-semibold">
              {tst.title} — {tst.outcomeLabel}
            </h3>
            {tst.summary && <p>{tst.summary}</p>}
            {tst.evidence.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {tst.evidence.map((e, i) => (
                  <li key={i}>
                    <span className="mr-1 font-mono text-slate-700">{LEVEL_MARK[e.level] ?? "·"}</span>
                    {e.text} <span className="text-slate-600">({e.kindLabel}{e.experimental ? `, ${t("report.doc.experimental")}` : ""})</span>
                  </li>
                ))}
              </ul>
            )}
            {tst.limitations.length > 0 && (
              <p className="mt-1 text-[10pt] text-slate-700">
                {t("report.doc.limitations")}: {tst.limitations.join(" ")}
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="mt-4 break-inside-avoid border-t border-slate-300 pt-2 text-[10pt] text-slate-700">
        <h2 className="font-bold text-slate-900">{t("report.doc.notes")}</h2>
        <ul className="list-disc pl-5">
          {doc.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p className="mt-2">{t("report.doc.page")}</p>
      </section>
    </div>,
    document.body,
  );
}
