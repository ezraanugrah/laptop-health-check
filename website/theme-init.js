// Terapkan tema & bahasa tersimpan sebelum halaman tampil (hindari kedip).
// Preferensi hanya di browser pengunjung (localStorage); tidak ada cookie atau server.
(function () {
  var root = document.documentElement;
  var theme = null;
  var lang = null;
  try {
    theme = localStorage.getItem("lhc-site-theme");
    lang = localStorage.getItem("lhc-site-lang");
  } catch (e) {
    /* penyimpanan diblokir: pakai default */
  }
  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  root.classList.toggle("dark", theme === "dark");
  if (lang === "en" || lang === "id") root.lang = lang;
})();
