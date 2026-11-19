import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractiveResult } from "../../types/interactive";
import type { PortsSnapshot, ReceptacleStatus, ThunderboltReceptacle } from "../../types/peripherals";
import type { UiKey } from "../../i18n/translate";
import { api } from "../../lib/api";
import {
  MAX_PORTS,
  PORTS_LIMITATIONS,
  assessPorts,
  canSavePorts,
  cancelledPorts,
  defaultPortCount,
  diffPorts,
  externalUsbDevices,
  newDeviceDetected,
  portState,
  recordTrial,
  snapshotUsable,
  trialFromDiff,
  type PortState,
  type PortTrial,
  type PortsDiff,
} from "../../lib/interactive/ports";
import { useI18n } from "../../lib/preferences";

interface Props {
  onFinish: (result: InteractiveResult) => void;
  onCancel: (result: InteractiveResult) => void;
}

type Phase = "prepare" | "plug" | "checking" | "detected" | "notDetected";

interface ActiveStep {
  port: number;
  phase: Phase;
  baseline: PortsSnapshot | null;
  diff: PortsDiff | null;
}

const RECEPTACLE_TEXT: Record<ReceptacleStatus, UiKey> = {
  empty: "ports.status.empty",
  connected: "ports.status.connected",
  unknown: "ports.status.unknown",
};

const PORT_STATE_TEXT: Record<PortState, UiKey> = {
  notTested: "ports.state.notTested",
  ok: "ports.state.ok",
  problem: "ports.state.problem",
  unsure: "ports.state.unsure",
};

const PORT_STATE_TONE: Record<PortState, string> = {
  notTested: "border-slate-300 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200",
  ok: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  problem: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
  unsure: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
};

const BUTTON_PRIMARY =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300";
const BUTTON_SECONDARY =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800";
const CARD = "rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900";

