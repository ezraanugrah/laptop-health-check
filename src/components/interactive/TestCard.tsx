import type { InteractiveResult, InteractiveTestId } from "../../types/interactive";
import { EVIDENCE_KIND_LABEL, OUTCOME_META, TEST_META, noteCount, outcomeLabel } from "../../lib/interactive/outcome";
import { REASON_TONE } from "../../lib/status";
import { useI18n } from "../../lib/preferences";
import { TONE_DOT, ToneBadge } from "../StatusBadge";

interface Props {
  id: InteractiveTestId;
  result: InteractiveResult | undefined;
  onStart: () => void;
  /** Alasan tes tidak bisa dimulai (mis. Mac tanpa Touch Bar), sudah diterjemahkan. */
  blockedReason?: string;
}

export function TestCard({ id, result, onStart, blockedReason }: Props) {
  const { t, time } = useI18n();
  const meta = TEST_META[id];
  const outcome = result?.outcome ?? "notRun";
  const startable = meta.implemented && !blockedReason;
  const notes = noteCount(result);
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">{t(meta.title)}</h3>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{t(meta.description)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ToneBadge label={outcomeLabel(result, t)} tone={OUTCOME_META[outcome].tone} />
          {notes > 0 && <ToneBadge label={t("tests.notes", { n: notes })} tone="warning" />}
        </div>
      </header>

      {result && <p className="text-sm text-slate-700 dark:text-slate-300">{t(result.summaryCode, result.summaryParams)}</p>}

      {result && result.evidence.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {result.evidence.map((e, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[REASON_TONE[e.level]]}`} aria-hidden />
              <span>
                {t(e.code, e.params)}{" "}
                <span className="text-[11px] whitespace-nowrap text-slate-600 dark:text-slate-400">
                  · {t(EVIDENCE_KIND_LABEL[e.kind])}
                  {e.experimental ? ` · ${t("evidence.experimental")}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {result && result.limitations.length > 0 && (
        <details className="text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer">{t("tests.limitations")}</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {result.limitations.map((l) => (
              <li key={l}>{t(l)}</li>
            ))}
          </ul>
        </details>
      )}

      <footer className="mt-auto flex items-center justify-between gap-2 pt-1">
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {!meta.implemented
            ? t("tests.notBuilt", { milestone: meta.milestone })
            : (blockedReason ?? (result?.finishedAt ? t("tests.finishedAt", { time: time(result.finishedAt) }) : ""))}
        </span>
        <button
          type="button"
          onClick={onStart}
          disabled={!startable}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          {result && result.outcome !== "notRun" ? t("tests.repeat") : t("tests.start")}
        </button>
      </footer>
    </article>
  );
}
