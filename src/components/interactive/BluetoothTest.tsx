import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractiveResult } from "../../types/interactive";
import type { BluetoothReport, BluetoothState } from "../../types/peripherals";
import type { UiKey } from "../../i18n/translate";
import { api } from "../../lib/api";
import {
  BLUETOOTH_LIMITATIONS,
  assessBluetooth,
  cancelledBluetooth,
  deviceTypeParam,
  type UserVerdict,
} from "../../lib/interactive/bluetooth";
import { useI18n } from "../../lib/preferences";

interface Props {
  onFinish: (result: InteractiveResult) => void;
  onCancel: (result: InteractiveResult) => void;
}

const STATE_TEXT: Record<BluetoothState, UiKey> = {
  on: "bluetooth.state.on",
  off: "bluetooth.state.off",
  noController: "bluetooth.state.noController",
  unknown: "bluetooth.state.unknown",
};

const STATE_TONE: Record<BluetoothState, string> = {
  on: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  off: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200",
  noController: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
  unknown: "border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

const VERDICTS: { value: UserVerdict; label: UiKey }[] = [
  { value: "notAnswered", label: "bluetooth.confirm.notAnswered" },
  { value: "works", label: "bluetooth.confirm.works" },
  { value: "problem", label: "bluetooth.confirm.problem" },
];

const BUTTON_PRIMARY =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300";
const BUTTON_SECONDARY =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5 last:border-0 dark:border-slate-800">
      <dt className="text-slate-600 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium break-words">{value}</dd>
    </div>
  );
}

export function BluetoothTest({ onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const [report, setReport] = useState<BluetoothReport | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verdict, setVerdict] = useState<UserVerdict>("notAnswered");
  const startedAt = useRef(performance.now());

  const load = useCallback(() => {
    setLoading(true);
    api
      .getBluetoothStatus()
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

  const exit = useCallback(() => onCancel(cancelledBluetooth()), [onCancel]);

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
      assessBluetooth(
        report,
        verdict,
        { durationMs: Math.round(performance.now() - startedAt.current), finishedAt: new Date().toISOString() },
        readError,
      ),
    );

  const state: BluetoothState = report?.state ?? "unknown";
  const dash = "—";
  const technical = readError ?? report?.error ?? null;
  const yesNo = (v: boolean | null) => (v === null ? dash : t(v ? "bluetooth.value.yes" : "bluetooth.value.no"));

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("bluetooth.title")}>
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <header>
          <h2 className="text-xl font-semibold">{t("bluetooth.title")}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("bluetooth.intro")}</p>
        </header>

        {loading ? (
          <p className="text-sm text-slate-600 dark:text-slate-400" role="status">
            {t("bluetooth.loading")}
          </p>
        ) : (
          <>
            <section className={`rounded-xl border px-4 py-3 text-sm ${STATE_TONE[state]}`} role="status">
              <p className="font-medium">{t(STATE_TEXT[state])}</p>
              {state === "off" && <p className="mt-1 text-xs">{t("bluetooth.turnOnHint")}</p>}
              {technical && <p className="mt-1 font-mono text-xs break-all">{t("bluetooth.technical", { error: technical })}</p>}
            </section>

            {report && (state === "on" || state === "off") && (
              <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                <h3 className="mb-1 font-medium">{t("bluetooth.details")}</h3>
                <dl>
                  <Row label={t("bluetooth.field.chipset")} value={report.chipset ?? dash} />
                  <Row label={t("bluetooth.field.firmware")} value={report.firmware ?? dash} />
                  <Row label={t("bluetooth.field.transport")} value={report.transport ?? dash} />
                  <Row label={t("bluetooth.field.vendor")} value={report.vendorId ?? dash} />
                  <Row label={t("bluetooth.field.discoverable")} value={yesNo(report.discoverable)} />
                  <Row label={t("bluetooth.field.services")} value={report.services.length ? report.services.join(", ") : dash} />
                  {state === "on" && (
                    <>
                      <Row
                        label={t("bluetooth.field.connected")}
                        value={
                          report.connectedCount > 0
                            ? t("bluetooth.value.connected", {
                                n: report.connectedCount,
                                types: report.connectedTypes.map(deviceTypeParam),
                              })
                            : "0"
                        }
                      />
                      <Row label={t("bluetooth.field.paired")} value={String(report.pairedNotConnected)} />
                    </>
                  )}
                </dl>
              </section>
            )}

            {state === "on" && (
              <fieldset className="space-y-1.5 text-sm">
                <legend className="mb-1 font-medium">{t("bluetooth.confirm.legend")}</legend>
                {VERDICTS.map((v) => (
                  <label key={v.value} className="flex items-center gap-2">
                    <input type="radio" name="bluetooth-verdict" checked={verdict === v.value} onChange={() => setVerdict(v.value)} />
                    {t(v.label)}
                  </label>
                ))}
              </fieldset>
            )}
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={loading} className={BUTTON_PRIMARY}>
            {t("bluetooth.save")}
          </button>
          <button type="button" onClick={load} disabled={loading} className={BUTTON_SECONDARY}>
            {t("bluetooth.recheck")}
          </button>
          <button type="button" onClick={exit} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
            {t("bluetooth.exit")}
          </button>
        </div>

        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {BLUETOOTH_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
