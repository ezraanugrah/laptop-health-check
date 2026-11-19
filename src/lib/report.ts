// Laporan pemeriksaan (fungsi murni): menggabungkan diagnostik otomatis dan Tes Interaktif
// menjadi satu dokumen yang SUDAH diterjemahkan ke bahasa yang dipilih. Dipakai untuk
// ekspor JSON dan tampilan cetak/PDF. Tes yang belum dijalankan atau belum tersedia
// tidak pernah tampil sebagai Lulus; nomor seri hanya ikut bila pengguna memilihnya.
import type { AppInfo, CheckResult, DiagnosticsReport, ReasonLevel, Status } from "../types/diagnostics.ts";
import type { EvidenceKind, EvidenceLevel, InteractiveResults, InteractiveTestId, TestOutcome } from "../types/interactive.ts";
import { bind, formatDateTime, translateLabel, translateText, type Lang } from "../i18n/translate.ts";
import { CHECK_ORDER, HARDWARE_STATUS_META, STATUS_META, checkTitleKey, coverageText, missingText } from "./status.ts";
import {
  EVIDENCE_KIND_LABEL,
  OUTCOME_META,
  TEST_META,
  TEST_ORDER,
  outcomeLabelKey,
  summarize,
  summaryText,
} from "./interactive/outcome.ts";

export const REPORT_SCHEMA_VERSION = 1;

/** Hasil tes di laporan: hasil asli, atau "notAvailable" untuk tes yang belum dibuat. */
export type ReportTestOutcome = TestOutcome | "notAvailable";

export interface ReportLine {
  level: ReasonLevel | EvidenceLevel;
  text: string;
}

export interface ReportCheck {
  id: CheckResult["id"];
  title: string;
  category: CheckResult["category"];
  status: Status;
  statusLabel: string;
  summary: string;
  reasons: ReportLine[];
  metrics: { label: string; value: string; experimental: boolean }[];
  notes: string[];
}

export interface ReportTest {
  id: InteractiveTestId;
  title: string;
  outcome: ReportTestOutcome;
  outcomeLabel: string;
  summary: string;
  evidence: { kind: EvidenceKind; kindLabel: string; level: EvidenceLevel; text: string; experimental: boolean }[];
  limitations: string[];
  finishedAt: string | null;
}

export interface ReportDoc {
  schemaVersion: number;
  title: string;
  language: Lang;
  generatedAt: string;
  generatedAtText: string;
  app: { name: string; version: string | null; os: string | null; arch: string | null };
  support: { level: string; label: string; note: string } | null;
  device: { label: string; value: string }[];
  /** `false` = disembunyikan (default). Nilai hanya ada bila pengguna memilih menyertakannya. */
  serialNumberIncluded: boolean;
  serialNumber: string | null;
  diagnostics: {
    ran: boolean;
    checkedAt: string | null;
    checkedAtText: string | null;
    hardwareStatus: string | null;
    hardwareStatusLabel: string | null;
    coverage: string | null;
    missing: string[];
  };
  checks: ReportCheck[];
  interactive: { summary: string; tests: ReportTest[] };
  notes: string[];
}

export interface ReportInput {
  lang: Lang;
  now: Date;
  appInfo: AppInfo | null;
  diagnostics: DiagnosticsReport | null;
  interactive: InteractiveResults;
  /** Hanya diisi bila pengguna mencentang "Sertakan nomor seri". */
  serialNumber?: string | null;
}

function checkToReport(check: CheckResult, lang: Lang): ReportCheck {
  const t = bind(lang);
  return {
    id: check.id,
    title: t(checkTitleKey(check.id)),
    category: check.category,
    status: check.status,
    statusLabel: t(STATUS_META[check.status].label),
    summary: translateText(lang, { text: check.summary, code: check.summaryCode, params: check.summaryParams }),
    reasons: check.reasons.map((r) => ({
      level: r.level,
      text: translateText(lang, { text: r.text, code: r.code, params: r.params }),
    })),
    metrics: check.metrics.map((m) => ({
      label: translateLabel(lang, m.label, m.labelCode, m.labelParams),
      value: translateText(lang, { text: m.value, code: m.valueCode, params: m.valueParams }),
      experimental: m.experimental,
    })),
    notes: check.notes.map((n) => translateText(lang, n)),
  };
}

