import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractiveResult } from "../../types/interactive";
import { api, inDesktopApp } from "../../lib/api";
import {
  DISPLAY_ISSUES,
  DISPLAY_LIMITATIONS,
  DISPLAY_PATTERNS,
  assessDisplay,
  type DisplayIssue,
} from "../../lib/interactive/display";
import { useI18n } from "../../lib/preferences";

const CONTROLS_HIDE_MS = 2500;

interface Props {
  onFinish: (result: InteractiveResult) => void;
  /** Keluar sebelum selesai; `viewed` = jumlah pola yang sudah dilihat. */
  onCancel: (viewed: number) => void;
}

type Phase = "intro" | "patterns" | "answer";

export function DisplayTest({ onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<Phase>("intro");
  const [index, setIndex] = useState(0);
  const [viewed, setViewed] = useState(0);
  const [controls, setControls] = useState(true);
  const [issues, setIssues] = useState<DisplayIssue[]>([]);
  const [fullscreenNote, setFullscreenNote] = useState<string | null>(null);
  const startedAt = useRef(0);
  const hideTimer = useRef<number | null>(null);
  const patternRef = useRef<HTMLDivElement | null>(null);
  const desktop = inDesktopApp();

  // Layar penuh hanya selama pola ditampilkan; selalu dikembalikan saat keluar.
  useEffect(() => {
    if (phase !== "patterns") return;
    if (desktop) {
      api.setWindowFullscreen(true).catch((e: unknown) => setFullscreenNote(t("display.fullscreenFailed", { error: String(e) })));
    } else {
      setFullscreenNote(t("display.browserFullscreen"));
    }
    return () => {
      if (desktop) void api.setWindowFullscreen(false);
    };
  }, [phase, desktop]);

  const showControls = useCallback(() => {
    setControls(true);
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setControls(false), CONTROLS_HIDE_MS);
  }, []);

  useEffect(
    () => () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  const start = () => {
    startedAt.current = performance.now();
    setIndex(0);
    setViewed(1);
    setPhase("patterns");
    showControls();
  };

  const next = useCallback(() => {
    if (index >= DISPLAY_PATTERNS.length - 1) {
      setPhase("answer");
      return;
    }
    setIndex(index + 1);
    setViewed((v) => Math.max(v, index + 2));
  }, [index]);

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  // Kontrol keyboard hanya selama pola tampil.
  useEffect(() => {
    if (phase !== "patterns") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        onCancel(viewed);
      } else if (e.code === "ArrowRight" || e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        next();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    // Fase capture: Esc/panah tetap diterima walau fokus ada di elemen lain.
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [phase, next, prev, onCancel, viewed]);

  // Fokus keyboard ke area pola setiap kali pola tampil/berganti (setelah
  // tombol "Mulai" hilang dan jendela berpindah ke layar penuh).
  useEffect(() => {
    if (phase === "patterns") patternRef.current?.focus({ preventScroll: true });
  }, [phase, index]);

  const toggleIssue = (issue: DisplayIssue) =>
    setIssues((list) => (list.includes(issue) ? list.filter((x) => x !== issue) : [...list, issue]));

  const save = (selected: DisplayIssue[]) =>
    onFinish(
      assessDisplay({
        viewed,
        issues: selected,
        durationMs: Math.round(performance.now() - startedAt.current),
        finishedAt: new Date().toISOString(),
      }),
    );

  if (phase === "patterns") {
    const pattern = DISPLAY_PATTERNS[index];
    const text = pattern.dark ? "text-white" : "text-slate-900";
    return (
      <div
        ref={patternRef}
        tabIndex={-1}
        className={`fixed inset-0 z-50 select-none outline-none ${pattern.className} ${controls ? "cursor-default" : "cursor-none"}`}
        onClick={next}
        onMouseMove={showControls}
        role="dialog"
        aria-label={t("display.patternLabel", { name: t(pattern.name) })}
      >
        {controls && (
          <div
            className={`absolute top-4 left-1/2 flex w-max max-w-[95vw] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-2 text-sm whitespace-nowrap shadow-lg backdrop-blur ${
              pattern.dark ? "border-white/30 bg-black/50" : "border-black/20 bg-white/70"
            } ${text}`}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="font-medium">
              {t("display.pattern", { n: index + 1, total: DISPLAY_PATTERNS.length, name: t(pattern.name) })}
            </span>
            <span className="hidden opacity-80 lg:inline">{t(pattern.hint)}</span>
            <button type="button" onClick={prev} disabled={index === 0} className="rounded-md px-2 py-1 hover:bg-black/20 disabled:opacity-40">
              {t("display.previous")}
            </button>
            <button type="button" onClick={next} className="rounded-md px-2 py-1 hover:bg-black/20">
              {t("display.next")}
            </button>
            <button
              type="button"
              onClick={() => onCancel(viewed)}
              className="rounded-md bg-rose-600 px-3 py-1 font-medium text-white hover:bg-rose-500"
            >
              {t("display.exit")}
            </button>
          </div>
        )}
        {controls && fullscreenNote && (
          <p className={`absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md px-3 py-1 text-xs ${text}`}>
            {fullscreenNote}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("display.title")}>
      <div className="mx-auto max-w-2xl space-y-5 p-8">
        <header>
          <h2 className="text-xl font-semibold">{t("display.title")}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {phase === "intro" ? t("display.intro", { n: DISPLAY_PATTERNS.length }) : t("display.question")}
          </p>
        </header>

        {phase === "intro" && (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
              <li>{t("display.help.navigate")}</li>
              <li>{t("display.help.exit")}</li>
              <li>{t("display.help.settings")}</li>
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={start}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              >
                {t("display.start")}
              </button>
              <button
                type="button"
                onClick={() => onCancel(0)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
              >
                {t("display.back")}
              </button>
            </div>
          </>
        )}

        {phase === "answer" && (
          <>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">{t("display.markAll")}</legend>
              {(Object.keys(DISPLAY_ISSUES) as DisplayIssue[]).map((issue) => (
                <label key={issue} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={issues.includes(issue)} onChange={() => toggleIssue(issue)} />
                  {t(DISPLAY_ISSUES[issue].label)}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => save([])}
                disabled={issues.length > 0}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-40"
              >
                {t("display.noIssues")}
              </button>
              <button
                type="button"
                onClick={() => save(issues)}
                disabled={issues.length === 0}
                className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600 disabled:opacity-40"
              >
                {t("display.saveIssues")}
              </button>
              <button
                type="button"
                onClick={start}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
              >
                {t("display.viewAgain")}
              </button>
            </div>
          </>
        )}

        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {DISPLAY_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
