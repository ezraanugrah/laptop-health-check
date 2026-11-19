// Katalog terjemahan modul speaker (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const SPEAKER_MESSAGES = {
  // --- Tes Speaker (T5) --------------------------------------------------------------------------
  "speaker.title": { id: "Tes Speaker", en: "Speaker Test" },
  "speaker.intro": {
    id: "Putar nada uji singkat (±2 detik) di kiri, kanan, lalu keduanya, dan jawab apa yang Anda dengar. Tidak ada suara sebelum Anda menekan Putar.",
    en: "Play a short test tone (about 2 seconds) on the left, the right, then both, and answer what you hear. No sound plays until you press Play.",
  },
  "speaker.hintsTitle": { id: "Sebelum mulai", en: "Before you start" },
  "speaker.cancel": { id: "Batal", en: "Cancel" },
  "speaker.finish": { id: "Selesai", en: "Finish" },
  "speaker.play": { id: "Putar", en: "Play" },
  "speaker.stop": { id: "Hentikan", en: "Stop" },
  "speaker.repeat": { id: "Ulangi", en: "Repeat" },
  "speaker.playing": { id: "Memutar nada uji…", en: "Playing the test tone…" },
  "speaker.question": { id: "Bagaimana suaranya?", en: "How did it sound?" },
  "speaker.playFirst": { id: "Putar nada dulu sebelum menjawab.", en: "Play the tone before answering." },
  "speaker.progress": { id: "{answered} / {total} kanal dijawab", en: "{answered} / {total} channels answered" },
  "speaker.answerAll": {
    id: "Jawab ketiga kanal untuk menyelesaikan tes, atau tekan Batal.",
    en: "Answer all three channels to finish the test, or press Cancel.",
  },
  "speaker.audioInfo": {
    id: "Jalur keluaran audio aktif: {sampleRate} Hz, {channels} kanal. Ini membuktikan jalur keluaran, bukan speakernya.",
    en: "Audio output path active: {sampleRate} Hz, {channels} channel(s). This proves the output path, not the speakers.",
  },
  "speaker.monoWarning": {
    id: "Keluaran audio hanya {channels} kanal: kiri dan kanan tidak bisa dibedakan.",
    en: "The audio output has only {channels} channel(s): left and right cannot be told apart.",
  },
  "speaker.notBuiltInWarning": {
    id: "Keluaran audio default saat ini bukan speaker internal. Pindahkan keluaran ke speaker internal sendiri (Control Center › Suara) sebelum menjawab.",
    en: "The current default audio output is not the built-in speakers. Switch the output to the built-in speakers yourself (Control Center › Sound) before answering.",
  },
  "speaker.audioFailed": { id: "Nada uji tidak bisa diputar: {error}", en: "The test tone could not be played: {error}" },
  "speaker.noWebAudio": { id: "Web Audio tidak tersedia di lingkungan ini.", en: "Web Audio is not available in this environment." },
  "speaker.saveUnavailable": { id: "Simpan sebagai Tidak tersedia", en: "Save as Unavailable" },

  "speaker.channel.left": { id: "Kiri", en: "Left" },
  "speaker.channel.right": { id: "Kanan", en: "Right" },
  "speaker.channel.stereo": { id: "Stereo (keduanya)", en: "Stereo (both)" },
  "speaker.channelHint.left": { id: "Suara harus terdengar hanya dari speaker kiri.", en: "Sound should come only from the left speaker." },
  "speaker.channelHint.right": { id: "Suara harus terdengar hanya dari speaker kanan.", en: "Sound should come only from the right speaker." },
  "speaker.channelHint.stereo": {
    id: "Suara harus terdengar seimbang dari kedua speaker.",
    en: "Sound should come evenly from both speakers.",
  },
  "speaker.answer.clear": { id: "Jelas", en: "Clear" },
  "speaker.answer.distorted": { id: "Pecah atau berdesis", en: "Distorted or hissing" },
  "speaker.answer.silent": { id: "Tidak terdengar", en: "Not audible" },
  "speaker.answer.wrongSide": { id: "Terdengar di sisi yang salah", en: "Heard on the wrong side" },

  "speakerHint.headphones": {
    id: "Cabut headphone dan putuskan audio Bluetooth/AirPods agar suara keluar dari speaker internal.",
    en: "Unplug headphones and disconnect Bluetooth audio/AirPods so sound comes from the built-in speakers.",
  },
  "speakerHint.volume": {
    id: "Pastikan volume tidak dibisukan. Mulai dari volume rendah, lalu naikkan perlahan bila perlu.",
    en: "Make sure the volume is not muted. Start with a low volume and raise it slowly if needed.",
  },
  "speakerHint.noChange": {
    id: "Aplikasi tidak membaca atau mengubah volume; nada diputar dengan level rendah yang tetap.",
    en: "The app does not read or change the volume; the tone plays at a fixed low level.",
  },
  "speakerHint.balance": {
    id: "Bila kiri/kanan tertukar atau terdengar sama, periksa Balance di System Settings › Suara dan opsi audio mono di Aksesibilitas › Audio.",
    en: "If left/right are swapped or sound the same, check Balance in System Settings › Sound and the mono audio option in Accessibility › Audio.",
  },

  "speakerResult.audioPath": {
    id: "Web Audio berjalan: {sampleRate} Hz, {channels} kanal keluaran (membuktikan jalur keluaran audio, bukan speakernya).",
    en: "Web Audio ran: {sampleRate} Hz, {channels} output channel(s) (proves the audio output path, not the speakers).",
  },
  "speakerResult.mono": {
    id: "Keluaran audio hanya {channels} kanal; kiri/kanan tidak bisa dipisahkan.",
    en: "The audio output has only {channels} channel(s); left/right cannot be separated.",
  },
  "speakerResult.builtIn": { id: "Keluaran audio default adalah speaker internal.", en: "The default audio output is the built-in speakers." },
  "speakerResult.notBuiltIn": {
    id: "Keluaran audio default bukan speaker internal; jawaban mungkin tidak mencerminkan speaker internal.",
    en: "The default audio output is not the built-in speakers; the answers may not reflect the built-in speakers.",
  },
  "speakerResult.clear": { id: "{channel}: terdengar jelas.", en: "{channel}: heard clearly." },
  "speakerResult.distorted": { id: "{channel}: pecah atau berdesis.", en: "{channel}: distorted or hissing." },
  "speakerResult.silent": { id: "{channel}: tidak terdengar.", en: "{channel}: not audible." },
  "speakerResult.wrongSide": { id: "{channel}: terdengar di sisi yang salah.", en: "{channel}: heard on the wrong side." },
  "speakerResult.audioFailed": {
    id: "Nada uji tidak bisa diputar (Web Audio tidak tersedia atau gagal dimulai).",
    en: "The test tone could not be played (Web Audio unavailable or failed to start).",
  },
  "speakerResult.passed": { id: "Kiri, kanan, dan stereo terdengar jelas.", en: "Left, right, and stereo were heard clearly." },
  "speakerResult.failed": { id: "Masalah suara dilaporkan pada: {channels}.", en: "Sound problems reported on: {channels}." },
  "speakerResult.cancelled": {
    id: "Tes belum selesai: {answered} dari {total} kanal dijawab.",
    en: "Test not finished: {answered} of {total} channels answered.",
  },
  "speakerResult.unavailable": {
    id: "Tes speaker tidak bisa dijalankan di lingkungan ini.",
    en: "The speaker test cannot run in this environment.",
  },

  "speakerLimit.userConfirmed": {
    id: "Kualitas suara dinilai dari pendengaran Anda; aplikasi tidak mengukur speaker secara langsung.",
    en: "Sound quality is judged by your hearing; the app does not measure the speakers directly.",
  },
  "speakerLimit.outputPath": {
    id: "Web Audio yang berjalan hanya membuktikan jalur keluaran audio, bukan bahwa suara keluar dari speaker internal.",
    en: "Web Audio running only proves the audio output path, not that sound came from the built-in speakers.",
  },
  "speakerLimit.volume": { id: "Volume dan mute tidak dibaca atau diubah aplikasi.", en: "Volume and mute are not read or changed by the app." },
  "speakerLimit.drivers": {
    id: "Driver speaker individual (woofer/tweeter) tidak diuji terpisah.",
    en: "Individual speaker drivers (woofer/tweeter) are not tested separately.",
  },
  "speakerLimit.settings": {
    id: "Balance dan audio mono di pengaturan macOS memengaruhi kiri/kanan.",
    en: "Balance and mono audio in macOS settings affect left/right.",
  },
} satisfies Record<string, Entry>;
