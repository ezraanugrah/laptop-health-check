import { useEffect, useRef, useState } from "react";
import type { LaunchMode } from "../types/interactive";
import { api } from "../lib/api";
import { runMediaSelfcheck } from "../lib/media/selfcheck";
import { useI18n } from "../lib/preferences";
import type { Params, UiKey } from "../i18n/translate";

type SelfcheckMode = Exclude<LaunchMode, "normal">;

interface ModeText {
  title: UiKey;
  steps: [UiKey, Params?][];
  needsClick: boolean;
}

const CAMERA: Params = { device: "@device.camera", Device: "@device.Camera" };
const MIC: Params = { device: "@device.microphone", Device: "@device.Microphone" };

const MODE_TEXT: Record<SelfcheckMode, ModeText> = {
  mediaPassive: { title: "selfcheck.mode.mediaPassive", steps: [["selfcheck.step.passive"]], needsClick: false },
  mediaIsolation: {
    title: "selfcheck.mode.mediaIsolation",
    steps: [["selfcheck.step.isolationGate"], ["selfcheck.step.isolationWindows"], ["selfcheck.step.isolationChecks"]],
    needsClick: false,
  },
  mediaDryRun: {
    title: "selfcheck.mode.mediaDryRun",
    steps: [["selfcheck.step.dryRunWindow"], ["selfcheck.step.dryRunPress"]],
    needsClick: true,
  },
  mediaDeny: {
    title: "selfcheck.mode.mediaDeny",
    steps: [["selfcheck.step.denyRequest"], ["selfcheck.step.denyDialog"]],
    needsClick: true,
  },
  mediaCamera: {
    title: "selfcheck.mode.mediaCamera",
    steps: [
      ["selfcheck.step.mediaWindow", CAMERA],
      ["selfcheck.step.mediaActive", CAMERA],
      ["selfcheck.step.mediaRetry", CAMERA],
    ],
    needsClick: true,
  },
  mediaMicrophone: {
    title: "selfcheck.mode.mediaMicrophone",
    steps: [
      ["selfcheck.step.mediaWindow", MIC],
      ["selfcheck.step.mediaActive", MIC],
      ["selfcheck.step.mediaRetry", MIC],
    ],
    needsClick: true,
  },
};

/**
 * Mode pemeriksaan izin media (hanya bila aplikasi dijalankan dengan
 * LHC_SELFCHECK). Hasil dicetak ke terminal lalu aplikasi keluar.
 */
export function SelfCheckPage({ mode }: { mode: SelfcheckMode }) {
  const { t } = useI18n();
  const meta = MODE_TEXT[mode];
  const [lines, setLines] = useState<[UiKey, Params?][]>([]);
  const [started, setStarted] = useState(!meta.needsClick);
  const [windowOpen, setWindowOpen] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (!started || ran.current) return;
    ran.current = true;
    runMediaSelfcheck(mode, {
      log: (key, params) => setLines((prev) => [...prev, [key, params]]),
      onWindowOpen: setWindowOpen,
    })
      .then((report) => api.reportSelfcheck(report))
      .catch((e: unknown) => api.reportSelfcheck({ mode, error: String(e), securityFailure: null }));
  }, [started, mode]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-8">
      <h1 className="text-xl font-semibold">{t("selfcheck.title", { mode: t(meta.title) })}</h1>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
        {meta.steps.map(([key, params]) => (
          <li key={key}>{t(key, params)}</li>
        ))}
      </ol>
      <p className="text-xs text-slate-600 dark:text-slate-400">{t("selfcheck.mainDenies")}</p>
      {!started && (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
        >
          {t("selfcheck.startMode", { mode: t(meta.title) })}
        </button>
      )}
      {windowOpen && (
        <button
          type="button"
          onClick={() => void api.cancelMediaWindow()}
          className="rounded-lg border border-rose-400 px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-300"
        >
          {t("selfcheck.cancelSession")}
        </button>
      )}
      <ol className="space-y-1 font-mono text-xs text-slate-700 dark:text-slate-300">
        {lines.map(([key, params], i) => (
          <li key={i}>{t(key, params)}</li>
        ))}
      </ol>
    </div>
  );
}
