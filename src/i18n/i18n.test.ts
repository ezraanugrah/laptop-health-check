/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BACKEND_MESSAGES } from "./backend.ts";
import { UI_MESSAGES } from "./ui.ts";
import {
  bind,
  interpolate,
  isLang,
  lookup,
  missingKeys,
  translate,
  translateLabel,
  translateText,
} from "./translate.ts";

const RUST_SRC = join(import.meta.dirname, "..", "..", "src-tauri", "src");
const NAMESPACES = new Set([
  "battery",
  "cpu",
  "fans",
  "temperature",
  "storage",
  "memory",
  "system",
  "gpu",
  "ownership",
  "common",
  "value",
  "metric",
  "note",
  "support",
]);

function rustFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return rustFiles(path);
    return name.endsWith(".rs") ? [path] : [];
  });
}

/** Kode pesan yang dipakai kode Rust NON-test (modul `#[cfg(test)] mod tests` diabaikan). */
function rustCodes(): Map<string, string> {
  const codes = new Map<string, string>();
  for (const file of rustFiles(RUST_SRC)) {
    if (file.endsWith(join("platform", "fake.rs"))) continue; // platform palsu khusus test
    const source = readFileSync(file, "utf8").split(/#\[cfg\(test\)\]\s*mod tests/)[0];
    for (const [, literal] of source.matchAll(/"([a-z]+(?:\.[A-Za-z]+)+)"/g)) {
      if (NAMESPACES.has(literal.split(".")[0])) codes.set(literal, relative(RUST_SRC, file));
    }
  }
  return codes;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test("setiap kode pesan backend ada di katalog dalam dua bahasa", () => {
  const codes = rustCodes();
  assert.ok(codes.size > 150, `kode backend terbaca: ${codes.size}`);
  const missing = [...codes.keys()].filter((c) => !(c in BACKEND_MESSAGES));
  assert.deepEqual(missing, [], "kode tanpa terjemahan");
});

test("tidak ada kunci katalog backend yang tidak dipakai Rust", () => {
  const codes = rustCodes();
  const unused = Object.keys(BACKEND_MESSAGES).filter((k) => !codes.has(k));
  assert.deepEqual(unused, []);
});

test("setiap entri punya teks id & en yang tidak kosong dengan placeholder identik", () => {
  for (const [key, entry] of Object.entries({ ...BACKEND_MESSAGES, ...UI_MESSAGES })) {
    assert.ok(entry.id.trim().length > 0, `id kosong: ${key}`);
    assert.ok(entry.en.trim().length > 0, `en kosong: ${key}`);
    assert.deepEqual(placeholders(entry.en), placeholders(entry.id), `placeholder beda: ${key}`);
  }
});

test("kunci UI dan backend tidak bertabrakan", () => {
  const overlap = Object.keys(UI_MESSAGES).filter((k) => k in BACKEND_MESSAGES);
  assert.deepEqual(overlap, []);
});

test("interpolasi, parameter berupa daftar, dan kunci bertingkat '@'", () => {
  assert.equal(interpolate("{a} dan {b}", { a: 1, b: "dua" }), "1 dan dua");
  assert.equal(interpolate("{a} {hilang}", { a: "x" }), "x {hilang}");
  assert.equal(translate("id-ID", "keyboardResult.notResponding", { keys: ["Q", "@key.space"] }), "Tidak merespons saat ditekan: Q, spasi.");
  assert.equal(translate("en-US", "keyboardResult.notResponding", { keys: ["Q", "@key.space"] }), "No response when pressed: Q, space.");
  assert.equal(translate("en-US", "displayResult.reported", { issue: "@issue.lines" }), "Reported: Lines or flickering screen.");
});

test("fallback: kunci hilang → nama kunci; kode backend tak dikenal → teks Indonesia dari Rust", () => {
  assert.equal(translate("en-US", "kunci.tidak.ada"), "kunci.tidak.ada");
  assert.ok(missingKeys().includes("kunci.tidak.ada"));
  assert.equal(
    translateText("en-US", { text: "Teks asli dari Rust.", code: "battery.reason.kodeBaru" }),
    "Teks asli dari Rust.",
  );
  assert.equal(translateText("en-US", { text: "MacBookPro16,2" }), "MacBookPro16,2", "tanpa kode = tidak diterjemahkan");
  assert.equal(lookup("en-US", "kunci.tidak.ada"), undefined);
});

test("pesan backend diterjemahkan dengan parameter apa adanya (angka & nama hardware tidak diubah)", () => {
  const msg = {
    text: "Kapasitas tinggal 77% dari desain (di bawah 80%).",
    code: "battery.reason.capacityWarning",
    params: { pct: "77%", limit: "80" },
  };
  assert.equal(translateText("id-ID", msg), msg.text, "template Indonesia sama dengan teks Rust");
  assert.equal(translateText("en-US", msg), "Capacity is down to 77% of design (below 80%).");
  assert.equal(
    translateText("en-US", { text: "x", code: "storage.reason.smartVerified", params: { disk: "APPLE SSD AP0512M" } }),
    'APPLE SSD AP0512M: SMART status "Verified" according to macOS.',
  );
});

test("label metrik bergrup: grup tetap, label diterjemahkan", () => {
  assert.equal(translateLabel("en-US", "disk0 · Jenis", "storage.metric.type", { group: "disk0" }), "disk0 · Type");
  assert.equal(translateLabel("id-ID", "Jenis", "storage.metric.type", undefined), "Jenis");
  assert.equal(translateLabel("en-US", "Color LCD", undefined, undefined), "Color LCD", "nama layar tidak diterjemahkan");
});

test("bahasa yang didukung dan fungsi terikat bahasa", () => {
  assert.ok(isLang("id-ID") && isLang("en-US"));
  assert.ok(!isLang("fr-FR") && !isLang(undefined));
  assert.equal(bind("en-US")("nav.settings"), "Settings");
  assert.equal(bind("id-ID")("nav.settings"), "Pengaturan");
});

test("semua status hasil tersedia di kedua bahasa", () => {
  for (const key of [
    "status.healthy",
    "status.warning",
    "status.critical",
    "status.unknown",
    "status.notApplicable",
    "status.incomplete",
    "outcome.notRun",
    "outcome.passed",
    "outcome.failed",
    "outcome.unavailable",
    "outcome.cancelled",
  ] as const) {
    assert.notEqual(translate("id-ID", key), translate("en-US", key), key);
  }
});
