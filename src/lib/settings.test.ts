/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, documentAttributes, sanitizeSettings } from "./settings.ts";

test("default: Gelap + Bahasa Indonesia bila belum ada preferensi", () => {
  assert.deepEqual(DEFAULT_SETTINGS, { theme: "dark", language: "id-ID" });
  assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings("rusak"), DEFAULT_SETTINGS);
});

test("nilai valid dipakai; nilai tak dikenal jatuh ke default per field", () => {
  assert.deepEqual(sanitizeSettings({ theme: "light", language: "en-US" }), { theme: "light", language: "en-US" });
  assert.deepEqual(sanitizeSettings({ theme: "ungu", language: "en-US" }), { theme: "dark", language: "en-US" });
  assert.deepEqual(sanitizeSettings({ theme: "light", language: "fr-FR", lain: 1 }), { theme: "light", language: "id-ID" });
});

test("atribut dokumen untuk tema & bahasa (kelas dark, lang)", () => {
  assert.deepEqual(documentAttributes({ theme: "dark", language: "id-ID" }), { dark: true, lang: "id" });
  assert.deepEqual(documentAttributes({ theme: "light", language: "en-US" }), { dark: false, lang: "en" });
});
