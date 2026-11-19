// Katalog terjemahan modul report (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const REPORT_MESSAGES = {
  // --- Dokumen laporan (JSON & PDF) ---
  "report.doc.title": { id: "Laporan Pemeriksaan Laptop Health Check", en: "Laptop Health Check Inspection Report" },
  "report.doc.generatedAt": { id: "Dibuat", en: "Generated" },
  "report.doc.app": { id: "Aplikasi", en: "Application" },
  "report.doc.language": { id: "Bahasa", en: "Language" },
  "report.doc.support": { id: "Status dukungan platform", en: "Platform support status" },
  "report.doc.device": { id: "Ringkasan perangkat", en: "Device summary" },
  "report.doc.serial": { id: "Nomor seri", en: "Serial number" },
  "report.doc.serialHidden": { id: "Disembunyikan", en: "Hidden" },
  "report.doc.hardware": { id: "Hasil hardware", en: "Hardware result" },
  "report.doc.checkedAt": { id: "Pemeriksaan otomatis dijalankan", en: "Automatic checks run" },
  "report.doc.checks": { id: "Pemeriksaan otomatis", en: "Automatic checks" },
  "report.doc.interactive": { id: "Tes interaktif", en: "Interactive tests" },
  "report.doc.limitations": { id: "Keterbatasan", en: "Limitations" },
  "report.doc.notes": { id: "Catatan", en: "Notes" },
  "report.doc.experimental": { id: "eksperimental", en: "experimental" },
  "report.doc.finishedAt": { id: "Selesai", en: "Finished" },
  "report.doc.notRunYet": { id: "Belum dijalankan.", en: "Not run yet." },
  "report.doc.page": { id: "Halaman dibuat oleh aplikasi secara offline.", en: "Generated offline by the application." },

  "report.note.noDiagnostics": {
    id: "Pemeriksaan otomatis belum dijalankan saat laporan dibuat.",
    en: "Automatic checks had not been run when this report was created.",
  },
  "report.note.indicative": {
    id: "Hasil bersifat indikasi dan bukan pengganti Apple Diagnostics atau pemeriksaan teknisi resmi.",
    en: "Results are indicative and do not replace Apple Diagnostics or an authorized technician.",
  },
  "report.note.userConfirmed": {
    id: "Hasil bertanda \"dikonfirmasi pengguna\" berasal dari pengamatan pengguna, bukan pengukuran. Tes yang belum dijalankan atau belum tersedia tidak dihitung lulus.",
    en: "Results marked \"user-confirmed\" come from the user's observation, not measurement. Tests not run or not yet available are never counted as passed.",
  },
  "report.note.offline": {
    id: "Laporan dibuat sepenuhnya offline; tidak ada data yang dikirim ke internet.",
    en: "This report was created fully offline; no data was sent to the internet.",
  },
  "report.note.serialHidden": {
    id: "Nomor seri tidak disertakan (default).",
    en: "Serial number not included (default).",
  },
  "report.note.serialIncluded": {
    id: "Nomor seri disertakan atas pilihan pengguna.",
    en: "Serial number included at the user's choice.",
  },

  // --- Halaman Laporan ---
  "report.page.subtitle": {
    id: "Gabungan pemeriksaan otomatis dan tes interaktif. Ekspor ke JSON atau PDF; Anda yang memilih lokasi penyimpanan.",
    en: "Automatic checks and interactive tests combined. Export to JSON or PDF; you choose where to save.",
  },
  "report.page.runChecks": { id: "Jalankan pemeriksaan otomatis", en: "Run automatic checks" },
  "report.page.running": { id: "Memeriksa…", en: "Checking…" },
  "report.page.noDiagnostics": {
    id: "Pemeriksaan otomatis belum dijalankan. Laporan tetap bisa dibuat, tetapi bagian hardware akan kosong.",
    en: "Automatic checks have not been run. You can still create a report, but the hardware section will be empty.",
  },
  "report.page.includeSerial": { id: "Sertakan nomor seri", en: "Include serial number" },
  "report.page.includeSerialHint": {
    id: "Default tidak disertakan. Hanya dibaca saat Anda mencentang ini.",
    en: "Not included by default. Read only when you tick this.",
  },
  "report.page.serialUnavailable": { id: "Nomor seri tidak terbaca.", en: "Serial number could not be read." },
  "report.page.exportJson": { id: "Ekspor JSON", en: "Export JSON" },
  "report.page.exportPdf": { id: "Ekspor PDF", en: "Export PDF" },
  "report.page.pdfHint": {
    id: "PDF memakai dialog cetak macOS: pilih \"PDF\" › \"Simpan sebagai PDF\", lalu pilih lokasi.",
    en: "PDF uses the macOS print dialog: choose \"PDF\" › \"Save as PDF\", then pick a location.",
  },
  "report.page.saved": { id: "Laporan JSON tersimpan.", en: "JSON report saved." },
  "report.page.cancelled": { id: "Penyimpanan dibatalkan.", en: "Saving cancelled." },
  "report.page.failed": { id: "Gagal: {error}", en: "Failed: {error}" },
  "report.page.browserMode": {
    id: "Mode browser (pratinjau): ekspor hanya tersedia di aplikasi desktop.",
    en: "Browser mode (preview): export is only available in the desktop app.",
  },
  "report.page.preview": { id: "Pratinjau laporan", en: "Report preview" },
} satisfies Record<string, Entry>;
