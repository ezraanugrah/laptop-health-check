import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractiveResult } from "../../types/interactive";
import type { RouteState, WifiReport, WifiState } from "../../types/peripherals";
import type { UiKey } from "../../i18n/translate";
import { api } from "../../lib/api";
import {
  SIGNAL_QUALITY_LABEL,
  WIFI_LIMITATIONS,
  adapterOn,
  assessWifi,
  bandLabel,
  cancelledWifi,
  phyLabel,
  signalQuality,
  type UserVerdict,
} from "../../lib/interactive/wifi";
import { useI18n } from "../../lib/preferences";

interface Props {
  onFinish: (result: InteractiveResult) => void;
  onCancel: (result: InteractiveResult) => void;
}

const STATE_TEXT: Record<WifiState, UiKey> = {
  connected: "wifi.state.connected",
  notConnected: "wifi.state.notConnected",
  poweredOff: "wifi.state.poweredOff",
  noInterface: "wifi.state.noInterface",
  unknown: "wifi.state.unknown",
};

const STATE_TONE: Record<WifiState, string> = {
  connected: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  notConnected: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  poweredOff: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  noInterface: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
  unknown: "border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

const ROUTE_TEXT: Record<RouteState, UiKey> = {
  reported: "wifi.route.reported",
  notReported: "wifi.route.notReported",
  unknown: "wifi.route.unknown",
};

const VERDICTS: { value: UserVerdict; label: UiKey }[] = [
  { value: "notAnswered", label: "wifi.confirm.notAnswered" },
  { value: "works", label: "wifi.confirm.works" },
  { value: "problem", label: "wifi.confirm.problem" },
];

const BUTTON_PRIMARY =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300";
const BUTTON_SECONDARY =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function WifiTest({ onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const [report, setReport] = useState<WifiReport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verdict, setVerdict] = useState<UserVerdict>("notAnswered");
  const startedAt = useRef(performance.now());

  const load = useCallback(() => {
    setLoading(true);
    api
      .getWifiStatus()
      .then((r) => {
        setReport(r);
        setReadError(null);
      })
      .catch((e: unknown) => {
        setReport(null);
        setReadError(String(e));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const exit = useCallback(() => onCancel(cancelledWifi()), [onCancel]);

  // Esc = keluar. Listener hanya selama tes terbuka; tombol yang ditekan tidak dicatat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exit]);

  const save = () =>
    onFinish(
      assessWifi(
        report,
        verdict,
        { durationMs: Math.round(performance.now() - startedAt.current), finishedAt: new Date().toISOString() },
        readError,
      ),
    );

  const state: WifiState = report?.state ?? "unknown";
  const dash = "—";
  const technical = readError ?? report?.error ?? null;
  const on = adapterOn(report);

  const channel =
    report?.channelNumber != null
      ? report.channelWidthMhz != null
        ? t("wifi.value.channelWidth", {
            channel: report.channelNumber,
            band: bandLabel(report.channelBand ?? "unknown"),
            width: report.channelWidthMhz,
          })
        : t("wifi.value.channel", { channel: report.channelNumber, band: bandLabel(report.channelBand ?? "unknown") })
      : dash;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("wifi.title")}>
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <header>
          <h2 className="text-xl font-semibold">{t("wifi.title")}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("wifi.intro")}</p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400" role="status">
            {t("wifi.loading")}
          </p>
        ) : (
          <>
            <section className={`rounded-xl border px-4 py-3 text-sm ${STATE_TONE[state]}`} role="status">
              <p className="font-medium">{t(STATE_TEXT[state])}</p>
              {state === "poweredOff" && <p className="mt-1 text-xs">{t("wifi.turnOnHint")}</p>}
              {technical && <p className="mt-1 font-mono text-xs break-all">{t("wifi.technical", { error: technical })}</p>}
            </section>

            {report && state !== "unknown" && state !== "noInterface" && (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-1 font-medium">{t("wifi.details")}</h3>
                <dl>
                  <Row label={t("wifi.field.interface")} value={report.interfaceName ?? dash} />
                  {state === "connected" && (
                    <>
                      <Row label={t("wifi.field.signal")} value={report.rssiDbm != null ? t("wifi.value.dbm", { n: report.rssiDbm }) : dash} />
                      <Row label={t("wifi.field.noise")} value={report.noiseDbm != null ? t("wifi.value.dbm", { n: report.noiseDbm }) : dash} />
                      <Row label={t("wifi.field.snr")} value={report.snrDb != null ? t("wifi.value.db", { n: report.snrDb }) : dash} />
                      <Row
                        label={t("wifi.field.quality")}
                        value={report.rssiDbm != null ? t(SIGNAL_QUALITY_LABEL[signalQuality(report.rssiDbm)]) : dash}
                      />
                      <Row
                        label={t("wifi.field.rate")}
                        value={report.transmitRateMbps != null ? t("wifi.value.mbps", { n: Math.round(report.transmitRateMbps) }) : dash}
                      />
                      <Row label={t("wifi.field.phy")} value={report.phyMode ? phyLabel(report.phyMode) : dash} />
                      <Row label={t("wifi.field.channel")} value={channel} />
                    </>
                  )}
                  <Row label={t("wifi.field.route")} value={t(ROUTE_TEXT[report.route.state])} />
                </dl>
              </section>
            )}

            <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
              <div>
                <p className="font-medium">{t("wifi.internet.title")}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{t("wifi.internet.pending")}</p>
              </div>
              <button type="button" disabled className={BUTTON_SECONDARY}>
                {t("wifi.internet.title")}
              </button>
            </section>

            {on && (
              <fieldset className="space-y-1.5 text-sm">
                <legend className="mb-1 font-medium">{t("wifi.confirm.legend")}</legend>
                {VERDICTS.map((v) => (
                  <label key={v.value} className="flex items-center gap-2">
                    <input type="radio" name="wifi-verdict" checked={verdict === v.value} onChange={() => setVerdict(v.value)} />
                    {t(v.label)}
                  </label>
                ))}
              </fieldset>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={loading} className={BUTTON_PRIMARY}>
            {t("wifi.save")}
          </button>
          <button type="button" onClick={load} disabled={loading} className={BUTTON_SECONDARY}>
            {t("wifi.recheck")}
          </button>
          <button type="button" onClick={exit} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
            {t("wifi.exit")}
          </button>
        </div>

        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {WIFI_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
