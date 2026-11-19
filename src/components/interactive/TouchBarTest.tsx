import { useEffect, useRef, useState } from "react";
import type { InteractiveResult } from "../../types/interactive";
import type { TouchBarPresence } from "../../types/peripherals";
import { api, inDesktopApp } from "../../lib/api";
import {
  CHECK_ANSWERS,
  FN_KEY_CODES,
  NO_TAP_HINT_MS,
  STATUS_CHECK_DELAY_MS,
  TOUCHBAR_CHECKS,
  TOUCHBAR_LIMITATIONS,
  TOUCHBAR_SEGMENTS,
  allChecksAnswered,
  assessTouchBar,
  attachFnKeyCapture,
  cancelledTouchBar,
  emptyChecks,
  emptyFnKeys,
  emptySegments,
  noTouchBarResult,
  presenceInfo,
  receivedFnKeys,
  recordKey,
  recordTap,
  segmentLabel,
  tappedCount,
  untappedSegments,
  type CheckAnswer,
  type CheckAnswers,
  type FnKeyState,
  type SegmentState,
  type TouchBarCheck,
} from "../../lib/interactive/touchbar";
import { useI18n } from "../../lib/preferences";

// Warna penanda segmen = warna tombol uji di Touch Bar (urutan sama dengan
// `native::palette` di src-tauri/src/touchbar.rs). Ditulis utuh agar terdeteksi Tailwind.
const SEGMENT_STRIPES = [
  "bg-red-500 dark:bg-red-400",
  "bg-orange-500 dark:bg-orange-400",
  "bg-green-600 dark:bg-green-400",
  "bg-teal-500 dark:bg-teal-400",
  "bg-blue-600 dark:bg-blue-400",
  "bg-purple-600 dark:bg-purple-400",
  "bg-pink-500 dark:bg-pink-400",
  "bg-amber-800 dark:bg-amber-600",
];

const STEPS = 3;

type Phase = "intro" | "segments" | "fnKeys" | "display";

interface Props {
  /**
   * Bukti hardware Touch Bar dari `api.getTouchBarPresence()`; `null` = belum tersedia
   * (diperlakukan tidak diketahui). Tidak pernah dari nama model.
   */
  presence: TouchBarPresence | null;
  onFinish: (result: InteractiveResult) => void;
  /** Keluar sebelum menyimpan (hasil "Dibatalkan"). */
  onCancel: (result: InteractiveResult) => void;
}

const primaryButton =
  "rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300";
const secondaryButton =
  "rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";
const mutedText = "text-slate-600 dark:text-slate-400";

