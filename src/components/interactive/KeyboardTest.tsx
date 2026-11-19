import { useEffect, useMemo, useRef, useState } from "react";
import type { DeviceProfile, InteractiveResult } from "../../types/interactive";
import {
  BACKLIGHT_CHECKS,
  EXIT_HOLD_MS,
  KEYBOARD_LIMITATIONS,
  allKeys,
  assessKeyboard,
  attachKeyTracker,
  buildLayout,
  emptyTrackerState,
  remainingCodes,
  testableCodes,
  type Backlight,
  type FunctionRow,
  type KeyDef,
  type KeyTrackerState,
  type KeyboardLayoutId,
  keyParam,
} from "../../lib/interactive/keyboard";
import { useI18n } from "../../lib/preferences";

// Lebar tombol: satuan 2,5rem + jarak 0,25rem (ditulis utuh agar terdeteksi Tailwind).
const WIDTH: Record<string, string> = {
  "1": "w-10",
  "1.25": "w-[3.1875rem]",
  "1.5": "w-[3.875rem]",
  "1.75": "w-[4.5625rem]",
  "2.25": "w-[5.9375rem]",
  "5": "w-[13.5rem]",
};

interface Props {
  profile: DeviceProfile | null;
  onFinish: (result: InteractiveResult) => void;
  /** Keluar sebelum selesai. */
  onCancel: () => void;
}

