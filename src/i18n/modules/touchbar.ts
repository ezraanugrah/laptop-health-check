// Katalog terjemahan modul touchbar (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const TOUCHBAR_MESSAGES = {
  // --- Tes Touch Bar (overlay) ----------------------------------------------
  "touchBar.title": { id: "Tes Touch Bar", en: "Touch Bar Test" },
  "touchBar.intro": {
    id: "Tes ini memasang tombol uji sementara di Touch Bar, lalu memeriksa F1–F12 dan tampilan Touch Bar. Pengaturan sistem tidak diubah, dan tombol uji dilepas saat tes ditutup.",
    en: "This test places temporary test buttons on the Touch Bar, then checks F1–F12 and the Touch Bar display. No system settings are changed, and the test buttons are removed when the test closes.",
  },
  "touchBar.step": { id: "Langkah {n} dari {total}", en: "Step {n} of {total}" },
  "touchBar.start": { id: "Mulai", en: "Start" },
  "touchBar.exit": { id: "Keluar", en: "Exit" },
  "touchBar.next": { id: "Lanjut", en: "Next" },
  "touchBar.save": { id: "Simpan hasil", en: "Save result" },
  "touchBar.legend": {
    id: "Hijau = ketukan atau tombol diterima aplikasi (terukur).",
    en: "Green = tap or key received by the app (measured).",
  },
  "touchBar.presence.present": {
    id: "Hardware Touch Bar terdeteksi oleh macOS.",
    en: "Touch Bar hardware detected by macOS.",
  },
  "touchBar.presence.unknown": {
    id: "Keberadaan Touch Bar belum bisa dipastikan. Lanjutkan hanya bila Mac ini punya Touch Bar.",
    en: "The Touch Bar's presence could not be confirmed. Continue only if this Mac has a Touch Bar.",
  },
  "touchBar.presence.absent": { id: "Mac ini tidak punya Touch Bar.", en: "This Mac has no Touch Bar." },
  "touchBar.presence.absentDetail": {
    id: "macOS tidak menemukan hardware Touch Bar, jadi tidak ada yang dipasang. Hasil dicatat sebagai Tidak tersedia.",
    en: "macOS found no Touch Bar hardware, so nothing was installed. The result is recorded as Unavailable.",
  },

  // Bagian 1 — area sentuh
  "touchBar.segments.title": { id: "Bagian 1 — Area sentuh", en: "Part 1 — Touch area" },
  "touchBar.segments.instruction": {
    id: "Sentuh setiap tombol bernomor 1–{total} di Touch Bar. Kotak di bawah berubah hijau saat ketukan diterima.",
    en: "Touch each numbered button 1–{total} on the Touch Bar. The boxes below turn green when a tap is received.",
  },
  "touchBar.segments.progress": { id: "{tapped} dari {total} segmen tersentuh", en: "{tapped} of {total} segments touched" },
  "touchBar.segments.tapCount": { id: "Segmen {n}: {count}× disentuh", en: "Segment {n}: touched {count}×" },
  "touchBar.segments.starting": { id: "Memasang tombol uji…", en: "Installing test buttons…" },
  "touchBar.segments.startFailed": {
    id: "Tombol uji tidak bisa dipasang: {error}",
    en: "Test buttons could not be installed: {error}",
  },
  "touchBar.segments.browser": {
    id: "Tombol uji hanya tersedia di aplikasi desktop.",
    en: "Test buttons are only available in the desktop app.",
  },
  "touchBar.segments.macosVisible": {
    id: "macOS melaporkan tombol uji sedang tampil di Touch Bar (eksperimental).",
    en: "macOS reports the test buttons are showing on the Touch Bar (experimental).",
  },
  "touchBar.segments.macosHidden": {
    id: "macOS melaporkan tombol uji belum tampil di Touch Bar (eksperimental).",
    en: "macOS reports the test buttons are not showing on the Touch Bar yet (experimental).",
  },
  "touchBar.segments.noTapHint": {
    id: "Belum ada ketukan. Pastikan jendela aplikasi ini aktif. Bila Touch Bar menampilkan F1–F12 atau Control Strip yang diperluas, periksa sendiri pengaturan \"Touch Bar menampilkan\" di Pengaturan Sistem › Keyboard (aplikasi tidak mengubahnya).",
    en: "No taps yet. Make sure this app's window is active. If the Touch Bar shows F1–F12 or the expanded Control Strip, check the \"Touch Bar shows\" setting yourself in System Settings › Keyboard (the app does not change it).",
  },
  "touchBar.segments.notShown": {
    id: "Touch Bar tidak menampilkan tombol uji",
    en: "The Touch Bar does not show the test buttons",
  },
  "touchBar.segments.remaining": { id: "Segmen belum tersentuh: {segments}.", en: "Segments not touched yet: {segments}." },
  "touchBar.segments.markBroken": {
    id: "Tombol uji tampil, tetapi segmen ini tidak merespons",
    en: "Test buttons show, but these segments do not respond",
  },
  "touchBar.segments.skip": { id: "Lewati (belum dicoba)", en: "Skip (not tried)" },
  "touchBar.segments.continue": { id: "Lanjutkan menyentuh", en: "Keep touching" },

  // Bagian 2 — tombol F
  "touchBar.fn.title": { id: "Bagian 2 — Tombol F1–F12", en: "Part 2 — F1–F12 keys" },
  "touchBar.fn.instruction": {
    id: "Tahan fn, lalu sentuh F1 sampai F12 di Touch Bar satu per satu.",
    en: "Hold fn, then touch F1 through F12 on the Touch Bar one by one.",
  },
  "touchBar.fn.progress": { id: "{received} dari {total} tombol F diterima", en: "{received} of {total} F keys received" },
  "touchBar.fn.hint": {
    id: "F11 dapat memicu Tampilkan Desktop; sentuh F11 sekali lagi untuk kembali. Tombol yang ditangkap macOS tidak dianggap rusak.",
    en: "F11 may trigger Show Desktop; touch F11 again to return. Keys captured by macOS are not treated as broken.",
  },
  "touchBar.fn.escReceived": { id: "Esc diterima.", en: "Esc received." },
  "touchBar.fn.unfocused": {
    id: "Jendela aplikasi tidak aktif. Klik di jendela ini agar tombol F diterima.",
    en: "The app window is not active. Click in this window so F keys are received.",
  },

  // Bagian 3 — tampilan & cahaya
  "touchBar.display.title": { id: "Bagian 3 — Tampilan & cahaya", en: "Part 3 — Display & lighting" },
  "touchBar.display.instruction": {
    id: "Amati Touch Bar (tombol uji masih terpasang; tahan fn untuk melihat F1–F12) lalu jawab setiap pertanyaan.",
    en: "Look at the Touch Bar (the test buttons are still installed; hold fn to see F1–F12), then answer each question.",
  },
  "touchBar.display.userConfirmed": {
    id: "Jawaban di bagian ini dicatat sebagai \"dikonfirmasi pengguna\", bukan hasil pengukuran.",
    en: "Answers in this part are recorded as \"user-confirmed\", not as measurements.",
  },
  "touchBar.display.answerAll": {
    id: "Jawab ketiga pertanyaan untuk menyimpan.",
    en: "Answer all three questions to save.",
  },
  "touchBarCheck.evenLit": {
    id: "Semua segmen terlihat jelas dan menyala merata?",
    en: "Are all segments clearly visible and evenly lit?",
  },
  "touchBarCheck.noDeadArea": {
    id: "Bebas dari area mati, bergaris, atau berkedip?",
    en: "Free of dead, striped, or flickering areas?",
  },
  "touchBarCheck.fullWidth": {
    id: "Seluruh lebar Touch Bar merespons sentuhan, termasuk ujung kiri dan kanan?",
    en: "Does the whole width of the Touch Bar respond to touch, including the far left and right?",
  },
  "touchBarCheck.answer.ok": { id: "Ya", en: "Yes" },
  "touchBarCheck.answer.problem": { id: "Tidak, ada masalah", en: "No, there is a problem" },
  "touchBarCheck.answer.notChecked": { id: "Tidak dicek", en: "Not checked" },

  // --- Hasil Tes Touch Bar ------------------------------------------------------
  "touchBarResult.passed": { id: "Tidak ditemukan masalah pada Touch Bar.", en: "No Touch Bar problems found." },
  "touchBarResult.failed": { id: "Ditemukan {n} masalah pada Touch Bar.", en: "{n} Touch Bar problem(s) found." },
  "touchBarResult.noEvidence": {
    id: "Belum ada bukti yang cukup untuk menilai Touch Bar.",
    en: "Not enough evidence to assess the Touch Bar.",
  },
  "touchBarResult.noTouchBar": { id: "Mac ini tidak punya Touch Bar.", en: "This Mac has no Touch Bar." },
  "touchBarResult.cancelled": {
    id: "Tes dihentikan sebelum selesai ({tapped}/{total} segmen, {received}/{fnTotal} tombol F).",
    en: "Test stopped before finishing ({tapped}/{total} segments, {received}/{fnTotal} F keys).",
  },
  "touchBarResult.presenceDetected": {
    id: "Hardware Touch Bar terdeteksi oleh macOS.",
    en: "Touch Bar hardware detected by macOS.",
  },
  "touchBarResult.presenceUnknown": {
    id: "Keberadaan hardware Touch Bar tidak dapat dipastikan.",
    en: "The presence of Touch Bar hardware could not be confirmed.",
  },
  "touchBarResult.presenceAbsent": {
    id: "macOS tidak menemukan hardware Touch Bar.",
    en: "macOS found no Touch Bar hardware.",
  },
  "touchBarResult.nativeUnavailable": {
    id: "Tombol uji tidak bisa dipasang; area sentuh tidak diukur (keterbatasan aplikasi, bukan kerusakan).",
    en: "Test buttons could not be installed; the touch area was not measured (app limitation, not a defect).",
  },
  "touchBarResult.barNotShown": {
    id: "Touch Bar tidak menampilkan tombol uji; area sentuh tidak diukur (keterbatasan API macOS, bukan kerusakan).",
    en: "The Touch Bar did not show the test buttons; the touch area was not measured (macOS API limitation, not a defect).",
  },
  "touchBarResult.segmentsTapped": {
    id: "{tapped} dari {total} segmen sentuh merespons.",
    en: "{tapped} of {total} touch segments responded.",
  },
  "touchBarResult.segmentsNoResponse": {
    id: "Tombol uji tampil, tetapi segmen tidak merespons: {segments}.",
    en: "Test buttons showed, but segments did not respond: {segments}.",
  },
  "touchBarResult.macosVisible": {
    id: "macOS melaporkan tombol uji tampil di Touch Bar.",
    en: "macOS reported the test buttons showing on the Touch Bar.",
  },
  "touchBarResult.macosHidden": {
    id: "macOS melaporkan tombol uji tidak tampil di Touch Bar.",
    en: "macOS reported the test buttons not showing on the Touch Bar.",
  },
  "touchBarResult.fnReceived": {
    id: "{received} dari {total} tombol F (F1–F12) diterima aplikasi.",
    en: "{received} of {total} F keys (F1–F12) received by the app.",
  },
  "touchBarResult.fnMissing": {
    id: "Tidak sampai ke aplikasi (bisa karena pintasan macOS, bukan kerusakan): {keys}.",
    en: "Did not reach the app (possibly a macOS shortcut, not a defect): {keys}.",
  },
  "touchBarResult.escReceived": { id: "Esc diterima aplikasi.", en: "Esc received by the app." },
  "touchBarResult.evenLitOk": {
    id: "Segmen terlihat jelas dan menyala merata.",
    en: "Segments are clearly visible and evenly lit.",
  },
  "touchBarResult.evenLitProblem": {
    id: "Dilaporkan: cahaya tidak merata atau redup di sebagian area.",
    en: "Reported: uneven or dim lighting in some areas.",
  },
  "touchBarResult.noDeadAreaOk": {
    id: "Tidak ada area mati, bergaris, atau berkedip.",
    en: "No dead, striped, or flickering areas.",
  },
  "touchBarResult.deadAreaProblem": {
    id: "Dilaporkan: ada area mati, bergaris, atau berkedip.",
    en: "Reported: dead, striped, or flickering areas.",
  },
  "touchBarResult.fullWidthOk": { id: "Seluruh lebar merespons sentuhan.", en: "The whole width responds to touch." },
  "touchBarResult.fullWidthProblem": {
    id: "Dilaporkan: sebagian area tidak merespons sentuhan.",
    en: "Reported: some areas do not respond to touch.",
  },
  "touchBarResult.problemUnconfirmed": {
    id: "Laporan masalah belum dinilai kritis karena tampilan Touch Bar belum terkonfirmasi (tidak ada ketukan maupun tombol F yang diterima).",
    en: "Reported problems were not rated critical because the Touch Bar display was not confirmed (no taps or F keys were received).",
  },

  // --- Keterbatasan Tes Touch Bar ----------------------------------------------
  "touchBarLimit.nativeBar": {
    id: "Tombol uji dipasang lewat API publik macOS (NSTouchBar) hanya selama tes terbuka. Bila tidak tampil, itu keterbatasan API, bukan kerusakan.",
    en: "Test buttons are installed through the public macOS API (NSTouchBar) only while the test is open. If they do not show, that is an API limitation, not a defect.",
  },
  "touchBarLimit.appControls": {
    id: "Tombol uji hanya tampil bila pengaturan \"Touch Bar menampilkan\" berisi Kontrol App dan jendela aplikasi aktif. Aplikasi tidak mengubah pengaturan ini.",
    en: "Test buttons only show when the \"Touch Bar shows\" setting includes App Controls and the app window is active. The app does not change this setting.",
  },
  "touchBarLimit.fnKeys": {
    id: "Sebagian F1–F12 bisa ditangkap macOS (mis. Tampilkan Desktop) sehingga tidak sampai ke aplikasi.",
    en: "Some of F1–F12 may be captured by macOS (e.g. Show Desktop) and never reach the app.",
  },
  "touchBarLimit.userJudged": {
    id: "Kerataan cahaya, area mati, dan kedipan dinilai pengguna; aplikasi tidak bisa mengukurnya.",
    en: "Even lighting, dead areas, and flicker are judged by the user; the app cannot measure them.",
  },
  "touchBarLimit.grid": {
    id: "Area sentuh diukur per tombol uji; celah sempit di antara tombol tidak terdeteksi otomatis.",
    en: "The touch area is measured per test button; narrow gaps between buttons are not detected automatically.",
  },
  "touchBarLimit.touchId": {
    id: "Touch ID dan tombol Esc fisik (pada model tertentu) bukan bagian dari tes ini.",
    en: "Touch ID and the physical Esc key (on some models) are not part of this test.",
  },
  "touchBarLimit.presence": {
    id: "Keberadaan Touch Bar dibaca dari macOS (IORegistry dan TouchBarServer), tidak pernah ditebak dari nama model.",
    en: "The Touch Bar's presence is read from macOS (IORegistry and TouchBarServer), never guessed from the model name.",
  },
  "touchBarLimit.privacy": {
    id: "Hanya kode tombol F1–F12 dan Esc yang dicatat selama Bagian 2; teks yang diketik tidak pernah dicatat.",
    en: "Only the F1–F12 and Esc key codes are recorded during Part 2; typed text is never recorded.",
  },
} satisfies Record<string, Entry>;
