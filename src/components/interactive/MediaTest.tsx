import { useState } from "react";
import type { InteractiveResult } from "../../types/interactive";
import type { UiKey } from "../../i18n/translate";
import { api } from "../../lib/api";
import { useI18n } from "../../lib/preferences";
import { runUserMediaSession } from "../../lib/media/interactive-session";
import {
  CAMERA_HOLD_MS,
  MEDIA_WAIT_MS,
  MICROPHONE_HOLD_MS,
  cameraResult,
  cancelledMediaTest,
  microphoneResult,
  notAcquiredResult,
  parseSessionReport,
  type CameraImageAnswer,
  type CameraLedAnswer,
  type MediaSessionReport,
  type MicPlaybackAnswer,
} from "../../lib/interactive/media-tests";

type Kind = "camera" | "microphone";
type Phase = "intro" | "running" | "questions";

interface Props {
  kind: Kind;
  onFinish: (r: InteractiveResult) => void;
  onCancel: (r: InteractiveResult) => void;
}

const IMAGE_ANSWERS: CameraImageAnswer[] = ["clear", "blurry", "artifacts", "none"];
const LED_ANSWERS: CameraLedAnswer[] = ["on", "off", "notNoticed"];
const PLAYBACK_ANSWERS: MicPlaybackAnswer[] = ["clear", "faint", "noisy", "none", "couldNotPlay"];

const BUTTON =
  "rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40";
const PRIMARY = `${BUTTON} bg-slate-900 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white`;
const SECONDARY = `${BUTTON} border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700`;

function Choice<V extends string>({
  name,
  options,
  value,
  label,
  onChange,
}: {
  name: string;
  options: V[];
  value: V | null;
  label: (v: V) => string;
  onChange: (v: V) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-1.5">
      {options.map((o) => (
        <label
          key={o}
          className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            value === o
              ? "border-slate-900 bg-slate-100 dark:border-slate-100 dark:bg-slate-800"
              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          }`}
        >
          <input type="radio" name={name} className="mt-0.5" checked={value === o} onChange={() => onChange(o)} />
          <span>{label(o)}</span>
        </label>
      ))}
    </div>
  );
}

/**
 * Tes Kamera / Mikrofon di jendela utama. Media TIDAK pernah dibuka di sini: setelah
 * persetujuan eksplisit, jendela tes media terpisah (incognito, per sesi) yang membukanya.
 */
export function MediaTest({ kind, onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const k = (suffix: string) => `${kind}.ui.${suffix}` as UiKey;
  const [phase, setPhase] = useState<Phase>("intro");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MediaSessionReport | null>(null);
  const [image, setImage] = useState<CameraImageAnswer | null>(null);
  const [led, setLed] = useState<CameraLedAnswer | null>(null);
  const [playback, setPlayback] = useState<MicPlaybackAnswer | null>(null);

  const start = async () => {
    setError(null);
    setPhase("running");
    const holdMs = kind === "camera" ? CAMERA_HOLD_MS : MICROPHONE_HOLD_MS;
    const outcome = await runUserMediaSession(kind, holdMs, MEDIA_WAIT_MS);
    if (outcome.kind === "error") {
      setError(t(k("failedToOpen"), { error: outcome.error }));
      setPhase("intro");
      return;
    }
    if (outcome.kind === "timeout") {
      onCancel(cancelledMediaTest(kind));
      return;
    }
    const { payload } = outcome;
    if (!payload.report) {
      // Jendela ditutup pengguna sebelum melapor.
      onCancel(cancelledMediaTest(kind));
      return;
    }
    const parsed = parseSessionReport(payload.report);
    if (!parsed.acquired) {
      onFinish(notAcquiredResult(kind, parsed));
      return;
    }
    setReport(parsed);
    setPhase("questions");
  };

  const save = () => {
    if (!report) return;
    if (kind === "camera" && image && led) onFinish(cameraResult(report, image, led));
    if (kind === "microphone" && playback) onFinish(microphoneResult(report, playback));
  };
  const answered = kind === "camera" ? image !== null && led !== null : playback !== null;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t(k("title"))}>
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        <h2 className="text-xl font-semibold">{t(k("title"))}</h2>

        {phase === "intro" && (
          <>
            <p className="text-sm text-slate-700 dark:text-slate-300">{t(k("intro"))}</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              {(kind === "camera" ? ["step1", "step2", "step3"] : ["step1", "step2", "step3"]).map((s) => (
                <li key={s}>{t(k(s))}</li>
              ))}
            </ol>
            <label className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>{t(k("consent"))}</span>
            </label>
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="button" className={PRIMARY} disabled={!consent} onClick={() => void start()}>
                {t(k("start"))}
              </button>
              <button type="button" className={SECONDARY} onClick={() => onCancel(cancelledMediaTest(kind))}>
                {t(k("cancel"))}
              </button>
            </div>
          </>
        )}

        {phase === "running" && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-sm" aria-live="polite">
              {t(k("waiting"))}
            </p>
            <button type="button" className={SECONDARY} onClick={() => void api.cancelMediaWindow()}>
              {t(k("abort"))}
            </button>
          </div>
        )}

        {phase === "questions" && (
          <div className="space-y-4">
            <p className="text-sm text-emerald-800 dark:text-emerald-300">{t(kind === "camera" ? "camera.ui.cameraOff" : "microphone.ui.micOff")}</p>
            {kind === "camera" ? (
              <>
                <section className="space-y-2">
                  <h3 className="font-medium">{t("camera.ui.questionImage")}</h3>
                  <Choice
                    name={t("camera.ui.questionImage")}
                    options={IMAGE_ANSWERS}
                    value={image}
                    label={(v) => t(`camera.answer.image.${v}` as UiKey)}
                    onChange={setImage}
                  />
                </section>
                <section className="space-y-2">
                  <h3 className="font-medium">{t("camera.ui.questionLed")}</h3>
                  <Choice
                    name={t("camera.ui.questionLed")}
                    options={LED_ANSWERS}
                    value={led}
                    label={(v) => t(`camera.answer.led.${v}` as UiKey)}
                    onChange={setLed}
                  />
                </section>
              </>
            ) : (
              <section className="space-y-2">
                <h3 className="font-medium">{t("microphone.ui.questionPlayback")}</h3>
                <Choice
                  name={t("microphone.ui.questionPlayback")}
                  options={PLAYBACK_ANSWERS}
                  value={playback}
                  label={(v) => t(`microphone.answer.${v}` as UiKey)}
                  onChange={setPlayback}
                />
              </section>
            )}
            <div className="flex gap-2">
              <button type="button" className={PRIMARY} disabled={!answered} onClick={save}>
                {t(k("finish"))}
              </button>
              <button type="button" className={SECONDARY} onClick={() => onCancel(cancelledMediaTest(kind))}>
                {t(k("cancel"))}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
