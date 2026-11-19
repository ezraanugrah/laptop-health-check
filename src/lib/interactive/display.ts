// Tes Layar (T1): pola warna dan penilaian hasil (fungsi murni).
// Piksel mati tidak bisa dideteksi otomatis tanpa kamera eksternal, jadi hasil
// tes ini selalu "dikonfirmasi pengguna". Semua teks berupa kunci terjemahan.
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import { decideCompletedOutcome } from "./outcome.ts";

export interface DisplayPattern {
  id: string;
  name: UiKey;
  /** Petunjuk apa yang dicari pada pola ini. */
  hint: UiKey;
  /** Class Tailwind lengkap (tanpa style inline, sesuai CSP). */
  className: string;
  /** Warna teks kontrol yang terbaca di atas pola. */
  dark: boolean;
}

export const DISPLAY_PATTERNS: DisplayPattern[] = [
  { id: "black", name: "pattern.black.name", hint: "pattern.black.hint", className: "bg-black", dark: true },
  { id: "white", name: "pattern.white.name", hint: "pattern.white.hint", className: "bg-white", dark: false },
  { id: "red", name: "pattern.red.name", hint: "pattern.red.hint", className: "bg-[#ff0000]", dark: true },
  { id: "green", name: "pattern.green.name", hint: "pattern.green.hint", className: "bg-[#00ff00]", dark: false },
  { id: "blue", name: "pattern.blue.name", hint: "pattern.blue.hint", className: "bg-[#0000ff]", dark: true },
  { id: "gray", name: "pattern.gray.name", hint: "pattern.gray.hint", className: "bg-[#808080]", dark: true },
  {
    id: "gradient",
    name: "pattern.gradient.name",
    hint: "pattern.gradient.hint",
    className: "bg-gradient-to-r from-black to-white",
    dark: true,
  },
];

export type DisplayIssue = "deadPixel" | "stuckPixel" | "blotch" | "lines";

export const DISPLAY_ISSUES: Record<DisplayIssue, { label: UiKey; level: "critical" | "warning" }> = {
  deadPixel: { label: "issue.deadPixel", level: "critical" },
  stuckPixel: { label: "issue.stuckPixel", level: "critical" },
  lines: { label: "issue.lines", level: "critical" },
  blotch: { label: "issue.blotch", level: "critical" },
};

export const DISPLAY_LIMITATIONS: UiKey[] = [
  "displayLimit.notAutomatic",
  "displayLimit.windowScreen",
  "displayLimit.settings",
  "displayLimit.notch",
];

export interface DisplayAnswer {
  /** Jumlah pola yang sudah ditampilkan. */
  viewed: number;
  issues: DisplayIssue[];
  durationMs: number;
  finishedAt: string;
}

/** Tes selesai bila semua pola sudah dilihat. */
export function allPatternsViewed(viewed: number): boolean {
  return viewed >= DISPLAY_PATTERNS.length;
}

export function assessDisplay(answer: DisplayAnswer): InteractiveResult {
  const total = DISPLAY_PATTERNS.length;
  const evidence: Evidence[] = [
    {
      kind: "measured",
      level: "info",
      code: "displayResult.viewed",
      params: { viewed: Math.min(answer.viewed, total), total },
    },
  ];
  const unique = [...new Set(answer.issues)];
  if (unique.length === 0) {
    evidence.push({ kind: "userConfirmed", level: "ok", code: "displayResult.noIssues" });
  } else {
    for (const issue of unique) {
      evidence.push({
        kind: "userConfirmed",
        level: DISPLAY_ISSUES[issue].level,
        code: "displayResult.reported",
        // Kunci isu diterjemahkan saat ditampilkan (parameter berawalan "@").
        params: { issue: `@${DISPLAY_ISSUES[issue].label}` },
      });
    }
  }
  const outcome = decideCompletedOutcome(evidence);
  return {
    id: "display",
    outcome,
    summaryCode: outcome === "passed" ? "displayResult.passed" : "displayResult.failed",
    summaryParams: outcome === "passed" ? undefined : { n: unique.length },
    evidence,
    limitations: DISPLAY_LIMITATIONS,
    finishedAt: answer.finishedAt,
    durationMs: answer.durationMs,
  };
}

export function cancelledDisplay(viewed: number): InteractiveResult {
  return {
    id: "display",
    outcome: "cancelled",
    summaryCode: "displayResult.cancelled",
    summaryParams: { viewed, total: DISPLAY_PATTERNS.length },
    evidence: [],
    limitations: DISPLAY_LIMITATIONS,
  };
}