export function PortsTest({ onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<PortsSnapshot | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [portCount, setPortCount] = useState<number | null>(null);
  const [trials, setTrials] = useState<PortTrial[]>([]);
  const [active, setActive] = useState<ActiveStep | null>(null);
  const startedAt = useRef(performance.now());
  // Langkah aktif terkini: hasil pembacaan yang datang setelah langkah dibatalkan diabaikan.
  const activeRef = useRef(active);
  activeRef.current = active;
  const stillCurrent = (port: number, phase: Phase) =>
    activeRef.current?.port === port && activeRef.current.phase === phase;

  const load = useCallback(() => {
    setLoading(true);
    api
      .getPortsSnapshot()
      .then((s) => {
        setSnapshot(s);
        setReadError(null);
        setPortCount((n) => n ?? defaultPortCount(s));
      })
      .catch((e: unknown) => {
        setSnapshot(null);
        setReadError(String(e));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  const count = portCount ?? defaultPortCount(snapshot);
  const validTrials = trials.filter((tr) => tr.port <= count);
  const usable = snapshotUsable(snapshot);

  const exit = useCallback(() => onCancel(cancelledPorts(validTrials.length)), [onCancel, validTrials.length]);

  // Esc: batalkan langkah port yang sedang berjalan, atau keluar dari tes.
  // Listener hanya selama tes terbuka; tombol yang ditekan tidak dicatat.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      e.preventDefault();
      if (active) setActive(null);
      else exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, exit]);

  const takeBaseline = (port: number) => {
    setReadError(null);
    api
      .getPortsSnapshot()
      .then((s) => {
        setSnapshot(s);
        if (stillCurrent(port, "prepare")) setActive({ port, phase: "plug", baseline: s, diff: null });
      })
      .catch((e: unknown) => {
        setReadError(String(e));
        if (stillCurrent(port, "prepare")) setActive(null);
      });
  };

  const check = (step: ActiveStep) => {
    if (!step.baseline) return;
    const baseline = step.baseline;
    setActive({ ...step, phase: "checking" });
    api
      .getPortsSnapshot()
      .then((after) => {
        setSnapshot(after);
        if (!stillCurrent(step.port, "checking")) return;
        const diff = diffPorts(baseline, after);
        if (newDeviceDetected(diff)) {
          setTrials((list) => recordTrial(list, trialFromDiff(step.port, diff, "detected")));
          setActive({ ...step, phase: "detected", diff });
        } else {
          setActive({ ...step, phase: "notDetected", diff });
        }
      })
      .catch((e: unknown) => {
        setReadError(String(e));
        if (stillCurrent(step.port, "checking")) setActive({ ...step, phase: "plug" });
      });
  };

  const report = (step: ActiveStep, verdict: "notDetectedSure" | "notDetectedUnsure") => {
    if (step.diff) setTrials((list) => recordTrial(list, trialFromDiff(step.port, step.diff as PortsDiff, verdict)));
    setActive(null);
  };

  const changeCount = (delta: number) => {
    const next = Math.min(MAX_PORTS, Math.max(1, count + delta));
    setPortCount(next);
    setTrials((list) => list.filter((tr) => tr.port <= next));
    if (active && active.port > next) setActive(null);
  };

  const save = () =>
    onFinish(
      assessPorts(
        snapshot,
        validTrials,
        count,
        { durationMs: Math.round(performance.now() - startedAt.current), finishedAt: new Date().toISOString() },
        readError,
      ),
    );

  const canSave = !loading && !active && (usable ? canSavePorts(validTrials) : true);
  const technical = readError ?? snapshot?.error ?? null;
  const speed = (r: ThunderboltReceptacle) =>
    r.speedGbps == null ? "" : ` · ${t(r.speedIsMax ? "ports.speed.max" : "ports.speed.current", { n: r.speedGbps })}`;
  const dash = "—";

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("ports.title")}>
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <header>
          <h2 className="text-xl font-semibold">{t("ports.title")}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("ports.intro")}</p>
        </header>

        {technical && (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-2 font-mono text-xs break-all text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {t("ports.technical", { error: technical })}
          </p>
        )}

        {loading && !snapshot ? (
          <p className="text-sm text-slate-600 dark:text-slate-400" role="status">
            {t("ports.loading")}
          </p>
        ) : (
          snapshot && (
            <section className={CARD}>
              <h3 className="mb-2 font-medium">{t("ports.detected.title")}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  {!snapshot.thunderboltAvailable || snapshot.thunderbolt.length === 0 ? (
                    <p className="text-slate-600 dark:text-slate-400">{t("ports.noThunderbolt")}</p>
                  ) : (
                    snapshot.thunderbolt.map((bus, b) => (
                      <div key={`tb-${bus.index ?? b}`}>
                        <p className="font-medium">{t("ports.tb.bus", { n: bus.index ?? b })}</p>
                        <ul className="mt-1 space-y-0.5 text-slate-700 dark:text-slate-300">
                          {bus.receptacles.map((r, i) => (
                            <li key={`r-${r.id ?? i}`}>
                              {t("ports.tb.receptacle", { id: r.id ?? dash })}: {t(RECEPTACLE_TEXT[r.status])}
                              {speed(r)}
                            </li>
                          ))}
                          {bus.connectedDevices > 0 && <li>{t("ports.tb.devices", { n: bus.connectedDevices })}</li>}
                        </ul>
                      </div>
                    ))
                  )}
                  <p className="text-xs text-slate-600 dark:text-slate-400">{t("ports.emptyNote")}</p>
                </div>
                <div className="space-y-2">
                  {!snapshot.usbAvailable || snapshot.usb.length === 0 ? (
                    <p className="text-slate-600 dark:text-slate-400">{t("ports.noUsb")}</p>
                  ) : (
                    <ul className="space-y-1 text-slate-700 dark:text-slate-300">
                      {snapshot.usb.map((c, i) =>
                        c.appleInternal ? (
                          <li key={`usb-${c.locationId ?? i}`}>{t("ports.usb.internal", { n: c.devices.length })}</li>
                        ) : (
                          <li key={`usb-${c.locationId ?? i}`}>
                            {c.usbVersion ? t("ports.usb.controller", { version: c.usbVersion }) : t("ports.usb.controllerUnknown")}
                            {c.builtIn ? ` (${t("ports.usb.builtIn")})` : ""}
                          </li>
                        ),
                      )}
                    </ul>
                  )}
                  <p className="font-medium">{t("ports.usb.external", { n: snapshot.externalUsbDevices })}</p>
                  <ul className="space-y-0.5 text-xs text-slate-700 dark:text-slate-300">
                    {externalUsbDevices(snapshot).map((d, i) => (
                      <li key={`ext-${d.locationId ?? i}`}>
                        {t("ports.usb.device", { speed: d.linkSpeed ?? dash, power: d.power ?? dash, vendor: d.vendorId ?? dash })}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          )
        )}

        {usable && (
          <section className={`${CARD} space-y-3`}>
            <div>
              <h3 className="font-medium">{t("ports.manual.title")}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("ports.manual.numbering")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {Array.from({ length: count }, (_, i) => i + 1).map((port) => {
                const state = portState(validTrials, port);
                const selected = active?.port === port;
                return (
                  <button
                    key={port}
                    type="button"
                    disabled={!!active && !selected}
                    onClick={() => setActive({ port, phase: "prepare", baseline: null, diff: null })}
                    aria-pressed={selected}
                    aria-label={t("ports.manual.portState", { n: port, state: t(PORT_STATE_TEXT[state]) })}
                    className={`rounded-lg border px-3 py-1.5 text-left text-xs disabled:opacity-40 ${PORT_STATE_TONE[state]} ${
                      selected ? "ring-2 ring-sky-500" : ""
                    }`}
                  >
                    <span className="block font-medium">{t("ports.manual.port", { n: port })}</span>
                    <span>{t(PORT_STATE_TEXT[state])}</span>
                  </button>
                );
              })}
              <button type="button" onClick={() => changeCount(1)} disabled={count >= MAX_PORTS} className={BUTTON_SECONDARY}>
                {t("ports.manual.addPort")}
              </button>
              <button type="button" onClick={() => changeCount(-1)} disabled={count <= 1} className={BUTTON_SECONDARY}>
                {t("ports.manual.removePort")}
              </button>
            </div>

            {active && (
              <div className="space-y-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100" role="status">
                {active.phase === "prepare" && (
                  <>
                    <p>{t("ports.step.prepare", { n: active.port })}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => takeBaseline(active.port)} className={BUTTON_PRIMARY}>
                        {t("ports.step.ready")}
                      </button>
                      <button type="button" onClick={() => setActive(null)} className={BUTTON_SECONDARY}>
                        {t("ports.step.cancel")}
                      </button>
                    </div>
                  </>
                )}
                {(active.phase === "plug" || active.phase === "checking") && (
                  <>
                    <p>{t("ports.step.plug", { n: active.port })}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => check(active)} disabled={active.phase === "checking"} className={BUTTON_PRIMARY}>
                        {active.phase === "checking" ? t("ports.step.checking") : t("ports.step.check")}
                      </button>
                      <button type="button" onClick={() => setActive(null)} className={BUTTON_SECONDARY}>
                        {t("ports.step.cancel")}
                      </button>
                    </div>
                  </>
                )}
                {active.phase === "detected" && (
                  <>
                    <p className="font-medium">{t("ports.step.detected", { n: active.port })}</p>
                    <button type="button" onClick={() => setActive(null)} className={BUTTON_PRIMARY}>
                      {t("ports.step.done")}
                    </button>
                  </>
                )}
                {active.phase === "notDetected" && (
                  <>
                    <p className="font-medium">{t("ports.step.notDetected")}</p>
                    <p className="text-xs">{t("ports.step.caveat")}</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => check(active)} className={BUTTON_PRIMARY}>
                        {t("ports.step.retry")}
                      </button>
                      <button type="button" onClick={() => report(active, "notDetectedUnsure")} className={BUTTON_SECONDARY}>
                        {t("ports.step.reportUnsure")}
                      </button>
                      <button
                        type="button"
                        onClick={() => report(active, "notDetectedSure")}
                        className="rounded-lg border border-rose-300 px-4 py-2 text-sm text-rose-800 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-200 dark:hover:bg-rose-950/40"
                      >
                        {t("ports.step.reportSure")}
                      </button>
                      <button type="button" onClick={() => setActive(null)} className={BUTTON_SECONDARY}>
                        {t("ports.step.cancel")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={!canSave} className={BUTTON_PRIMARY}>
            {t("ports.save")}
          </button>
          <button type="button" onClick={load} disabled={loading || !!active} className={BUTTON_SECONDARY}>
            {t("ports.refresh")}
          </button>
          <button type="button" onClick={exit} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
            {t("ports.exit")}
          </button>
          {usable && !canSavePorts(validTrials) && <span className="text-xs text-slate-600 dark:text-slate-400">{t("ports.saveHint")}</span>}
        </div>

        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {PORTS_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
