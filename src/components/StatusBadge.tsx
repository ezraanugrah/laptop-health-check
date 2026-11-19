import type { Status } from "../types/diagnostics";
import { STATUS_META, type Tone } from "../lib/status";

// Nama class ditulis utuh agar terdeteksi oleh Tailwind.
const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  neutral: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  muted: "bg-slate-100 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400",
};

export function StatusBadge({ status }: { status: Status }) {
  const { label, tone } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}
