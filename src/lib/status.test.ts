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
  formatDuration,
  formatTimestamp,
  missingText,
} from "./status.ts";

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

test("judul kartu kepemilikan mengikuti OS (D2)", () => {
  assert.equal(checkTitle("ownership", "macos"), "Activation Lock & MDM");
  assert.equal(checkTitle("ownership", "windows"), "Aktivasi & Manajemen Perangkat");
  assert.equal(checkTitle("ownership"), "Kepemilikan & Manajemen");
  assert.equal(checkTitle("battery", "windows"), "Baterai");
});

test("kategori frontend sama dengan backend (D1)", () => {
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
  assert.equal(HARDWARE_STATUS_META.incomplete.label, "Pemeriksaan belum lengkap");
  assert.notEqual(HARDWARE_STATUS_META.incomplete.tone, "success");
});

test("teks cakupan dan daftar yang belum terukur", () => {
  assert.equal(coverageText(summary({ measured: 5 })), "5 dari 7 pemeriksaan hardware terukur");
  assert.deepEqual(missingText(summary()), []);
  assert.deepEqual(
    missingText(summary({ missingCore: ["battery"], missingSupplementary: ["fans", "temperature"] })),
    ["Data inti belum tersedia: Baterai.", "Pelengkap tidak terukur: Kipas, Temperatur."],
  );
});

test("sembilan pemeriksaan; setiap status & alasan punya label/tone", () => {
  assert.equal(CHECK_ORDER.length, 9);
  for (const id of CHECK_ORDER) assert.ok(checkTitle(id).length > 0);
  for (const meta of Object.values(STATUS_META)) assert.ok(meta.label.length > 0);
  assert.equal(REASON_TONE.critical, "danger");
  assert.equal(REASON_TONE.ok, "success");
});

test("formatDuration", () => {
  assert.equal(formatDuration(850), "850 ms");
  assert.equal(formatDuration(2345), "2.3 dtk");
});

test("formatTimestamp menghasilkan tanggal yang terbaca", () => {
  assert.match(formatTimestamp(Date.UTC(2026, 10, 19, 3, 0)), /2026/);
});
