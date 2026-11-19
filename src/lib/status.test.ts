/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CheckResult, Status } from "../types/diagnostics";
import {
  CHECK_ORDER,
  CHECK_TITLES,
  REASON_TONE,
  STATUS_META,
  countByStatus,
  formatDuration,
  formatTimestamp,
  summarizeCounts,
} from "./status.ts";

const check = (status: Status): CheckResult => ({
  id: "system",
  status,
  summary: "",
  reasons: [],
  metrics: [],
  sources: [],
  notes: [],
});

test("countByStatus menghitung setiap status", () => {
  const counts = countByStatus([check("healthy"), check("healthy"), check("notApplicable")]);
  assert.equal(counts.healthy, 2);
  assert.equal(counts.notApplicable, 1);
  assert.equal(counts.critical, 0);
});

test("summarizeCounts mengurutkan dari yang paling berat dan melewati nol", () => {
  const counts = countByStatus([
    check("healthy"),
    check("warning"),
    check("warning"),
    check("unknown"),
  ]);
  assert.equal(summarizeCounts(counts), "2 peringatan · 1 tidak diketahui · 1 sehat");
});

test("sembilan pemeriksaan, masing-masing punya judul; setiap status & alasan punya label/tone", () => {
  assert.equal(CHECK_ORDER.length, 9);
  for (const id of CHECK_ORDER) assert.ok(CHECK_TITLES[id].length > 0);
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
