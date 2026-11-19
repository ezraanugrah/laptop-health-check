// Katalog terjemahan modul microphone (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const MICROPHONE_MESSAGES = {
  // --- Halaman tes (jendela utama) ---
  "microphone.ui.title": { id: "Tes Mikrofon", en: "Microphone Test" },
  "microphone.ui.intro": {
    id: "Mikrofon dibuka di jendela tes terpisah dan merekam suara Anda paling lama 5 detik. Rekaman hanya ada di memori, diputar ulang setelah mikrofon dimatikan, lalu dihapus saat jendela ditutup. Tidak ada yang disimpan ke disk atau dikirim.",
    en: "The microphone opens in a separate test window and records your voice for at most 5 seconds. The recording exists only in memory, is played back after the microphone is turned off, and is deleted when the window closes. Nothing is saved to disk or sent.",
  },
  "microphone.ui.step1": {
    id: "macOS mungkin meminta izin mikrofon; pilih Izinkan untuk menguji.",
    en: "macOS may ask for microphone permission; choose Allow to test.",
  },
  "microphone.ui.step2": {
    id: "Ucapkan beberapa kata dengan suara normal. Titik oranye di menu bar menandakan mikrofon aktif.",
    en: "Say a few words at a normal volume. The orange dot in the menu bar shows the microphone is active.",
  },
  "microphone.ui.step3": {
    id: "Setelah berhenti, putar rekaman di jendela tes lalu tekan Selesai.",
    en: "After it stops, play the recording in the test window and press Done.",
  },
  "microphone.ui.consent": {
    id: "Saya setuju mikrofon merekam sebentar untuk tes ini (hanya di memori).",
    en: "I agree to let the microphone record briefly for this test (memory only).",
  },
  "microphone.ui.start": { id: "Mulai tes mikrofon", en: "Start microphone test" },
  "microphone.ui.cancel": { id: "Batal", en: "Cancel" },
  "microphone.ui.waiting": {
    id: "Ikuti langkah di jendela \"Tes mikrofon\".",
    en: "Follow the steps in the \"Microphone test\" window.",
  },
  "microphone.ui.abort": { id: "Batalkan sesi", en: "Cancel session" },
  "microphone.ui.micOff": {
    id: "Mikrofon sudah dimatikan dan rekaman sudah dihapus. Jawab sesuai yang Anda dengar.",
    en: "The microphone is off and the recording has been deleted. Answer based on what you heard.",
  },
  "microphone.ui.questionPlayback": { id: "Bagaimana suara rekaman saat diputar?", en: "How did the recording sound when played?" },
  "microphone.ui.finish": { id: "Simpan hasil", en: "Save result" },
  "microphone.ui.failedToOpen": { id: "Jendela tes tidak bisa dibuka: {error}", en: "The test window could not be opened: {error}" },

  // --- Jendela tes media ---
  "microphone.window.level": { id: "Level suara", en: "Sound level" },
  "microphone.window.recording": { id: "Merekam (hanya di memori)…", en: "Recording (memory only)…" },
  "microphone.window.playbackTitle": {
    id: "Mikrofon sudah mati. Putar rekaman Anda:",
    en: "The microphone is off. Play your recording:",
  },
  "microphone.window.noRecording": {
    id: "Rekaman tidak tersedia di WebView ini. Tekan Selesai.",
    en: "Recording is not available in this WebView. Press Done.",
  },
  "microphone.window.done": { id: "Selesai (hapus rekaman)", en: "Done (delete recording)" },

  // --- Jawaban ---
  "microphone.answer.clear": { id: "Rekaman terdengar jelas.", en: "The recording sounded clear." },
  "microphone.answer.faint": { id: "Rekaman terdengar sangat pelan.", en: "The recording was very quiet." },
  "microphone.answer.noisy": { id: "Rekaman berdesis, pecah, atau terputus.", en: "The recording hissed, crackled, or cut out." },
  "microphone.answer.none": {
    id: "Rekaman tidak terdengar sama sekali (periksa juga speaker/volume).",
    en: "The recording was not audible at all (also check speakers/volume).",
  },
  "microphone.answer.couldNotPlay": { id: "Rekaman tidak bisa diputar.", en: "The recording could not be played." },

  // --- Bukti terukur ---
  "microphone.evidence.active": {
    id: "Mikrofon aktif: {rate} Hz, {channels} kanal.",
    en: "Microphone active: {rate} Hz, {channels} channel(s).",
  },
  "microphone.evidence.recorded": {
    id: "Rekaman sementara {s} dtk di memori (sudah dihapus).",
    en: "Temporary {s} s recording in memory (already deleted).",
  },
  "microphone.evidence.noRecorder": {
    id: "Perekam tidak tersedia di WebView; hanya level suara yang diukur.",
    en: "The recorder is not available in the WebView; only the sound level was measured.",
  },
  "microphone.evidence.peak": { id: "Level puncak {db} dBFS.", en: "Peak level {db} dBFS." },
  "microphone.evidence.peakQuiet": {
    id: "Level puncak {db} dBFS — sangat pelan (ambang belum dikalibrasi).",
    en: "Peak level {db} dBFS — very quiet (threshold not calibrated).",
  },
  "microphone.evidence.shutdownOk": {
    id: "Mikrofon dimatikan setelah tes dan akses ditutup kembali.",
    en: "The microphone was turned off after the test and access was closed again.",
  },
  "microphone.evidence.shutdownProblem": {
    id: "Mikrofon atau gerbang izin tidak tertutup sempurna setelah tes.",
    en: "The microphone or permission gate did not fully close after the test.",
  },
  "microphone.evidence.notFound": { id: "macOS tidak menemukan mikrofon.", en: "macOS found no microphone." },
  "microphone.evidence.denied": {
    id: "Izin mikrofon ditolak. Bila ingin menguji: System Settings › Privacy & Security › Microphone.",
    en: "Microphone permission was denied. To test: System Settings › Privacy & Security › Microphone.",
  },
  "microphone.evidence.busy": {
    id: "Mikrofon sedang dipakai aplikasi lain. Tutup aplikasi itu lalu ulangi.",
    en: "The microphone is in use by another app. Close that app and try again.",
  },
  "microphone.evidence.other": { id: "Mikrofon tidak bisa dibuka ({reason}).", en: "The microphone could not be opened ({reason})." },

  // --- Ringkasan hasil ---
  "microphone.result.passed": { id: "Mikrofon berfungsi.", en: "The microphone works." },
  "microphone.result.failed": { id: "Ada masalah pada mikrofon.", en: "There is a problem with the microphone." },
  "microphone.result.cancelled": { id: "Tes mikrofon dibatalkan.", en: "The microphone test was cancelled." },
  "microphone.result.notFound": { id: "Mikrofon tidak terdeteksi.", en: "No microphone detected." },
  "microphone.result.denied": { id: "Tes tidak dilakukan: izin mikrofon ditolak.", en: "Test not done: microphone permission denied." },
  "microphone.result.busy": { id: "Tes tidak dilakukan: mikrofon sedang dipakai.", en: "Test not done: the microphone is in use." },
  "microphone.result.other": { id: "Tes mikrofon tidak bisa dijalankan.", en: "The microphone test could not run." },

  // --- Keterbatasan ---
  "microphone.limit.memoryOnly": {
    id: "Rekaman hanya di memori selama sesi dan dihapus saat jendela tes ditutup; tidak pernah disimpan ke disk atau dikirim.",
    en: "The recording stays in memory during the session and is deleted when the test window closes; it is never saved to disk or sent.",
  },
  "microphone.limit.userConfirmed": {
    id: "Kejelasan suara dinilai dari pendengaran Anda.",
    en: "Sound clarity is judged by your hearing.",
  },
  "microphone.limit.levelExperimental": {
    id: "Level suara hanya informasi; ambangnya belum dikalibrasi di Mac asli.",
    en: "The sound level is informational only; its threshold is not calibrated on real Macs.",
  },
  "microphone.limit.permission": {
    id: "Bila izin macOS ditolak, tes tidak bisa dilakukan; itu bukan tanda kerusakan.",
    en: "If macOS permission is denied the test cannot run; that is not a sign of a fault.",
  },
} satisfies Record<string, Entry>;
