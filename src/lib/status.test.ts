/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CheckResult, HardwareSummary, Status } from "../types/diagnostics";
import {
  CATEGORY_ORDER,
  CHECK_ORDER,
  HARDWARE_STATUS_META,
  REASON_TONE,
  STATUS_META,
  categoryOf,
  checkTitle,
  countByStatus,
  coverageText,
  missingText,
} from "./status.ts";
import { bind, formatDateTime, formatDuration } from "../i18n/translate.ts";

const tId = bind("id-ID");
const tEn = bind("en-US");

const check = (status: Status): CheckResult => ({
  id: "system",
  category: "deviceSecurity",
  status,
  summary: "",
  reasons: [],
  metrics: [],
  sources: [],
  notes: [],
});

const summary = (over: Partial<HardwareSummary> = {}): HardwareSummary => ({
  status: "healthy",
  measured: 7,
  total: 7,
  missingCore: [],
  missingSupplementary: [],
  ...over,
});

test("countByStatus menghitung setiap status", () => {
  const counts = countByStatus([check("healthy"), check("healthy"), check("notApplicable")]);
  assert.equal(counts.healthy, 2);
  assert.equal(counts.notApplicable, 1);
  assert.equal(counts.critical, 0);
});

test("judul kartu macOS dalam dua bahasa", () => {
  assert.equal(checkTitle("ownership", tId), "Activation Lock & MDM");
  assert.equal(checkTitle("battery", tId), "Baterai");
  assert.equal(checkTitle("battery", tEn), "Battery");
  assert.equal(checkTitle("memory", tEn), "RAM & Memory");
});

test("kategori frontend sama dengan backend", () => {
  assert.equal(categoryOf("battery"), "coreHardware");
  assert.equal(categoryOf("storage"), "coreHardware");
  assert.equal(categoryOf("memory"), "coreHardware");
  assert.equal(categoryOf("cpu"), "coreHardware");
  assert.equal(categoryOf("temperature"), "supplementaryHardware");
  assert.equal(categoryOf("fans"), "supplementaryHardware");
  assert.equal(categoryOf("gpu"), "supplementaryHardware");
  assert.equal(categoryOf("system"), "deviceSecurity");
  assert.equal(categoryOf("ownership"), "deviceSecurity");
  assert.deepEqual(CATEGORY_ORDER, ["coreHardware", "supplementaryHardware", "deviceSecurity"]);
});

test("status 'belum lengkap' tidak pernah berlabel sehat", () => {
  assert.equal(tId(HARDWARE_STATUS_META.incomplete.label), "Pemeriksaan belum lengkap");
  assert.equal(tEn(HARDWARE_STATUS_META.incomplete.label), "Check incomplete");
  assert.notEqual(HARDWARE_STATUS_META.incomplete.tone, "success");
});

test("teks cakupan dan daftar yang belum terukur", () => {
  assert.equal(coverageText(summary({ measured: 5 }), tId), "5 dari 7 pemeriksaan hardware terukur");
  assert.equal(coverageText(summary({ measured: 5 }), tEn), "5 of 7 hardware checks measured");
  assert.deepEqual(missingText(summary(), tId), []);
  assert.deepEqual(
    missingText(summary({ missingCore: ["battery"], missingSupplementary: ["fans", "temperature"] }), tId),
    ["Data inti belum tersedia: Baterai.", "Pelengkap tidak terukur: Kipas, Temperatur."],
  );
  assert.deepEqual(
    missingText(summary({ missingCore: ["battery"], missingSupplementary: ["fans", "temperature"] }), tEn),
    ["Core data not yet available: Battery.", "Supplementary checks not measured: Fans, Temperature."],
  );
});

test("sembilan pemeriksaan; setiap status & alasan punya label/tone", () => {
  assert.equal(CHECK_ORDER.length, 9);
  for (const id of CHECK_ORDER) assert.ok(checkTitle(id, tEn).length > 0);
  for (const meta of Object.values(STATUS_META)) {
    assert.notEqual(tId(meta.label), meta.label, "label status punya terjemahan Indonesia");
    assert.notEqual(tEn(meta.label), meta.label, "label status punya terjemahan Inggris");
  }
  assert.equal(REASON_TONE.critical, "danger");
  assert.equal(REASON_TONE.ok, "success");
});

test("formatDuration per bahasa", () => {
  assert.equal(formatDuration("id-ID", 850), "850 ms");
  assert.equal(formatDuration("id-ID", 2345), "2.3 dtk");
  assert.equal(formatDuration("en-US", 2345), "2.3 s");
});

test("formatDateTime menghasilkan tanggal yang terbaca di kedua bahasa", () => {
  const ms = Date.UTC(2026, 10, 19, 3, 0);
  assert.match(formatDateTime("id-ID", ms), /2026/);
  assert.match(formatDateTime("en-US", ms), /2026/);
  assert.match(formatDateTime("en-US", ms), /Nov/);
});
