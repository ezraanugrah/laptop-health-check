import type { HardwareStatus, Status } from "../types/diagnostics";
import { HARDWARE_STATUS_META, STATUS_META, type Tone } from "../lib/status";
import { useI18n } from "../lib/preferences";

// Nama class ditulis utuh agar terdeteksi oleh Tailwind.
const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  neutral: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  muted: "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
};

/** Warna titik indikator per tone (dipakai daftar alasan). */
export const TONE_DOT: Record<Tone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-rose-500",
  neutral: "bg-slate-400",
  muted: "bg-slate-300 dark:bg-slate-600",
};

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  );
}

/** Badge dengan label/tone bebas (dipakai hasil Tes Interaktif). */
export function ToneBadge({ label, tone }: { label: string; tone: Tone }) {
  return <Badge label={label} tone={tone} />;
}

export function StatusBadge({ status }: { status: Status }) {
  const { t } = useI18n();
  return <Badge label={t(STATUS_META[status].label)} tone={STATUS_META[status].tone} />;
}

export function HardwareStatusBadge({ status }: { status: HardwareStatus }) {
  const { t } = useI18n();
  return <Badge label={t(HARDWARE_STATUS_META[status].label)} tone={HARDWARE_STATUS_META[status].tone} />;
}
