import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { InteractiveResult } from "../../types/interactive";
import {
  CONFIRM_OPTIONS,
  CONFIRM_QUESTIONS,
  COVERAGE_MIN_CELLS,
  DRAG_SLOTS,
  GRID_CELLS,
  OPTIONAL_ITEMS,
  REQUIRED_ITEMS,
  STATUS_LABEL,
  TRACKPAD_ITEMS,
  TRACKPAD_LIMITATIONS,
  applyTrackpadInput,
  assessTrackpad,
  attachTrackpadListeners,
  cancelledTrackpad,
  coveredCells,
  detectWebkitSupport,
  dragSlot,
  emptyTrackpadState,
  isDetected,
  isDrop,
  itemParam,
  itemStatus,
  missingRequired,
  type Confirm,
  type ConfirmQuestion,
  type ItemStatus,
  type OptionalItem,
  type SupportScope,
  type TrackpadInput,
  type TrackpadItem,
  type TrackpadState,
} from "../../lib/interactive/trackpad";
import { useI18n } from "../../lib/preferences";

interface Props {
  onFinish: (result: InteractiveResult) => void;
  /** Keluar sebelum selesai (hasil "Dibatalkan"). */
  onCancel: (result: InteractiveResult) => void;
}

// Posisi token seret per slot (ditulis utuh agar terdeteksi Tailwind; tanpa style inline).
const SLOT_CLASS = ["col-start-1", "col-start-2", "col-start-3", "col-start-4", "col-start-5", "col-start-6"];

const STATUS_TONE: Record<ItemStatus, string> = {
  waiting: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  detected: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200",
  unsupported: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  notDetected: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
};

const ALL_ITEMS: TrackpadItem[] = [...REQUIRED_ITEMS, ...OPTIONAL_ITEMS];

type Answers = Record<ConfirmQuestion, Confirm>;
const INITIAL_ANSWERS: Answers = { systemGestures: "notChecked", clickFeel: "notChecked", pinch: "notChecked" };