export function TouchBarTest({ presence, onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const desktop = inDesktopApp();
  const hardware = presenceInfo(presence);
  const present = hardware.present;
  const [phase, setPhase] = useState<Phase>("intro");
  // Tombol uji native dipasang saat Bagian 1 dimulai dan baru dilepas saat tes ditutup.
  const [barWanted, setBarWanted] = useState(false);
  const [nativeStarted, setNativeStarted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [segments, setSegments] = useState<SegmentState>(() => emptySegments(TOUCHBAR_SEGMENTS));
  const [macosVisible, setMacosVisible] = useState<boolean | null>(null);
  const [noTapHint, setNoTapHint] = useState(false);
  const [barNotShown, setBarNotShown] = useState(false);
  const [confirmUntapped, setConfirmUntapped] = useState(false);
  const [reportUntappedAsBroken, setReportUntappedAsBroken] = useState(false);
  const [fnKeys, setFnKeys] = useState<FnKeyState>(emptyFnKeys);
  const [focused, setFocused] = useState(true);
  const [checks, setChecks] = useState<CheckAnswers>(emptyChecks);
  const startedAt = useRef(0);
  const sessionRef = useRef<number | null>(null);

  const stopBar = () => {
    if (!desktop || sessionRef.current === null) return;
    const id = sessionRef.current;
    sessionRef.current = null;
    void api.touchBarTestStop(id).catch(() => undefined);
  };

  // Siklus hidup tombol uji: pasang sekali, dengarkan ketukan sesi ini saja, dan selalu
  // lepas saat unmount (selesai/batal) atau halaman ditutup/dimuat ulang.
  useEffect(() => {
    if (!barWanted || !desktop) return;
    let disposed = false;
    let current: number | null = null;
    let statusTimer: number | null = null;
    const unlisten = api.onTouchBarTap((tap) => {
      if (current === null || tap.session !== current) return;
      setSegments((s) => recordTap(s, tap.index));
    });
    api
      .touchBarTestStart(TOUCHBAR_SEGMENTS)
      .then((info) => {
        if (disposed) {
          void api.touchBarTestStop(info.session).catch(() => undefined);
          return;
        }
        current = info.session;
        sessionRef.current = info.session;
        setNativeStarted(true);
        setSegments((s) => (s.total === info.segments ? s : emptySegments(info.segments)));
        statusTimer = window.setTimeout(() => {
          api
            .touchBarTestStatus()
            .then((status) => {
              if (!disposed && status.session === current) setMacosVisible(status.visible);
            })
            .catch(() => undefined);
        }, STATUS_CHECK_DELAY_MS);
      })
      .catch((e: unknown) => {
        if (!disposed) setStartError(String(e));
      });
    const onPageHide = () => {
      if (current !== null) void api.touchBarTestStop(current).catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      disposed = true;
      if (statusTimer !== null) window.clearTimeout(statusTimer);
      window.removeEventListener("pagehide", onPageHide);
      void unlisten.then((stop) => stop()).catch(() => undefined);
      if (current !== null) void api.touchBarTestStop(current).catch(() => undefined);
      if (sessionRef.current === current) sessionRef.current = null;
    };
  }, [barWanted, desktop]);

  // Petunjuk bila belum ada ketukan setelah beberapa saat.
  useEffect(() => {
    if (phase !== "segments") return;
    const timer = window.setTimeout(() => setNoTapHint(true), NO_TAP_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // Tombol F hanya ditangkap selama Bagian 2 (fase capture, hanya `code`).
  useEffect(() => {
    if (phase !== "fnKeys") return;
    const detach = attachFnKeyCapture(window, (code) => setFnKeys((s) => recordKey(s, code)));
    const onBlur = () => setFocused(false);
    const onFocus = () => setFocused(true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      detach();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, [phase]);

  const tapped = tappedCount(segments);
  const untapped = untappedSegments(segments);
  const received = receivedFnKeys(fnKeys);

  const begin = () => {
    startedAt.current = performance.now();
    setBarWanted(true);
    setPhase("segments");
  };

  const toFnKeys = (opts: { notShown?: boolean; broken?: boolean }) => {
    setBarNotShown(Boolean(opts.notShown));
    setReportUntappedAsBroken(Boolean(opts.broken));
    setConfirmUntapped(false);
    setPhase("fnKeys");
  };

  const cancel = () => {
    stopBar();
    onCancel(cancelledTouchBar({ tapped, total: segments.total, fnReceived: received.length }));
  };

  const save = () => {
    stopBar();
    onFinish(
      assessTouchBar({
        presence: hardware,
        nativeStarted,
        segments,
        barNotShown,
        reportUntappedAsBroken,
        macosVisible,
        fnKeys,
        checks,
        durationMs: Math.round(performance.now() - startedAt.current),
        finishedAt: new Date().toISOString(),
      }),
    );
  };

  const stepNumber = phase === "segments" ? 1 : phase === "fnKeys" ? 2 : phase === "display" ? 3 : 0;

  const limitations = (
    <details className={`text-xs ${mutedText}`}>
      <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {TOUCHBAR_LIMITATIONS.map((l) => (
          <li key={l}>{t(l)}</li>
        ))}
      </ul>
    </details>
  );

  // Bukti hardware: tidak ada Touch Bar → tidak memasang apa pun.
  if (present === false) {
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("touchBar.title")}>
        <div className="mx-auto max-w-2xl space-y-4 p-6">
          <h2 className="text-xl font-semibold">{t("touchBar.title")}</h2>
          <p className="font-medium">{t("touchBar.presence.absent")}</p>
          <p className={`text-sm ${mutedText}`}>{t("touchBar.presence.absentDetail")}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => onFinish(noTouchBarResult(new Date().toISOString()))} className={primaryButton}>
              {t("touchBar.save")}
            </button>
            <button type="button" onClick={cancel} className={secondaryButton}>
              {t("touchBar.exit")}
            </button>
          </div>
          {limitations}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("touchBar.title")}>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{t("touchBar.title")}</h2>
            <p className={`mt-1 text-sm ${mutedText}`}>
              {stepNumber > 0 ? t("touchBar.step", { n: stepNumber, total: STEPS }) : t("touchBar.intro")}
            </p>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="shrink-0 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
          >
            {t("touchBar.exit")}
          </button>
        </header>

        {phase === "intro" && (
          <section className="space-y-3">
            <p
              role="note"
              className={
                present === true
                  ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
              }
            >
              {present === true ? t("touchBar.presence.present") : t("touchBar.presence.unknown")}
              {hardware.experimental && ` (${t("evidence.experimental")})`}
            </p>
            <button type="button" onClick={begin} className={primaryButton}>
              {t("touchBar.start")}
            </button>
          </section>
        )}

        {phase === "segments" && (
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">{t("touchBar.segments.title")}</h3>
              <p className={`text-sm ${mutedText}`}>{t("touchBar.segments.instruction", { total: segments.total })}</p>
            </div>

            {!desktop ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
                {t("touchBar.segments.browser")}
              </p>
            ) : startError ? (
              <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {t("touchBar.segments.startFailed", { error: startError })}
              </p>
            ) : !nativeStarted ? (
              <p className={`text-sm ${mutedText}`}>{t("touchBar.segments.starting")}</p>
            ) : null}

            <div className="flex gap-2">
              {segments.taps.map((count, i) => (
                <div
                  key={i}
                  title={t("touchBar.segments.tapCount", { n: segmentLabel(i), count })}
                  className={`flex h-14 flex-1 flex-col overflow-hidden rounded-lg border text-sm font-semibold ${
                    count > 0
                      ? "border-emerald-600 bg-emerald-100 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-100"
                      : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  }`}
                >
                  <span className={`h-1.5 w-full ${SEGMENT_STRIPES[i % SEGMENT_STRIPES.length]}`} />
                  <span className="flex flex-1 items-center justify-center">{segmentLabel(i)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">{t("touchBar.segments.progress", { tapped, total: segments.total })}</span>
              {macosVisible !== null && (
                <span className={`text-xs ${mutedText}`}>
                  {macosVisible ? t("touchBar.segments.macosVisible") : t("touchBar.segments.macosHidden")}
                </span>
              )}
            </div>

            {tapped === 0 && (noTapHint || startError !== null || !desktop) && (
              <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
                {t("touchBar.segments.noTapHint")}
              </p>
            )}

            {confirmUntapped ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
                <p>{t("touchBar.segments.remaining", { segments: untapped.map(segmentLabel) })}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => toFnKeys({ broken: true })}
                    className="rounded-lg bg-rose-700 px-4 py-2 font-medium text-white hover:bg-rose-600"
                  >
                    {t("touchBar.segments.markBroken")}
                  </button>
                  <button type="button" onClick={() => toFnKeys({})} className={secondaryButton}>
                    {t("touchBar.segments.skip")}
                  </button>
                  <button type="button" onClick={() => setConfirmUntapped(false)} className={secondaryButton}>
                    {t("touchBar.segments.continue")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => (untapped.length === 0 ? toFnKeys({}) : setConfirmUntapped(true))}
                  className={primaryButton}
                >
                  {t("touchBar.next")}
                </button>
                {tapped === 0 && (noTapHint || startError !== null || !desktop) && (
                  <button type="button" onClick={() => toFnKeys({ notShown: true })} className={secondaryButton}>
                    {t("touchBar.segments.notShown")}
                  </button>
                )}
              </div>
            )}
            <p className={`text-xs ${mutedText}`}>{t("touchBar.legend")}</p>
          </section>
        )}

        {phase === "fnKeys" && (
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">{t("touchBar.fn.title")}</h3>
              <p className={`text-sm ${mutedText}`}>{t("touchBar.fn.instruction")}</p>
            </div>
            {!focused && (
              <div role="alert" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
                {t("touchBar.fn.unfocused")}
              </div>
            )}
            <div className="grid grid-cols-12 gap-1">
              {FN_KEY_CODES.map((code) => {
                const ok = (fnKeys.counts[code] ?? 0) > 0;
                return (
                  <div
                    key={code}
                    className={`flex h-10 items-center justify-center rounded-md border text-xs font-medium ${
                      ok
                        ? "border-emerald-600 bg-emerald-100 text-emerald-900 dark:border-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-100"
                        : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                    }`}
                  >
                    {code}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium">{t("touchBar.fn.progress", { received: received.length, total: FN_KEY_CODES.length })}</span>
              {fnKeys.escape > 0 && <span className={`text-xs ${mutedText}`}>{t("touchBar.fn.escReceived")}</span>}
            </div>
            <p role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              {t("touchBar.fn.hint")}
            </p>
            <button type="button" onClick={() => setPhase("display")} className={primaryButton}>
              {t("touchBar.next")}
            </button>
            <p className={`text-xs ${mutedText}`}>{t("touchBar.legend")}</p>
          </section>
        )}

        {phase === "display" && (
          <section className="space-y-3">
            <div>
              <h3 className="font-semibold">{t("touchBar.display.title")}</h3>
              <p className={`text-sm ${mutedText}`}>{t("touchBar.display.instruction")}</p>
              <p className={`text-xs ${mutedText}`}>{t("touchBar.display.userConfirmed")}</p>
            </div>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
              {TOUCHBAR_CHECKS.map((check) => (
                <fieldset key={check.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <legend className="mb-1 w-full font-medium">{t(check.question)}</legend>
                  {CHECK_ANSWERS.map((answer) => (
                    <label key={answer.value} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={`touchbar-${check.id}`}
                        checked={checks[check.id] === answer.value}
                        onChange={() => setChecks((c) => setCheck(c, check.id, answer.value))}
                      />
                      {t(answer.label)}
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={save}
                disabled={!allChecksAnswered(checks)}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
              >
                {t("touchBar.save")}
              </button>
              {!allChecksAnswered(checks) && <span className={`text-xs ${mutedText}`}>{t("touchBar.display.answerAll")}</span>}
            </div>
          </section>
        )}

        {limitations}
      </div>
    </div>
  );
}

function setCheck(checks: CheckAnswers, id: TouchBarCheck, value: CheckAnswer): CheckAnswers {
  return { ...checks, [id]: value };
}
