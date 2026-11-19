import { useEffect, useRef, useState } from "react";
import type { InteractiveResult } from "../../types/interactive";
import {
  ANSWER_LABEL,
  CHANNEL_ANSWERS,
  CHANNEL_META,
  SPEAKER_CHANNELS,
  SPEAKER_HINTS,
  SPEAKER_LIMITATIONS,
  answeredCount,
  assessSpeakers,
  canFinishSpeakers,
  cancelledSpeakers,
  createTonePlayer,
  unavailableSpeakers,
  type AudioContextLike,
  type AudioInfo,
  type SpeakerAnswers,
  type SpeakerChannel,
  type SpeakerOutput,
  type TonePlayer,
} from "../../lib/interactive/speaker";
import { useI18n } from "../../lib/preferences";

interface Props {
  onFinish: (result: InteractiveResult) => void;
  /** Keluar sebelum selesai (hasil "Dibatalkan"). */
  onCancel: (result: InteractiveResult) => void;
  /** Opsional: keluaran default dari backend (null = tidak diketahui). */
  output?: SpeakerOutput;
}

class NoWebAudioError extends Error {}

/** Hanya dipanggil dari pemutar, yang hanya dipanggil dari klik pengguna. */
function newAudioContext(): AudioContextLike {
  const scope = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  if (!Ctor) throw new NoWebAudioError();
  return new Ctor();
}

const NOT_PLAYED: Record<SpeakerChannel, boolean> = { left: false, right: false, stereo: false };

export function SpeakerTest({ onFinish, onCancel, output }: Props) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState<SpeakerChannel | null>(null);
  const [played, setPlayed] = useState<Record<SpeakerChannel, boolean>>(NOT_PLAYED);
  const [answers, setAnswers] = useState<SpeakerAnswers>({});
  const [audio, setAudio] = useState<AudioInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(performance.now());
  const playerRef = useRef<TonePlayer | null>(null);

  const player = (): TonePlayer => {
    if (!playerRef.current) {
      playerRef.current = createTonePlayer({
        createContext: newAudioContext,
        onEnded: (channel) => setPlaying((current) => (current === channel ? null : current)),
      });
    }
    return playerRef.current;
  };

  // AudioContext selalu ditutup saat tes ditutup (selesai, batal, atau unmount).
  useEffect(
    () => () => {
      void playerRef.current?.close();
    },
    [],
  );

  const play = async (channel: SpeakerChannel) => {
    setError(null);
    try {
      const info = await player().play(channel);
      setAudio(info);
      setPlaying(channel);
      setPlayed((p) => ({ ...p, [channel]: true }));
    } catch (e) {
      setPlaying(null);
      setError(e instanceof NoWebAudioError ? t("speaker.noWebAudio") : e instanceof Error ? e.message : String(e));
    }
  };

  const stop = () => {
    playerRef.current?.stop();
    setPlaying(null);
  };

  const elapsed = () => Math.round(performance.now() - startedAt.current);

  const finish = () => {
    void playerRef.current?.close();
    onFinish(assessSpeakers({ answers, audio, output, durationMs: elapsed(), finishedAt: new Date().toISOString() }));
  };

  const cancel = () => {
    void playerRef.current?.close();
    onCancel(cancelledSpeakers(answers));
  };

  const saveUnavailable = () => {
    void playerRef.current?.close();
    onFinish(unavailableSpeakers(elapsed(), new Date().toISOString()));
  };

  const answered = answeredCount(answers);
  const complete = canFinishSpeakers(answers);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("speaker.title")}>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{t("speaker.title")}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("speaker.intro")}</p>
          </div>
          <button type="button" onClick={cancel} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
            {t("speaker.cancel")}
          </button>
        </header>

        <section
          role="note"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <p className="font-medium">{t("speaker.hintsTitle")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {SPEAKER_HINTS.map((h) => (
              <li key={h}>{t(h)}</li>
            ))}
          </ul>
        </section>

        {output?.defaultIsBuiltIn === false && (
          <div
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {t("speaker.notBuiltInWarning")}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="space-y-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <p>{t("speaker.audioFailed", { error })}</p>
            <button
              type="button"
              onClick={saveUnavailable}
              className="rounded-lg border border-rose-300 px-3 py-1 text-sm hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40"
            >
              {t("speaker.saveUnavailable")}
            </button>
          </div>
        )}

        {audio && (
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {t("speaker.audioInfo", { sampleRate: audio.sampleRate, channels: audio.maxChannelCount })}
          </p>
        )}
        {audio && audio.maxChannelCount < 2 && (
          <div
            role="note"
            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {t("speaker.monoWarning", { channels: audio.maxChannelCount })}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          {SPEAKER_CHANNELS.map((channel) => {
            const isPlaying = playing === channel;
            const titleId = `speaker-${channel}-title`;
            return (
              <section
                key={channel}
                aria-labelledby={titleId}
                className={`space-y-3 rounded-xl border bg-white p-4 dark:bg-slate-900 ${
                  isPlaying ? "border-emerald-500 dark:border-emerald-600" : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <header>
                  <h3 id={titleId} className="font-semibold">
                    {t(CHANNEL_META[channel].name)}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{t(CHANNEL_META[channel].hint)}</p>
                </header>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void play(channel)}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                  >
                    {played[channel] ? t("speaker.repeat") : t("speaker.play")}
                  </button>
                  <button
                    type="button"
                    onClick={stop}
                    disabled={!isPlaying}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {t("speaker.stop")}
                  </button>
                </div>
                <p className="min-h-4 text-xs text-emerald-800 dark:text-emerald-300" aria-live="polite">
                  {isPlaying && (
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden />
                      {t("speaker.playing")}
                    </span>
                  )}
                </p>
                <fieldset disabled={!played[channel]} className="space-y-1 text-sm disabled:opacity-50">
                  <legend className="mb-1 text-xs font-medium">{t("speaker.question")}</legend>
                  {CHANNEL_ANSWERS[channel].map((value) => (
                    <label key={value} className="flex items-start gap-2">
                      <input
                        type="radio"
                        className="mt-1"
                        name={`speaker-${channel}`}
                        checked={answers[channel] === value}
                        onChange={() => setAnswers((a) => ({ ...a, [channel]: value }))}
                      />
                      {t(ANSWER_LABEL[value])}
                    </label>
                  ))}
                </fieldset>
                {!played[channel] && <p className="text-xs text-slate-600 dark:text-slate-400">{t("speaker.playFirst")}</p>}
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="font-medium">{t("speaker.progress", { answered, total: SPEAKER_CHANNELS.length })}</p>
            {!complete && <p className="text-xs text-slate-600 dark:text-slate-400">{t("speaker.answerAll")}</p>}
          </div>
          <button
            type="button"
            onClick={finish}
            disabled={!complete}
            className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("speaker.finish")}
          </button>
        </div>

        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {SPEAKER_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
