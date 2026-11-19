// Katalog terjemahan modul camera (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const CAMERA_MESSAGES = {
  // --- Halaman tes (jendela utama) ---
  "camera.ui.title": { id: "Tes Kamera", en: "Camera Test" },
  "camera.ui.intro": {
    id: "Kamera dibuka di jendela tes terpisah selama paling lama 10 detik untuk menampilkan pratinjau. Tidak ada foto atau video yang disimpan atau dikirim.",
    en: "The camera opens in a separate test window for at most 10 seconds to show a preview. No photo or video is saved or sent.",
  },
  "camera.ui.step1": { id: "Jendela kecil \"Tes kamera\" akan terbuka.", en: "A small \"Camera test\" window will open." },
  "camera.ui.step2": {
    id: "macOS mungkin meminta izin kamera; pilih Izinkan untuk menguji (Jangan Izinkan = tes tidak bisa dilakukan).",
    en: "macOS may ask for camera permission; choose Allow to test (Don't Allow = the test cannot run).",
  },
  "camera.ui.step3": {
    id: "Lihat pratinjau dan lampu hijau kamera, lalu tekan \"Hentikan sekarang\" atau tunggu 10 detik.",
    en: "Look at the preview and the green camera light, then press \"Stop now\" or wait 10 seconds.",
  },
  "camera.ui.consent": {
    id: "Saya setuju kamera dinyalakan sebentar untuk tes ini.",
    en: "I agree to turn the camera on briefly for this test.",
  },
  "camera.ui.start": { id: "Mulai tes kamera", en: "Start camera test" },
  "camera.ui.cancel": { id: "Batal", en: "Cancel" },
  "camera.ui.waiting": {
    id: "Ikuti langkah di jendela \"Tes kamera\". Kamera mati otomatis paling lama setelah 10 detik.",
    en: "Follow the steps in the \"Camera test\" window. The camera turns off automatically after at most 10 seconds.",
  },
  "camera.ui.abort": { id: "Batalkan sesi", en: "Cancel session" },
  "camera.ui.questionImage": { id: "Bagaimana gambar di pratinjau?", en: "How did the preview image look?" },
  "camera.ui.questionLed": {
    id: "Apakah lampu hijau di samping kamera menyala selama tes?",
    en: "Did the green light next to the camera turn on during the test?",
  },
  "camera.ui.finish": { id: "Simpan hasil", en: "Save result" },
  "camera.ui.cameraOff": {
    id: "Kamera sudah dimatikan. Jawab pertanyaan berikut sesuai yang Anda lihat.",
    en: "The camera is off now. Answer the questions based on what you saw.",
  },
  "camera.ui.failedToOpen": { id: "Jendela tes tidak bisa dibuka: {error}", en: "The test window could not be opened: {error}" },

  // --- Jendela tes media ---
  "camera.window.previewLabel": { id: "Pratinjau kamera (tidak direkam)", en: "Camera preview (not recorded)" },

  // --- Jawaban ---
  "camera.answer.image.clear": { id: "Gambar tampil jelas.", en: "The image was clear." },
  "camera.answer.image.blurry": {
    id: "Gambar buram (bisa karena lensa kotor atau pencahayaan).",
    en: "The image was blurry (may be a dirty lens or lighting).",
  },
  "camera.answer.image.artifacts": { id: "Gambar bergaris, berbintik, atau warnanya rusak.", en: "The image had lines, spots, or broken colors." },
  "camera.answer.image.none": { id: "Tidak ada gambar yang tampil.", en: "No image appeared." },
  "camera.answer.led.on": { id: "Lampu indikator kamera menyala.", en: "The camera indicator light was on." },
  "camera.answer.led.off": {
    id: "Lampu indikator kamera tidak terlihat menyala — perlu diperiksa.",
    en: "The camera indicator light did not appear to turn on — needs checking.",
  },
  "camera.answer.led.notNoticed": { id: "Lampu indikator tidak diperhatikan.", en: "The indicator light was not noticed." },

  // --- Bukti terukur ---
  "camera.evidence.active": { id: "Kamera aktif: {size}, {fps} fps.", en: "Camera active: {size}, {fps} fps." },
  "camera.evidence.frames": { id: "{n} frame gambar diterima dari kamera.", en: "{n} image frames received from the camera." },
  "camera.evidence.noFrames": {
    id: "Kamera terbuka tetapi tidak mengirim frame gambar.",
    en: "The camera opened but sent no image frames.",
  },
  "camera.evidence.framesUnsupported": {
    id: "Penghitungan frame tidak didukung WebView; gunakan pengamatan Anda.",
    en: "Frame counting is not supported by the WebView; rely on your observation.",
  },
  "camera.evidence.shutdownOk": {
    id: "Kamera dimatikan setelah tes dan akses ditutup kembali.",
    en: "The camera was turned off after the test and access was closed again.",
  },
  "camera.evidence.shutdownProblem": {
    id: "Kamera atau gerbang izin tidak tertutup sempurna setelah tes.",
    en: "The camera or permission gate did not fully close after the test.",
  },
  "camera.evidence.notFound": { id: "macOS tidak menemukan kamera.", en: "macOS found no camera." },
  "camera.evidence.denied": {
    id: "Izin kamera ditolak. Bila ingin menguji: System Settings › Privacy & Security › Camera.",
    en: "Camera permission was denied. To test: System Settings › Privacy & Security › Camera.",
  },
  "camera.evidence.busy": {
    id: "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu ulangi.",
    en: "The camera is in use by another app. Close that app and try again.",
  },
  "camera.evidence.other": { id: "Kamera tidak bisa dibuka ({reason}).", en: "The camera could not be opened ({reason})." },

  // --- Ringkasan hasil ---
  "camera.result.passed": { id: "Kamera berfungsi.", en: "The camera works." },
  "camera.result.failed": { id: "Ada masalah pada kamera.", en: "There is a problem with the camera." },
  "camera.result.cancelled": { id: "Tes kamera dibatalkan.", en: "The camera test was cancelled." },
  "camera.result.notFound": { id: "Kamera tidak terdeteksi.", en: "No camera detected." },
  "camera.result.denied": { id: "Tes tidak dilakukan: izin kamera ditolak.", en: "Test not done: camera permission denied." },
  "camera.result.busy": { id: "Tes tidak dilakukan: kamera sedang dipakai.", en: "Test not done: the camera is in use." },
  "camera.result.other": { id: "Tes kamera tidak bisa dijalankan.", en: "The camera test could not run." },

  // --- Keterbatasan ---
  "camera.limit.noStorage": {
    id: "Pratinjau hanya ditampilkan; tidak ada foto/video yang disimpan atau dikirim.",
    en: "The preview is only displayed; no photo/video is saved or sent.",
  },
  "camera.limit.userConfirmed": {
    id: "Kualitas gambar dan lampu indikator dinilai dari pengamatan Anda.",
    en: "Image quality and the indicator light are judged by your observation.",
  },
  "camera.limit.permission": {
    id: "Bila izin macOS ditolak, tes tidak bisa dilakukan; itu bukan tanda kerusakan.",
    en: "If macOS permission is denied the test cannot run; that is not a sign of a fault.",
  },
} satisfies Record<string, Entry>;