export function TrackpadTest({ onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<TrackpadState>(emptyTrackpadState);
  const [support] = useState(() => detectWebkitSupport(window as unknown as SupportScope));
  const [round, setRound] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [answers, setAnswers] = useState<Answers>(INITIAL_ANSWERS);
  const [tokenSlot, setTokenSlot] = useState(0);
  const [drag, setDrag] = useState<{ pointerId: number; start: number } | null>(null);
  const startedAt = useRef(performance.now());
  const padRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const dispatch = (input: TrackpadInput) => setState((s) => applyTrackpadInput(s, input));

  // Listener hanya di area uji, hanya selama tes terbuka; dipasang ulang saat "Ulangi".
  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    return attachTrackpadListeners(pad, () => pad.getBoundingClientRect(), dispatch);
  }, [round]);

  useEffect(() => {
    if (finishing) panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [finishing]);

  const missing = missingRequired(state);
  const done = REQUIRED_ITEMS.length - missing.length;
  const covered = coveredCells(state);
  const questions: ConfirmQuestion[] = state.detected.pinch ? ["systemGestures", "clickFeel"] : ["systemGestures", "clickFeel", "pinch"];

  const reset = () => {
    setState(emptyTrackpadState());
    setAnswers(INITIAL_ANSWERS);
    setTokenSlot(0);
    setDrag(null);
    setFinishing(false);
    setRound((r) => r + 1);
    startedAt.current = performance.now();
  };

  const finish = (reportMissing: boolean) =>
    onFinish(
      assessTrackpad({
        state,
        support,
        reportMissing,
        systemGestures: answers.systemGestures,
        clickFeel: answers.clickFeel,
        pinchConfirm: answers.pinch,
        durationMs: Math.round(performance.now() - startedAt.current),
        finishedAt: new Date().toISOString(),
      }),
    );

  // --- Seret dan lepas (pointer events, hanya di token) -------------------------------------
  const stripRect = () => stripRef.current?.getBoundingClientRect() ?? null;

  const onTokenDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ pointerId: e.pointerId, start: tokenSlot });
  };
  const onTokenMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = stripRect();
    if (!drag || e.pointerId !== drag.pointerId || !rect) return;
    setTokenSlot(dragSlot(e.clientX, rect));
  };
  const onTokenUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = stripRect();
    if (!drag || e.pointerId !== drag.pointerId || !rect) return;
    const end = dragSlot(e.clientX, rect);
    if (isDrop(drag.start, end)) dispatch({ type: "drop" });
    // Dilepas di luar zona lepas: token kembali ke awal.
    setTokenSlot(end === DRAG_SLOTS - 1 ? end : 0);
    setDrag(null);
  };
  const onTokenCancel = () => {
    setDrag(null);
    setTokenSlot(0);
  };

  const itemView = (item: TrackpadItem) => {
    const status = itemStatus(state, item, support);
    const optional = (OPTIONAL_ITEMS as TrackpadItem[]).includes(item);
    return (
      <li
        key={item}
        className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="min-w-0">
          <p className="font-medium">
            {t(TRACKPAD_ITEMS[item].name)}
            {optional && <span className="font-normal text-slate-600 dark:text-slate-400"> · {t("trackpad.optional")}</span>}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{t(TRACKPAD_ITEMS[item].hint)}</p>
          {item === "move" && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {t("trackpad.coverage", { covered, total: GRID_CELLS, min: COVERAGE_MIN_CELLS })}
            </p>
          )}
          {optional && status === "waiting" && (
            <button
              type="button"
              onClick={() => dispatch({ type: "markNotDetected", item: item as OptionalItem })}
              className="mt-1 text-xs text-slate-700 underline hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              {t("trackpad.markNotDetected")}
            </button>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status]}`}>{t(STATUS_LABEL[status])}</span>
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("trackpad.title")}>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">{t("trackpad.title")}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("trackpad.intro")}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFinishing(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              {t("trackpad.finish")}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {t("trackpad.repeat")}
            </button>
            <button
              type="button"
              onClick={() => onCancel(cancelledTrackpad(state))}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500"
            >
              {t("trackpad.cancel")}
            </button>
          </div>
        </header>

        <div
          role="note"
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          {t("trackpad.mouseNote")}
        </div>

        <div className="flex items-center gap-3">
          <span className="shrink-0 text-sm font-medium" aria-live="polite">
            {t("trackpad.progress", { done, total: REQUIRED_ITEMS.length })}
          </span>
          <div className="flex flex-1 gap-1" aria-hidden>
            {REQUIRED_ITEMS.map((item) => (
              <span
                key={item}
                className={`h-2 flex-1 rounded-full ${isDetected(state, item) ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-800"}`}
              />
            ))}
          </div>
        </div>

        <div
          ref={padRef}
          role="region"
          aria-label={t("trackpad.padLabel")}
          className="relative h-56 overflow-hidden rounded-xl border-2 border-slate-300 bg-white select-none dark:border-slate-700 dark:bg-slate-900"
        >
          <div className="grid h-full grid-cols-6 grid-rows-4" aria-hidden>
            {state.visited.map((visited, i) => (
              <div
                key={i}
                className={`border border-dashed border-slate-200 dark:border-slate-800 ${
                  visited ? "bg-emerald-100 dark:bg-emerald-900/40" : ""
                }`}
              />
            ))}
          </div>
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-700 dark:text-slate-300">
            {t("trackpad.padInstructions")}
          </p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-slate-600 dark:text-slate-400">{t("trackpad.dragInstructions")}</p>
          <div
            ref={stripRef}
            role="group"
            aria-label={t("trackpad.dragLabel")}
            className="grid h-14 grid-cols-6 rounded-xl border border-dashed border-slate-300 bg-white select-none dark:border-slate-700 dark:bg-slate-900"
          >
            <div
              className={`col-start-6 row-start-1 m-1 flex items-center justify-center rounded-lg border-2 border-dashed text-center text-xs ${
                state.detected.drag
                  ? "border-emerald-500 text-emerald-800 dark:border-emerald-600 dark:text-emerald-200"
                  : "border-sky-400 text-sky-800 dark:border-sky-700 dark:text-sky-200"
              }`}
            >
              {t("trackpad.dropZone")}
            </div>
            <div
              aria-label={t("trackpad.dragToken")}
              onPointerDown={onTokenDown}
              onPointerMove={onTokenMove}
              onPointerUp={onTokenUp}
              onPointerCancel={onTokenCancel}
              className={`${SLOT_CLASS[tokenSlot] ?? SLOT_CLASS[0]} row-start-1 m-1 flex touch-none items-center justify-center rounded-lg bg-sky-600 text-center text-xs font-medium text-white ${
                drag ? "cursor-grabbing ring-2 ring-sky-300 dark:ring-sky-500" : "cursor-grab hover:bg-sky-500"
              }`}
            >
              {t("trackpad.dragToken")}
            </div>
          </div>
        </div>

        <section aria-label={t("trackpad.functions")}>
          <ul className="grid gap-2 sm:grid-cols-2">{ALL_ITEMS.map(itemView)}</ul>
        </section>

        {finishing && (
          <div
            ref={panelRef}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-slate-700 dark:text-slate-300">{t("trackpad.confirmIntro")}</p>
            {questions.map((q) => (
              <fieldset key={q} className="space-y-1">
                <legend className="mb-1 font-medium">{t(CONFIRM_QUESTIONS[q].question)}</legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">{t(CONFIRM_QUESTIONS[q].hint)}</p>
                {CONFIRM_OPTIONS.map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`trackpad-${q}`}
                      checked={answers[q] === value}
                      onChange={() => setAnswers((a) => ({ ...a, [q]: value }))}
                    />
                    {t(CONFIRM_QUESTIONS[q].options[value])}
                  </label>
                ))}
              </fieldset>
            ))}

            {missing.length === 0 ? (
              <button
                type="button"
                onClick={() => finish(false)}
                className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600"
              >
                {t("trackpad.save")}
              </button>
            ) : (
              <div className="space-y-2">
                <p>{t("trackpad.missing", { n: missing.length, items: missing.map(itemParam) })}</p>
                {missing.includes("secondaryClick") && (
                  <p className="text-xs text-slate-600 dark:text-slate-400">{t("trackpad.secondaryHint")}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => finish(true)}
                    className="rounded-lg bg-rose-700 px-4 py-2 font-medium text-white hover:bg-rose-600"
                  >
                    {t("trackpad.markMissing")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinishing(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {t("trackpad.continue")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {TRACKPAD_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
