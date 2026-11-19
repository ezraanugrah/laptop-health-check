// Website Laptop Health Check: ganti bahasa (ID/EN) dan tema (gelap/terang).
// Tanpa library, tanpa jaringan, tanpa analitik. Preferensi hanya di localStorage pengunjung.
(function () {
  "use strict";

  var EN = {
    skip: "Skip to content",
    "nav.label": "Navigation",
    "nav.features": "Features",
    "nav.privacy": "Privacy",
    "nav.howto": "How to use",
    "nav.status": "Status",
    "hero.badge": "Beta · Intel Mac",
    "hero.title": "Check a MacBook's hardware health, straight from a USB drive.",
    "hero.lead":
      "Laptop Health Check reads the condition of the battery, SSD, RAM, CPU, temperatures, fans, GPU, and Activation Lock/MDM status — fully offline, with no account and no data sent.",
    "hero.download": "Download — coming soon",
    "hero.howto": "See how to use it",
    "hero.note": "The beta has not been released publicly yet. It has only been tested on an Intel MacBook Pro so far.",
    "features.title": "What it checks",
    "features.lead":
      "Measured results are kept apart from user-confirmed ones. Data that cannot be read is marked “Unknown”, never “Healthy”.",
    "features.auto.title": "9 automatic checks",
    "features.auto.1": "System and specifications",
    "features.auto.2": "Battery: capacity & charge cycles",
    "features.auto.3": "SSD/HDD: SMART, TRIM, free space",
    "features.auto.4": "RAM & memory",
    "features.auto.5": "CPU & thermal state",
    "features.auto.6": "Temperatures and fans",
    "features.auto.7": "GPU",
    "features.auto.8": "Activation Lock & MDM (with detection limits)",
    "features.interactive.title": "10 interactive tests",
    "features.interactive.1": "Display: full-screen color patterns",
    "features.interactive.2": "Keyboard, Trackpad, Touch Bar",
    "features.interactive.3": "Speakers left/right/stereo",
    "features.interactive.4": "Camera & microphone (with your consent)",
    "features.interactive.5": "Wi-Fi & Bluetooth (no scanning)",
    "features.interactive.6": "USB/Thunderbolt ports",
    "features.report.title": "PDF & JSON reports",
    "features.report.1": "Indonesian & English",
    "features.report.2": "You choose where to save",
    "features.report.3": "Tests not run are never counted as passed",
    "features.report.4": "Serial number only if you choose",
    "privacy.title": "Privacy & safety",
    "privacy.offline.title": "100% offline",
    "privacy.offline.text": "No internet connection, account, telemetry, or ads. No device data is sent anywhere.",
    "privacy.readonly.title": "Read-only",
    "privacy.readonly.text": "It never changes settings, fans, power, Wi-Fi, or Bluetooth. No administrator password needed.",
    "privacy.media.title": "Camera & microphone locked",
    "privacy.media.text":
      "Opened only in a separate test window after you agree, for at most 10 seconds. No photo or video is saved; the microphone test recording stays in memory and is then deleted.",
    "privacy.serial.title": "Personal data stays put",
    "privacy.serial.text":
      "The serial number is hidden by default. USB drives and external disks are not read. Bluetooth/USB device names, SSIDs, and MAC addresses are never shown.",
    "howto.title": "Using it from a USB drive",
    "howto.1": "Put the Laptop Health Check .dmg file on a USB drive.",
    "howto.2": "Plug it into the Mac you want to check and double-click the .dmg file.",
    "howto.3": "Double-click “Laptop Health Check”. It runs straight from the DMG — nothing is installed.",
    "howto.4": "When done, quit the app (⌘Q), then eject the DMG and the USB drive.",
    "gatekeeper.title": "If macOS refuses to open the app",
    "gatekeeper.text":
      "The beta is not yet signed and notarized by Apple. On macOS 14 or earlier: Control-click the app → Open. On macOS 15 or later: System Settings → Privacy & Security → “Open Anyway”.",
    "gatekeeper.warn": "Never turn off Gatekeeper or SIP. If the Mac's owner does not allow it, do not force it.",
    "status.title": "Status & limitations",
    "status.tested.term": "Tested",
    "status.tested.desc": "MacBook Pro 16,2 (Intel) running macOS 26.",
    "status.as.term": "Apple Silicon",
    "status.as.desc": "An ARM64 build exists but has not been tested on real hardware — not supported yet.",
    "status.sign.term": "Apple signing",
    "status.sign.desc": "Not yet signed with a Developer ID or notarized.",
    "status.scope.term": "Result scope",
    "status.scope.desc": "Results are indicative and do not replace Apple Diagnostics or an authorized technician.",
    "footer.privacy": "This website uses no cookies, analytics, or external fonts.",
  };

  var root = document.documentElement;
  var original = {}; // teks Indonesia asli dari HTML (bahasa default)
  var originalAttr = {};

  function store(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      /* penyimpanan diblokir: preferensi hanya untuk halaman ini */
    }
  }

  function applyLanguage(lang) {
    root.lang = lang;
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (!(key in original)) original[key] = el.textContent;
      el.textContent = lang === "en" && EN[key] ? EN[key] : original[key];
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      var spec = el.getAttribute("data-i18n-attr").split(":");
      var attr = spec[0];
      var key = spec[1];
      var id = attr + "|" + key;
      if (!(id in originalAttr)) originalAttr[id] = el.getAttribute(attr);
      el.setAttribute(attr, lang === "en" && EN[key] ? EN[key] : originalAttr[id]);
    });
    var label = document.getElementById("lang-label");
    var button = document.getElementById("lang-toggle");
    if (label) label.textContent = lang === "en" ? "ID" : "EN";
    if (button) button.setAttribute("aria-label", lang === "en" ? "Ganti bahasa ke Bahasa Indonesia" : "Switch language to English");
    document.title =
      lang === "en"
        ? "Laptop Health Check — Offline Mac hardware health check"
        : "Laptop Health Check — Cek kesehatan hardware Mac secara offline";
  }

  function applyThemeLabel() {
    var dark = root.classList.contains("dark");
    var en = root.lang === "en";
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    var label = dark
      ? en
        ? "Theme: dark. Switch to light"
        : "Tema: gelap. Ganti ke terang"
      : en
        ? "Theme: light. Switch to dark"
        : "Tema: terang. Ganti ke gelap";
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
  }

  document.addEventListener("DOMContentLoaded", function () {
    applyLanguage(root.lang === "en" ? "en" : "id");
    applyThemeLabel();

    document.getElementById("lang-toggle").addEventListener("click", function () {
      var next = root.lang === "en" ? "id" : "en";
      applyLanguage(next);
      applyThemeLabel();
      store("lhc-site-lang", next);
    });

    document.getElementById("theme-toggle").addEventListener("click", function () {
      var dark = !root.classList.contains("dark");
      root.classList.toggle("dark", dark);
      applyThemeLabel();
      store("lhc-site-theme", dark ? "dark" : "light");
    });
  });
})();
