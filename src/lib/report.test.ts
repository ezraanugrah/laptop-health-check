/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppInfo, CheckResult, DiagnosticsReport } from "../types/diagnostics.ts";
import type { InteractiveResults } from "../types/interactive.ts";
import { REPORT_SCHEMA_VERSION, buildReport, reportFileName, reportJson, reportTestTone } from "./report.ts";

const NOW = new Date(2026, 10, 19, 17, 5, 0);

const APP: AppInfo = {
  name: "Laptop Health Check",
  version: "0.2.0",
  os: "macos",
  arch: "x86_64",
  support: { level: "verified", note: "Mac Intel terverifikasi.", noteCode: "support.verifiedIntel" },
};

function check(partial: Partial<CheckResult> & Pick<CheckResult, "id" | "status">): CheckResult {
  return {
    category: "coreHardware",
    summary: "Ringkasan.",
    reasons: [],
    metrics: [],
    sources: [],
    notes: [],
    ...partial,
  } as CheckResult;
}

const DIAG: DiagnosticsReport = {
  hardware: { status: "healthy", measured: 4, total: 4, missingCore: [], missingSupplementary: [] },
  generatedAt: NOW.getTime() - 60_000,
  durationMs: 3200,
  checks: [
    check({
      id: "system",
      status: "healthy",
      category: "deviceSecurity",
      metrics: [{ label: "Prosesor", labelCode: "system.metric.processor", value: "Intel Core i5", experimental: false }],
    }),
    check({
      id: "battery",
      status: "warning",
      summary: "Kapasitas tinggal 77% dari desain (di bawah 80%).",
      reasons: [
        {
          level: "warning",
          text: "Kapasitas tinggal 77% dari desain (di bawah 80%).",
          code: "battery.reason.capacityWarning",
          params: { pct: "77%", limit: "80" },
        },
      ],
    }),
  ],
} as unknown as DiagnosticsReport;

test("tes yang belum dibuat → 'Belum tersedia', yang belum dijalankan → 'Belum diuji', tidak pernah Lulus", () => {
  const doc = buildReport({ lang: "id-ID", now: NOW, appInfo: APP, diagnostics: DIAG, interactive: {} });
  const byId = Object.fromEntries(doc.interactive.tests.map((t) => [t.id, t]));
  assert.equal(doc.interactive.tests.length, 10);
  for (const t of doc.interactive.tests) {
    assert.notEqual(t.outcome, "passed", t.id);
    assert.ok(t.outcome === "notRun" || t.outcome === "notAvailable", t.id);
  }
  assert.equal(byId.display.outcome, "notRun");
  assert.equal(byId.display.outcomeLabel, "Belum diuji");
  assert.equal(reportTestTone("notAvailable"), "neutral");
});

test("hasil tes yang ada dibawa apa adanya, dengan label bukti terukur vs dikonfirmasi pengguna", () => {
  const interactive: InteractiveResults = {
    display: {
      id: "display",
      outcome: "passed",
      summaryCode: "displayResult.passed",
      evidence: [{ kind: "userConfirmed", level: "ok", code: "displayResult.noIssues" }],
      limitations: [],
      finishedAt: NOW.toISOString(),
    },
  } as unknown as InteractiveResults;
  const doc = buildReport({ lang: "id-ID", now: NOW, appInfo: APP, diagnostics: DIAG, interactive });
  const display = doc.interactive.tests.find((t) => t.id === "display")!;
  assert.equal(display.outcome, "passed");
  assert.equal(display.outcomeLabel, "Lulus (dikonfirmasi pengguna)", "tanpa bukti terukur");
  assert.equal(display.evidence[0].kindLabel, "Dikonfirmasi pengguna");
});

test("nomor seri disembunyikan secara default dan hanya ikut bila diberikan", () => {
  const hidden = buildReport({ lang: "id-ID", now: NOW, appInfo: APP, diagnostics: DIAG, interactive: {} });
  assert.equal(hidden.serialNumberIncluded, false);
  assert.equal(hidden.serialNumber, null);
  assert.ok(!reportJson(hidden).includes("C02TEST"));
  assert.ok(hidden.notes.includes("Nomor seri tidak disertakan (default)."));

  const shown = buildReport({ lang: "id-ID", now: NOW, appInfo: APP, diagnostics: DIAG, interactive: {}, serialNumber: " C02TEST " });
  assert.equal(shown.serialNumberIncluded, true);
  assert.equal(shown.serialNumber, "C02TEST");
});

test("teks backend diterjemahkan ke bahasa laporan; angka & nama hardware tetap", () => {
  const en = buildReport({ lang: "en-US", now: NOW, appInfo: APP, diagnostics: DIAG, interactive: {} });
  const battery = en.checks.find((c) => c.id === "battery")!;
  assert.equal(battery.statusLabel, "Warning");
  assert.equal(battery.reasons[0].text, "Capacity is down to 77% of design (below 80%).");
  assert.equal(en.device[0].value, "Intel Core i5");
  assert.equal(en.title, "Laptop Health Check Inspection Report");
  assert.equal(en.diagnostics.hardwareStatusLabel, "Healthy");
});

test("tanpa diagnostik: bagian hardware kosong dan ada catatannya", () => {
  const doc = buildReport({ lang: "id-ID", now: NOW, appInfo: null, diagnostics: null, interactive: {} });
  assert.equal(doc.diagnostics.ran, false);
  assert.deepEqual(doc.checks, []);
  assert.equal(doc.support, null);
  assert.match(doc.notes[0], /belum dijalankan/);
});

test("JSON valid, versi skema, dan nama file per bahasa", () => {
  const doc = buildReport({ lang: "en-US", now: NOW, appInfo: APP, diagnostics: DIAG, interactive: {} });
  const parsed = JSON.parse(reportJson(doc));
  assert.equal(parsed.schemaVersion, REPORT_SCHEMA_VERSION);
  assert.equal(parsed.language, "en-US");
  assert.equal(reportFileName(doc, NOW, "json"), "LaptopHealthCheck-Report-2026-11-19-1705.json");
  const id = buildReport({ lang: "id-ID", now: NOW, appInfo: APP, diagnostics: DIAG, interactive: {} });
  assert.equal(reportFileName(id, NOW, "pdf"), "LaptopHealthCheck-Laporan-2026-11-19-1705.pdf");
});
