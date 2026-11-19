/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CheckResult } from "../types/diagnostics";
import {
  CHECK_ORDER,
  CHECK_TITLES,
  STATUS_META,
  countByStatus,
  formatBytes,
  formatTimestamp,
} from "./status.ts";

const check = (status: CheckResult["status"]): CheckResult => ({
  id: "system",
  status,
  summary: "",
  metrics: [],
});

test("countByStatus menghitung setiap status", () => {
  const counts = countByStatus([check("pass"), check("pass"), check("notImplemented")]);
  assert.equal(counts.pass, 2);
  assert.equal(counts.notImplemented, 1);
  assert.equal(counts.fail, 0);
});

test("formatBytes konsisten dengan format_gib di Rust", () => {
  assert.equal(formatBytes(8 * 1024 ** 3), "8 GB");
  assert.equal(formatBytes(1_610_612_736), "1.5 GB");
  assert.equal(formatBytes(null), "Tidak diketahui");
  assert.equal(formatBytes(0), "Tidak diketahui");
});

test("setiap pemeriksaan punya judul dan setiap status punya label", () => {
  for (const id of CHECK_ORDER) assert.ok(CHECK_TITLES[id].length > 0);
  for (const meta of Object.values(STATUS_META)) assert.ok(meta.label.length > 0);
});

test("formatTimestamp menghasilkan tanggal yang terbaca", () => {
  const text = formatTimestamp(Date.UTC(2026, 10, 19, 3, 0));
  assert.match(text, /2026/);
});
