// Model hasil Tes Interaktif: label, penentuan hasil, ringkasan (fungsi murni).
import type { Status } from "../../types/diagnostics";
import type {
  Evidence,
  InteractiveResult,
  InteractiveResults,
  InteractiveTestId,
  TestOutcome,
} from "../../types/interactive";
import type { Tone } from "../status";
import type { T, UiKey } from "../../i18n/translate.ts";

export const TEST_ORDER: InteractiveTestId[] = [
  "display",
  "keyboard",
  "trackpad",
  "touchBar",
  "speakers",
  "microphone",
  "camera",
  "wireless",
  "ports",
];

export interface TestMeta {
  title: UiKey;
  description: UiKey;
  /** Sudah dibuat di versi ini? Tes yang belum dibuat tetap "Belum diuji". */
  implemented: boolean;
  milestone: string;
}

export const TEST_META: Record<InteractiveTestId, TestMeta> = {
  display: {
    title: "test.display.title",
    description: "test.display.description",
    implemented: true,
    milestone: "3.2",
  },
  keyboard: {
    title: "test.keyboard.title",
    description: "test.keyboard.description",
    implemented: true,
    milestone: "3.3",
  },
  trackpad: {
    title: "test.trackpad.title",
    description: "test.trackpad.description",
    implemented: false,
    milestone: "3.4",
  },
  touchBar: {
    title: "test.touchBar.title",
    description: "test.touchBar.description",
    implemented: false,
    milestone: "3.3",
  },
  speakers: {
    title: "test.speakers.title",
    description: "test.speakers.description",
    implemented: false,
    milestone: "3.5",
  },
  microphone: {
    title: "test.microphone.title",
    description: "test.microphone.description",
    implemented: false,
    milestone: "3.5",
  },
  camera: {
    title: "test.camera.title",
    description: "test.camera.description",
    implemented: false,
    milestone: "3.6",
  },
  wireless: {
    title: "test.wireless.title",
    description: "test.wireless.description",
    implemented: false,
    milestone: "3.7",
  },
  ports: {
    title: "test.ports.title",
    description: "test.ports.description",
    implemented: false,
    milestone: "3.8",
  },
};

export const OUTCOME_META: Record<TestOutcome, { label: UiKey; tone: Tone }> = {
  notRun: { label: "outcome.notRun", tone: "muted" },
  passed: { label: "outcome.passed", tone: "success" },
  failed: { label: "outcome.failed", tone: "danger" },
  unavailable: { label: "outcome.unavailable", tone: "neutral" },
  cancelled: { label: "outcome.cancelled", tone: "neutral" },
};

export const EVIDENCE_KIND_LABEL: Record<"measured" | "userConfirmed", UiKey> = {
  measured: "evidence.measured",
  userConfirmed: "evidence.userConfirmed",
};

/** Bukti terukur yang sah (bukan eksperimental) dan positif. */
export function hasMeasuredProof(evidence: Evidence[]): boolean {
  return evidence.some((e) => e.kind === "measured" && e.level === "ok" && !e.experimental);
}

/** Kunci label hasil. "Lulus" tanpa bukti terukur selalu diberi keterangan. */
export function outcomeLabelKey(result: InteractiveResult | undefined): UiKey {
  if (!result) return OUTCOME_META.notRun.label;
  if (result.outcome === "passed" && !hasMeasuredProof(result.evidence)) {
    return "outcome.passedUserConfirmed";
  }
  return OUTCOME_META[result.outcome].label;
}

export function outcomeLabel(result: InteractiveResult | undefined, t: T): string {
  return t(outcomeLabelKey(result));
}

/**
 * Jumlah catatan (bukti berlevel peringatan, termasuk yang eksperimental).
 * Ditampilkan di samping "Lulus" agar temuan tidak tersembunyi — tanpa
 * menambah status baru.
 */
export function noteCount(result: InteractiveResult | undefined): number {
  return result ? result.evidence.filter((e) => e.level === "warning").length : 0;
}

/**
 * Hasil tes yang sudah diselesaikan: Gagal bila ada bukti kritis yang bukan
 * eksperimental; selain itu Lulus. Bukti eksperimental tidak mengubah hasil.
 */
export function decideCompletedOutcome(evidence: Evidence[]): "passed" | "failed" {
  return evidence.some((e) => e.level === "critical" && !e.experimental) ? "failed" : "passed";
}

/**
 * Perlu mencatat "Dibatalkan" saat pengguna keluar sebelum selesai? Tidak bila sudah ada
 * hasil selesai sebelumnya (Lulus/Gagal/Tidak tersedia) — hasil itu tetap dipakai.
 */
export function shouldRecordCancel(previous: InteractiveResult | undefined): boolean {
  return !previous || previous.outcome === "notRun" || previous.outcome === "cancelled";
}

export interface InteractiveSummary {
  total: number;
  tested: number;
  passed: number;
  failed: number;
  unavailable: number;
  cancelled: number;
  notRun: number;
}

export function summarize(results: InteractiveResults, ids: InteractiveTestId[] = TEST_ORDER): InteractiveSummary {
  const s: InteractiveSummary = {
    total: ids.length,
    tested: 0,
    passed: 0,
    failed: 0,
    unavailable: 0,
    cancelled: 0,
    notRun: 0,
  };
  for (const id of ids) {
    const outcome = results[id]?.outcome ?? "notRun";
    s[outcome] += 1;
    if (outcome === "passed" || outcome === "failed") s.tested += 1;
  }
  return s;
}

export function summaryText(s: InteractiveSummary, t: T): string {
  const parts = [t("tests.summary.done", { tested: s.tested, total: s.total })];
  if (s.passed) parts.push(t("tests.summary.passed", { n: s.passed }));
  if (s.failed) parts.push(t("tests.summary.failed", { n: s.failed }));
  if (s.unavailable) parts.push(t("tests.summary.unavailable", { n: s.unavailable }));
  if (s.cancelled) parts.push(t("tests.summary.cancelled", { n: s.cancelled }));
  return parts.join(" · ");
}

/**
 * Pemetaan ke status kartu untuk laporan (Fase 4). Hanya "Lulus" yang bisa
 * menjadi Sehat — tes yang belum dilakukan, dibatalkan, atau tidak tersedia
 * TIDAK PERNAH dianggap sehat.
 */
export function toCheckStatus(outcome: TestOutcome): Status {
  switch (outcome) {
    case "passed":
      return "healthy";
    case "failed":
      return "critical";
    case "unavailable":
    case "cancelled":
    case "notRun":
      return "unknown";
  }
}