function testToReport(id: InteractiveTestId, input: ReportInput): ReportTest {
  const t = bind(input.lang);
  const meta = TEST_META[id];
  const result = input.interactive[id];
  if (!meta.implemented) {
    return {
      id,
      title: t(meta.title),
      outcome: "notAvailable",
      outcomeLabel: t("tests.notAvailableYet"),
      summary: "",
      evidence: [],
      limitations: [],
      finishedAt: null,
    };
  }
  return {
    id,
    title: t(meta.title),
    outcome: result?.outcome ?? "notRun",
    outcomeLabel: t(outcomeLabelKey(result)),
    summary: result ? t(result.summaryCode, result.summaryParams) : "",
    evidence: (result?.evidence ?? []).map((e) => ({
      kind: e.kind,
      kindLabel: t(EVIDENCE_KIND_LABEL[e.kind]),
      level: e.level,
      text: t(e.code, e.params),
      experimental: e.experimental === true,
    })),
    limitations: (result?.limitations ?? []).map((l) => t(l)),
    finishedAt: result?.finishedAt ?? null,
  };
}

export function buildReport(input: ReportInput): ReportDoc {
  const { lang, now, appInfo, diagnostics } = input;
  const t = bind(lang);
  const checks = diagnostics
    ? CHECK_ORDER.map((id) => diagnostics.checks.find((c) => c.id === id))
        .filter((c): c is CheckResult => c !== undefined)
        .map((c) => checkToReport(c, lang))
    : [];
  const system = checks.find((c) => c.id === "system");
  const serial = input.serialNumber?.trim() ? input.serialNumber.trim() : null;

  const notes = [t("report.note.indicative"), t("report.note.userConfirmed"), t("report.note.offline")];
  if (!diagnostics) notes.unshift(t("report.note.noDiagnostics"));
  notes.push(serial ? t("report.note.serialIncluded") : t("report.note.serialHidden"));

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    title: t("report.doc.title"),
    language: lang,
    generatedAt: now.toISOString(),
    generatedAtText: formatDateTime(lang, now.getTime()),
    app: {
      name: appInfo?.name ?? t("app.name"),
      version: appInfo?.version ?? null,
      os: appInfo?.os ?? null,
      arch: appInfo?.arch ?? null,
    },
    support: appInfo
      ? {
          level: appInfo.support.level,
          label: t(appInfo.support.level === "verified" ? "about.verified" : "about.preview"),
          note: translateText(lang, { text: appInfo.support.note, code: appInfo.support.noteCode }),
        }
      : null,
    device: system ? system.metrics.map((m) => ({ label: m.label, value: m.value })) : [],
    serialNumberIncluded: serial !== null,
    serialNumber: serial,
    diagnostics: {
      ran: diagnostics !== null,
      checkedAt: diagnostics ? new Date(diagnostics.generatedAt).toISOString() : null,
      checkedAtText: diagnostics ? formatDateTime(lang, diagnostics.generatedAt) : null,
      hardwareStatus: diagnostics?.hardware.status ?? null,
      hardwareStatusLabel: diagnostics ? t(HARDWARE_STATUS_META[diagnostics.hardware.status].label) : null,
      coverage: diagnostics ? coverageText(diagnostics.hardware, t) : null,
      missing: diagnostics ? missingText(diagnostics.hardware, t) : [],
    },
    checks,
    interactive: {
      summary: summaryText(summarize(input.interactive), t),
      tests: TEST_ORDER.map((id) => testToReport(id, input)),
    },
    notes,
  };
}

export function reportJson(doc: ReportDoc): string {
  return JSON.stringify(doc, null, 2);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Nama file usulan, mis. `LaptopHealthCheck-Laporan-2026-11-19-1705.json` (waktu lokal). */
export function reportFileName(doc: ReportDoc, now: Date, ext: "json" | "pdf"): string {
  const word = doc.language === "en-US" ? "Report" : "Laporan";
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `LaptopHealthCheck-${word}-${stamp}.${ext}`;
}

/** Nada badge untuk hasil tes di laporan (termasuk "Belum tersedia"). */
export function reportTestTone(outcome: ReportTestOutcome) {
  return outcome === "notAvailable" ? "neutral" : OUTCOME_META[outcome].tone;
}
