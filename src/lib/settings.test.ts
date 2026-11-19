/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { LANGS, translate } from "../i18n/translate.ts";
import {
  DEFAULT_SETTINGS,
  documentAttributes,
  LANGUAGE_OPTIONS,
  languageOption,
  otherTheme,
  sanitizeSettings,
  THEME_LABEL,
} from "./settings.ts";

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

test("menu bahasa header: tepat satu pilihan per bahasa yang didukung, kode & bendera ringkas", () => {
  assert.deepEqual(
    LANGUAGE_OPTIONS.map((o) => o.value),
    LANGS,
  );
  assert.deepEqual(
    LANGUAGE_OPTIONS.map((o) => `${o.flag} ${o.code}`),
    ["🇮🇩 ID", "🇬🇧 EN"],
  );
  assert.equal(languageOption("en-US").code, "EN");
  assert.equal(languageOption("id-ID").htmlLang, "id");
  // Nama bahasa ditulis dalam bahasanya sendiri, di kedua UI.
  for (const lang of LANGS) {
    assert.equal(translate(lang, languageOption("id-ID").label), "Bahasa Indonesia");
    assert.equal(translate(lang, languageOption("en-US").label), "English");
  }
});

test("tombol tema header: berganti bolak-balik, label diterjemahkan", () => {
  assert.equal(otherTheme("dark"), "light");
  assert.equal(otherTheme("light"), "dark");
  assert.equal(translate("id-ID", THEME_LABEL.dark), "Gelap");
  assert.equal(translate("en-US", THEME_LABEL.light), "Light");
  assert.equal(
    translate("id-ID", "prefs.themeButton", { current: "Gelap", next: "Terang" }),
    "Tema: Gelap. Ganti ke Terang",
  );
});
