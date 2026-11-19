// Katalog terjemahan modul trackpad (id + en berdampingan). Digabung ke UI_MESSAGES di ../ui.ts.
import type { Entry } from "../types.ts";

export const TRACKPAD_MESSAGES = {
  // --- Tes Trackpad (T4) -------------------------------------------------------------------------
  "trackpad.title": { id: "Tes Trackpad", en: "Trackpad Test" },
  "trackpad.intro": {
    id: "Lakukan setiap gerakan di area uji. Fungsi berubah menjadi “Terdeteksi” saat event-nya diterima. Hanya sel kisi yang dilewati dan jenis event yang dicatat, bukan riwayat posisi kursor.",
    en: "Perform each gesture in the test area. A function changes to “Detected” when its event is received. Only visited grid cells and event types are recorded, never a history of cursor positions.",
  },
  "trackpad.mouseNote": {
    id: "Cabut mouse eksternal agar semua event berasal dari trackpad. Aplikasi tidak mengubah pengaturan trackpad.",
    en: "Disconnect any external mouse so all events come from the trackpad. The app does not change trackpad settings.",
  },
  "trackpad.finish": { id: "Selesai", en: "Finish" },
  "trackpad.repeat": { id: "Ulangi", en: "Repeat" },
  "trackpad.cancel": { id: "Batal", en: "Cancel" },
  "trackpad.progress": { id: "{done} / {total} fungsi wajib terdeteksi", en: "{done} / {total} required functions detected" },
  "trackpad.padLabel": { id: "Area uji trackpad", en: "Trackpad test area" },
  "trackpad.padInstructions": {
    id: "Gerakkan kursor ke seluruh kotak, klik, klik dua kali, klik dua jari, gulir dua jari ke atas/bawah dan kiri/kanan, cubit, lalu tekan kuat (Force Click) di area ini.",
    en: "Move the cursor over every box, click, double-click, two-finger click, two-finger scroll up/down and left/right, pinch, then press firmly (Force Click) in this area.",
  },
  "trackpad.dragLabel": { id: "Jalur seret dan lepas", en: "Drag-and-drop track" },
  "trackpad.dragInstructions": {
    id: "Tekan dan tahan kotak biru, seret ke zona “Lepas di sini”, lalu lepaskan.",
    en: "Press and hold the blue box, drag it to the “Drop here” zone, then release.",
  },
  "trackpad.dragToken": { id: "Seret aku", en: "Drag me" },
  "trackpad.dropZone": { id: "Lepas di sini", en: "Drop here" },
  "trackpad.functions": { id: "Fungsi yang diuji", en: "Functions tested" },
  "trackpad.coverage": { id: "{covered} / {total} sel kisi dilewati (minimal {min})", en: "{covered} / {total} grid cells visited (at least {min})" },
  "trackpad.optional": { id: "opsional", en: "optional" },
  "trackpad.markNotDetected": { id: "Sudah dicoba, tidak terdeteksi", en: "Tried, not detected" },
  "trackpad.status.waiting": { id: "Menunggu", en: "Waiting" },
  "trackpad.status.detected": { id: "Terdeteksi", en: "Detected" },
  "trackpad.status.unsupported": { id: "Tidak didukung WebView", en: "Not supported by WebView" },
  "trackpad.status.notDetected": { id: "Tidak terdeteksi oleh WebView", en: "Not detected by WebView" },

  "trackpad.item.move": { id: "Gerak kursor", en: "Cursor movement" },
  "trackpad.item.primaryClick": { id: "Klik primer", en: "Primary click" },
  "trackpad.item.secondaryClick": { id: "Klik sekunder", en: "Secondary click" },
  "trackpad.item.doubleClick": { id: "Klik dua kali", en: "Double click" },
  "trackpad.item.scrollVertical": { id: "Gulir vertikal", en: "Vertical scroll" },
  "trackpad.item.scrollHorizontal": { id: "Gulir horizontal", en: "Horizontal scroll" },
  "trackpad.item.drag": { id: "Seret dan lepas", en: "Drag and drop" },
  "trackpad.item.pinch": { id: "Cubit/zoom", en: "Pinch/zoom" },
  "trackpad.item.forceClick": { id: "Force Click", en: "Force Click" },
  "trackpad.item.clickFeel": { id: "rasa klik/permukaan", en: "click feel/surface" },
  "trackpad.hint.move": {
    id: "Gerakkan kursor sampai hampir semua kotak kisi berwarna hijau.",
    en: "Move the cursor until almost every grid box turns green.",
  },
  "trackpad.hint.primaryClick": { id: "Klik atau ketuk sekali di area uji.", en: "Click or tap once in the test area." },
  "trackpad.hint.secondaryClick": {
    id: "Klik dengan dua jari (bukan Control+klik).",
    en: "Click with two fingers (not Control-click).",
  },
  "trackpad.hint.doubleClick": { id: "Klik dua kali dengan cepat.", en: "Click twice quickly." },
  "trackpad.hint.scrollVertical": { id: "Geser dua jari ke atas/bawah.", en: "Swipe two fingers up/down." },
  "trackpad.hint.scrollHorizontal": { id: "Geser dua jari ke kiri/kanan.", en: "Swipe two fingers left/right." },
  "trackpad.hint.drag": { id: "Seret kotak biru ke zona lepas.", en: "Drag the blue box to the drop zone." },
  "trackpad.hint.pinch": {
    id: "Cubit dua jari (rapatkan/renggangkan) di area uji.",
    en: "Pinch two fingers (together/apart) in the test area.",
  },
  "trackpad.hint.forceClick": {
    id: "Klik, lalu tekan lebih kuat sampai terasa klik kedua.",
    en: "Click, then press harder until you feel a second click.",
  },
  "trackpad.source.gesture": { id: "event gesture WebKit", en: "WebKit gesture events" },
  "trackpad.source.ctrlWheel": { id: "event roda dengan Control", en: "wheel events with Control" },

  "trackpad.confirmIntro": {
    id: "Jawab berdasarkan pengamatan Anda. Jawaban ini dicatat sebagai “dikonfirmasi pengguna”, bukan hasil pengukuran.",
    en: "Answer based on your own observation. These answers are recorded as “user-confirmed”, not as measurements.",
  },
  "trackpad.q.gestures": { id: "Gestur sistem 3/4 jari berfungsi?", en: "Do 3/4-finger system gestures work?" },
  "trackpad.q.gesturesHint": {
    id: "Gestur ini ditangani macOS dan tidak sampai ke aplikasi. Coba sendiri: geser 3 jari ke atas (Mission Control) dan geser 3/4 jari ke kiri/kanan (pindah Space). Gestur bisa dimatikan atau diubah di System Settings › Trackpad › Gestur Lainnya.",
    en: "These gestures are handled by macOS and do not reach the app. Try them yourself: swipe up with 3 fingers (Mission Control) and swipe left/right with 3/4 fingers (switch Spaces). Gestures can be turned off or changed in System Settings › Trackpad › More Gestures.",
  },
  "trackpad.q.gestures.ok": { id: "Ya, berfungsi", en: "Yes, they work" },
  "trackpad.q.gestures.problem": {
    id: "Tidak berfungsi walau pengaturan sudah dicek",
    en: "They do not work even after checking settings",
  },
  "trackpad.q.gestures.notChecked": { id: "Tidak dicek", en: "Not checked" },
  "trackpad.q.clickFeel": { id: "Klik fisik terasa normal?", en: "Does the physical click feel normal?" },
  "trackpad.q.clickFeelHint": {
    id: "Periksa: ada umpan balik klik/haptik di seluruh permukaan, tanpa bunyi berderak, permukaan tidak retak atau menggembung, dan tidak ada area yang tidak merespons. Kekuatan klik bisa diatur di System Settings › Trackpad › Klik.",
    en: "Check: there is click/haptic feedback across the whole surface, no rattling sound, the surface is not cracked or raised, and no area is unresponsive. Click pressure can be set in System Settings › Trackpad › Click.",
  },
  "trackpad.q.clickFeel.ok": { id: "Ya, normal", en: "Yes, normal" },
  "trackpad.q.clickFeel.problem": { id: "Ada masalah fisik", en: "There is a physical problem" },
  "trackpad.q.clickFeel.notChecked": { id: "Tidak dicek", en: "Not checked" },
  "trackpad.q.pinch": {
    id: "Cubit/zoom tidak terdeteksi oleh WebView. Berfungsi di aplikasi lain (mis. Foto atau Safari)?",
    en: "Pinch/zoom was not detected by the WebView. Does it work in other apps (e.g. Photos or Safari)?",
  },
  "trackpad.q.pinchHint": {
    id: "Opsional. Zoom bisa dimatikan di System Settings › Trackpad › Gulir & Zoom.",
    en: "Optional. Zoom can be turned off in System Settings › Trackpad › Scroll & Zoom.",
  },
  "trackpad.q.pinch.ok": { id: "Ya, berfungsi di aplikasi lain", en: "Yes, it works in other apps" },
  "trackpad.q.pinch.problem": { id: "Tidak berfungsi di mana pun", en: "It does not work anywhere" },
  "trackpad.q.pinch.notChecked": { id: "Tidak dicek", en: "Not checked" },
  "trackpad.save": { id: "Simpan hasil", en: "Save result" },
  "trackpad.missing": { id: "{n} fungsi wajib belum terdeteksi: {items}.", en: "{n} required function(s) not detected yet: {items}." },
  "trackpad.secondaryHint": {
    id: "Klik sekunder bisa dimatikan atau dipindah ke pojok di System Settings › Trackpad › Klik Sekunder — itu pengaturan, belum tentu kerusakan hardware.",
    en: "Secondary click can be turned off or moved to a corner in System Settings › Trackpad › Secondary Click — that is a setting, not necessarily a hardware fault.",
  },
  "trackpad.markMissing": { id: "Sudah dicoba, tidak terdeteksi (simpan)", en: "Tried, not detected (save)" },
  "trackpad.continue": { id: "Lanjutkan pengujian", en: "Continue testing" },

  "trackpadResult.coverage": {
    id: "Kursor melewati {covered} dari {total} sel kisi area uji.",
    en: "The cursor visited {covered} of {total} grid cells of the test area.",
  },
  "trackpadResult.detected": { id: "Terdeteksi: {items}.", en: "Detected: {items}." },
  "trackpadResult.notDetected": { id: "Sudah dicoba, tidak terdeteksi: {items}.", en: "Tried but not detected: {items}." },
  "trackpadResult.secondaryNotDetected": {
    id: "Klik sekunder tidak terdeteksi. Periksa System Settings › Trackpad › Klik Sekunder — bisa jadi pengaturan, belum tentu kerusakan hardware.",
    en: "Secondary click was not detected. Check System Settings › Trackpad › Secondary Click — it may be a setting, not necessarily a hardware fault.",
  },
  "trackpadResult.pinchDetected": { id: "Cubit/zoom terdeteksi ({source}).", en: "Pinch/zoom detected ({source})." },
  "trackpadResult.pinchNotDetected": {
    id: "Cubit/zoom tidak terdeteksi oleh WebView (opsional; keterbatasan WebView, bukan tanda kerusakan).",
    en: "Pinch/zoom was not detected by the WebView (optional; a WebView limitation, not a sign of damage).",
  },
  "trackpadResult.pinchConfirmedOk": { id: "Cubit/zoom berfungsi di aplikasi lain.", en: "Pinch/zoom works in other apps." },
  "trackpadResult.pinchConfirmedProblem": {
    id: "Cubit/zoom tidak berfungsi di aplikasi lain. Periksa System Settings › Trackpad › Gulir & Zoom.",
    en: "Pinch/zoom does not work in other apps. Check System Settings › Trackpad › Scroll & Zoom.",
  },
  "trackpadResult.forceDetected": { id: "Force Click terdeteksi (event webkitmouseforce).", en: "Force Click detected (webkitmouseforce events)." },
  "trackpadResult.forceUnsupported": {
    id: "Event Force Click tidak didukung WebView ini (opsional; bukan tanda kerusakan).",
    en: "Force Click events are not supported by this WebView (optional; not a sign of damage).",
  },
  "trackpadResult.forceNotDetected": {
    id: "Force Click tidak terdeteksi (opsional; bisa dimatikan di System Settings › Trackpad, atau Mac tanpa Force Touch).",
    en: "Force Click was not detected (optional; it can be turned off in System Settings › Trackpad, or the Mac has no Force Touch).",
  },
  "trackpadResult.gesturesOk": { id: "Gestur sistem 3/4 jari berfungsi.", en: "3/4-finger system gestures work." },
  "trackpadResult.gesturesProblem": {
    id: "Gestur sistem 3/4 jari tidak berfungsi walau pengaturan sudah dicek.",
    en: "3/4-finger system gestures do not work even after checking settings.",
  },
  "trackpadResult.clickFeelOk": { id: "Klik fisik terasa normal di seluruh permukaan.", en: "The physical click feels normal across the surface." },
  "trackpadResult.clickFeelProblem": {
    id: "Dilaporkan masalah fisik pada klik/permukaan trackpad (umpan balik, bunyi, retak/menggembung, atau area tidak merespons).",
    en: "A physical problem with the trackpad click/surface was reported (feedback, sound, cracked/raised, or unresponsive area).",
  },
  "trackpadResult.passed": { id: "Semua {total} fungsi wajib trackpad terdeteksi.", en: "All {total} required trackpad functions were detected." },
  "trackpadResult.passedPartial": {
    id: "{n} dari {total} fungsi wajib terdeteksi; sisanya dicatat sebagai catatan.",
    en: "{n} of {total} required functions detected; the rest is recorded as a note.",
  },
  "trackpadResult.failed": { id: "Masalah trackpad: {items}.", en: "Trackpad problems: {items}." },
  "trackpadResult.cancelled": {
    id: "Tes belum selesai: {n} dari {total} fungsi wajib terdeteksi.",
    en: "Test not finished: {n} of {total} required functions detected.",
  },

  "trackpadLimit.cursor": {
    id: "Event web memberi posisi kursor, bukan posisi jari di permukaan trackpad; area permukaan yang mati tidak terdeteksi otomatis.",
    en: "Web events give the cursor position, not the finger position on the trackpad surface; dead surface areas are not detected automatically.",
  },
  "trackpadLimit.externalMouse": {
    id: "Event dari mouse eksternal tidak bisa dibedakan dari trackpad; cabut mouse sebelum tes.",
    en: "Events from an external mouse cannot be told apart from the trackpad; disconnect the mouse before testing.",
  },
  "trackpadLimit.settings": {
    id: "Ketuk-untuk-klik, klik sekunder, arah gulir, dan gestur mengikuti System Settings › Trackpad; aplikasi tidak mengubahnya.",
    en: "Tap to click, secondary click, scroll direction, and gestures follow System Settings › Trackpad; the app does not change them.",
  },
  "trackpadLimit.systemGestures": {
    id: "Gestur 3/4 jari (Mission Control, pindah Space) ditangani macOS dan tidak sampai ke aplikasi, jadi hanya dikonfirmasi pengguna.",
    en: "3/4-finger gestures (Mission Control, switching Spaces) are handled by macOS and do not reach the app, so they are user-confirmed only.",
  },
  "trackpadLimit.webkit": {
    id: "Cubit dan Force Click bergantung pada event WebKit; bila tidak terdeteksi, itu keterbatasan WebView, bukan kegagalan.",
    en: "Pinch and Force Click depend on WebKit events; if they are not detected, that is a WebView limitation, not a failure.",
  },
  "trackpadLimit.privacy": {
    id: "Hanya sel kisi yang dilewati dan jenis event yang dicatat, tanpa riwayat koordinat.",
    en: "Only visited grid cells and event types are recorded, without a coordinate history.",
  },
} satisfies Record<string, Entry>;