export function KeyboardTest({ profile, onFinish, onCancel }: Props) {
  const { t } = useI18n();
  const [layoutId, setLayoutId] = useState<KeyboardLayoutId>("ansi");
  const [functionRow, setFunctionRow] = useState<FunctionRow>(profile?.touchBar ? "touchBar" : "physical");
  const [state, setState] = useState<KeyTrackerState>(emptyTrackerState);
  const [focused, setFocused] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [backlight, setBacklight] = useState<Backlight>("notChecked");
  const startedAt = useRef(performance.now());
  const escTimer = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;

  const layout = useMemo(() => buildLayout(layoutId, functionRow), [layoutId, functionRow]);
  const testable = testableCodes(layout);
  const remaining = remainingCodes(layout, state);

  // Listener hanya di jendela aplikasi, hanya selama tes ini terbuka (bukan global),
  // dan dilepas saat dialog "Selesai" terbuka agar Esc/Tab di dialog berfungsi normal.
  useEffect(() => {
    if (finishing) return;
    const detach = attachKeyTracker(
      window,
      (next, ev) => {
        setState(next);
        if (ev.code === "Escape" && ev.type === "keydown" && !ev.repeat) {
          escTimer.current = window.setTimeout(() => cancelRef.current(), EXIT_HOLD_MS);
        } else if (ev.code === "Escape" && ev.type === "keyup" && escTimer.current !== null) {
          window.clearTimeout(escTimer.current);
          escTimer.current = null;
        }
      },
      stateRef.current,
    );
    const onBlur = () => setFocused(false);
    const onFocus = () => setFocused(true);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      detach();
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      if (escTimer.current !== null) window.clearTimeout(escTimer.current);
    };
  }, [finishing]);

  const finish = (reportUntestedAsBroken: boolean) =>
    onFinish(
      assessKeyboard({
        layout,
        state,
        reportUntestedAsBroken,
        backlight,
        durationMs: Math.round(performance.now() - startedAt.current),
        finishedAt: new Date().toISOString(),
      }),
    );

  const keyView = (key: KeyDef, half = false) => {
    const s = state.keys[key.code];
    const tested = (s?.downs ?? 0) > 0;
    const tone = key.untestable
      ? "border-dashed border-slate-400 bg-slate-100 text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
      : s?.down
        ? "border-emerald-700 bg-emerald-600 text-white"
        : tested
          ? "border-emerald-500 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-100"
          : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";
    const chatter = (s?.chatter ?? 0) > 0 ? "ring-2 ring-amber-400" : "";
    return (
      <div
        key={key.code}
        title={key.untestable ? t(key.untestable) : `${key.code}${s ? ` · ${t("keyboard.pressedTimes", { n: s.downs })}` : ""}`}
        className={`flex shrink-0 items-center justify-center rounded-md border text-[11px] leading-none ${
          half ? "h-[1.125rem]" : "h-10"
        } ${WIDTH[String(key.width ?? 1)] ?? "w-10"} ${tone} ${chatter}`}
      >
        {key.labelKey ? t(key.labelKey) : key.label}
      </div>
    );
  };

  const [left, up, down, right] = layout.arrows;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-50 dark:bg-slate-950" role="dialog" aria-label={t("keyboard.title")}>
      <div className="mx-auto max-w-4xl space-y-4 p-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">{t("keyboard.title")}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{t("keyboard.intro")}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFinishing(true)}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              {t("keyboard.finish")}
            </button>
            <button type="button" onClick={onCancel} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500">
              {t("keyboard.exit")}
            </button>
          </div>
        </header>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <span className="font-medium">
            {t("keyboard.progress", { tested: testable.length - remaining.length, total: testable.length })}
          </span>
          <label className="flex items-center gap-2">
            {t("keyboard.layout")}
            <select
              value={layoutId}
              onChange={(e) => setLayoutId(e.target.value as KeyboardLayoutId)}
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="ansi">{t("keyboard.layoutAnsi")}</option>
              <option value="iso">{t("keyboard.layoutIso")}</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            {t("keyboard.functionRow")}
            <select
              value={functionRow}
              onChange={(e) => setFunctionRow(e.target.value as FunctionRow)}
              className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="physical">{t("keyboard.rowPhysical")}</option>
              <option value="touchBar">{t("keyboard.rowTouchBar")}</option>
            </select>
          </label>
          {profile?.touchBar === null && (
            <span className="text-xs text-slate-600 dark:text-slate-400">{t("keyboard.unknownModel")}</span>
          )}
        </div>

        <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          {t("keyboard.warning", { seconds: EXIT_HOLD_MS / 1000 })}
          {functionRow === "physical" && ` ${t("keyboard.warningFn")}`}
        </div>

        {!focused && (
          <div role="alert" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
            {t("keyboard.unfocused")}
          </div>
        )}

        <div className="inline-block space-y-1 rounded-xl border border-slate-200 bg-slate-100 p-3 dark:border-slate-800 dark:bg-slate-900">
          {layout.rows.map((row, i) => (
            <div key={i} className="flex gap-1">
              {row.map((key) => keyView(key))}
            </div>
          ))}
          <div className="flex gap-1">
            {layout.bottom.map((key) => keyView(key))}
            {keyView(left)}
            <div className="flex flex-col gap-1">
              {keyView(up, true)}
              {keyView(down, true)}
            </div>
            {keyView(right)}
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-400">{t("keyboard.legend")}</p>

        {finishing && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
            <fieldset className="space-y-1">
              <legend className="mb-1 font-medium">{t("keyboard.backlightQuestion")}</legend>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("keyboard.backlightIntro")}</p>
              <ul className="mb-2 list-disc pl-5 text-xs text-slate-600 dark:text-slate-400">
                {BACKLIGHT_CHECKS.map((c) => (
                  <li key={c}>{t(c)}</li>
                ))}
              </ul>
              {(["ok", "faulty", "offUnchecked", "notChecked"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="backlight" checked={backlight === value} onChange={() => setBacklight(value)} />
                  {t(`keyboard.backlight.${value}`)}
                </label>
              ))}
            </fieldset>
            {remaining.length === 0 ? (
              <button type="button" onClick={() => finish(false)} className="rounded-lg bg-emerald-700 px-4 py-2 font-medium text-white hover:bg-emerald-600">
                {t("keyboard.save")}
              </button>
            ) : (
              <div className="space-y-2">
                <p>
                  {t("keyboard.remaining", {
                    n: remaining.length,
                    keys: remaining.map((c) => {
                      const key = allKeys(layout).find((k) => k.code === c);
                      return key ? keyParam(key) : c;
                    }),
                  })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => finish(true)} className="rounded-lg bg-rose-700 px-4 py-2 font-medium text-white hover:bg-rose-600">
                    {t("keyboard.markBroken")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinishing(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 dark:border-slate-700"
                  >
                    {t("keyboard.continue")}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitationsOfTest")}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {KEYBOARD_LIMITATIONS.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
