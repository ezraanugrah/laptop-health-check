# PRD Teknis & Rencana Implementasi — Fase 3: Interactive Hardware Testing

| | |
|---|---|
| Status | **Berjalan** — Milestone 3.0 (keamanan kamera/mikrofon) **terverifikasi manual oleh pemilik** (Tes 0/A/B/C, §15.5); Tes Layar dan Tes Keyboard sudah dibuat. Semua di working tree `feature/macos-only` (belum di-commit) |
| Tanggal | 19 November 2026 |
| Basis kode | `feature/macos-only` (dari `main` @ `851586b`, belum di-commit) |
| Branch rencana | `feature/interactive-testing` (lihat D9) |
| Target | Mac Intel: L3 di MacBookPro16,2 milik pemilik (punya Touch Bar dan 4 port Thunderbolt 3). Apple Silicon: tetap **Pratinjau** sampai diuji di perangkat asli |

## 1. Tujuan

Menambahkan **tes perangkat keras interaktif yang dipandu**. Tes ini melengkapi diagnostik otomatis Fase 2 untuk komponen yang hanya bisa dibuktikan dengan interaksi, seperti menekan tombol, mendengar suara, atau melihat gambar.

1. Setiap tes memberi salah satu dari lima hasil: **Belum diuji / Lulus / Gagal / Tidak tersedia / Dibatalkan**, beserta buktinya (ditetapkan pemilik, 19 Nov 2026).
2. Setiap bukti diberi label jujur:
   - **terukur**: berasal dari event atau data perangkat, misalnya kode tombol yang diterima, level sinyal mikrofon, atau port yang mendeteksi perangkat;
   - **dikonfirmasi pengguna**: berasal dari pengamatan pengguna, misalnya "tidak ada piksel mati" atau "suara kiri terdengar jernih".
3. Semua tes berjalan offline, tanpa hak admin, tanpa dependency baru, dan **tanpa mengubah pengaturan sistem atau hardware**.

## 2. Ruang lingkup

| # | Tes | Bukti terukur utama | Konfirmasi pengguna |
|---|---|---|---|
| T1 | Layar (piksel mati/macet, keseragaman, gradasi) | — (tidak bisa diukur tanpa kamera eksternal) | Ya, inti tes |
| T2 | Keyboard | `KeyboardEvent.code` per tombol, deteksi ketikan ganda/macet | Lampu latar keyboard |
| T3 | Touch Bar (bila ada) | Event F1–F12 (tahan Fn) di sepanjang bar; Esc bila Esc ada di Touch Bar | Tampilan bar (piksel, kecerahan) |
| T4 | Trackpad | Gerak kursor, klik, klik sekunder, gulir 2 arah, pinch dan Force Click (bila event tersedia) | Rasa klik, area yang tidak responsif |
| T5 | Speaker kiri/kanan | Perangkat keluaran default = speaker internal (`SPAudioDataType`). Opsional: loopback speaker → mikrofon (eksperimental, D3) | Identifikasi sisi secara acak (*blind*), suara bergetar saat *sweep* |
| T6 | Mikrofon | Level sinyal (dBFS) di atas *noise floor* | Opsional: putar ulang rekaman 5 detik dari memori (D3) |
| T7 | Webcam | Kamera terdeteksi (`SPCameraDataType`), frame diterima, resolusi/fps, bukan frame hitam | Gambar jernih, tanpa bercak, LED hijau menyala |
| T8 | Wi-Fi & Bluetooth | Adaptor terdeteksi, status radio, jumlah jaringan terlihat, sinyal/noise, jumlah perangkat BT tersambung | — |
| T9 | USB/Thunderbolt & port lain | Perubahan *snapshot* saat perangkat dicolok: status *receptacle* Thunderbolt, perangkat USB baru, daya eksternal, jack audio, layar eksternal, kartu SD | Label posisi fisik port |

**Di luar cakupan Fase 3:** Touch ID, tombol daya, sensor cahaya sekitar, pengujian per driver speaker atau per kapsul mikrofon, uji beban CPU/GPU (dilarang sampai disetujui), koneksi ke jaringan atau internet, *pairing* Bluetooth oleh aplikasi, AirDrop, mengubah kecerahan/volume/Wi-Fi/Bluetooth, serta menyimpan rekaman.

## 3. Prinsip dan batasan (wajib)

1. **Offline total.** Nada uji dibuat lokal dengan Web Audio. Tidak ada aset dari luar, permintaan jaringan, maupun koneksi Wi-Fi yang dibuat aplikasi.
2. **Hanya data nyata.** Tidak ada hasil contoh atau simulasi. Bila sesuatu tidak bisa diuji, hasilnya **Tidak tersedia** beserta alasannya. Tes yang belum dilakukan tidak pernah ditampilkan sebagai Sehat/Lulus.
3. **Label bukti tidak boleh dikaburkan.** "Lulus" tanpa bukti terukur selalu ditampilkan sebagai **"Lulus (dikonfirmasi pengguna)"**.
4. **Tidak mengubah pengaturan.** Aplikasi tidak menyentuh volume, kecerahan, True Tone/Night Shift, Wi-Fi/Bluetooth, pengaturan keyboard/trackpad, maupun pengaturan privasi. Bila sebuah tes butuh kondisi tertentu (mis. Wi-Fi menyala atau volume ±50%), aplikasi **meminta pengguna mengubahnya sendiri**.
5. **Izin hanya saat dibutuhkan.** Izin kamera dan mikrofon (TCC) baru diminta saat pengguna menekan "Mulai" pada tes tersebut. Bila izin ditolak, hasilnya "Tidak tersedia — izin ditolak" disertai petunjuk System Settings yang dijalankan pengguna sendiri.
6. **Tanpa rekaman tersimpan.** Audio dan video hanya diproses di memori. Semua *track* dihentikan saat tes selesai atau dibatalkan. Ini diverifikasi lewat `track.readyState === "ended"` dan lampu kamera yang padam.
7. **Privasi data perangkat.** Alamat MAC, SSID/BSSID, nama perangkat Bluetooth/USB, ID unik kamera, dan nomor seri aksesori **dibuang di parser Rust**, tidak dikirim ke frontend, tidak masuk laporan, dan tidak dicatat di log.
8. **Selalu bisa keluar.** Setiap tes punya tombol "Keluar" di layar. Tes yang menangkap keyboard memakai tombol di layar atau tahan Esc 2 detik, bukan Esc biasa.
9. **Dependency nol.** Tidak ada crate atau paket npm baru tanpa persetujuan (lihat D5).

## 4. Model hasil

```ts
// src/types/interactive.ts (rancangan)
type InteractiveTestId =
  | "display" | "keyboard" | "touchBar" | "trackpad"
  | "speakers" | "microphone" | "camera" | "wireless" | "ports";

type TestOutcome =
  | "notRun"        // Belum diuji
  | "passed"        // Lulus
  | "failed"        // Gagal
  | "unavailable"   // Tidak tersedia (Mac tanpa Touch Bar, izin ditolak, Wi-Fi mati, tanpa aksesori)
  | "cancelled";    // Dibatalkan (pengguna keluar sebelum selesai)

interface Evidence {
  kind: "measured" | "userConfirmed" | "info";
  level: "ok" | "warning" | "critical" | "info";
  text: string;            // bahasa Indonesia
  experimental?: boolean;  // ambang belum dikalibrasi → tidak mengubah outcome
}

interface InteractiveResult {
  id: InteractiveTestId;
  outcome: TestOutcome;
  evidence: Evidence[];
  items: { label: string; outcome: TestOutcome }[]; // per tombol/port/kanal
  limitations: string[];   // keterbatasan deteksi, selalu tampil
  finishedAt?: string;
  durationMs?: number;
}
```

Aturan penilaian (fungsi murni dengan test di setiap batas):
- **Lulus**: semua langkah wajib terpenuhi dan tidak ada bukti `critical`. Label menjadi "Lulus (dikonfirmasi pengguna)" bila tidak ada bukti `measured` berlevel `ok`.
- **Gagal**: ada bukti `critical`, baik terukur (mis. tombol tidak pernah mengirim event, adaptor tidak terdeteksi, kamera tidak mengirim frame) maupun laporan pengguna (mis. "ada piksel mati").
- Bukti `experimental` hanya informasi dan **tidak pernah** mengubah outcome (sama dengan aturan `Metric.experimental`).
- **Ringkasan tes interaktif** (`X dari Y diuji · lulus · gagal`) ditampilkan terpisah dari `HardwareSummary` (D1). Penggabungan ke ringkasan laporan dilakukan di Fase 4.
- Hasil disimpan **di memori selama sesi** saja. Riwayat dan ekspor dikerjakan di Fase 4.

Pemetaan ke status kartu (untuk Fase 4, `toCheckStatus`): Lulus → Sehat · Gagal → Kritis · Belum diuji/Dibatalkan/Tidak tersedia → Tidak diketahui. Hanya Lulus yang bisa menjadi Sehat. Keluar di tengah tes mencatat Dibatalkan, kecuali sudah ada hasil selesai sebelumnya (`shouldRecordCancel`).

## 5. Desain per tes

### T1 — Layar
- **Alur:** jendela masuk mode layar penuh (Tauri `setFullscreen`) dan kursor disembunyikan. Pola berganti dengan klik, Spasi, atau →, dan bisa mundur dengan ←: hitam → putih → merah → hijau → biru → abu-abu 50% → gradasi horizontal (cek *banding*) → kisi 1 px. Setelah selesai, pengguna memilih satu atau lebih: *Tidak ada masalah* · *Piksel mati/macet* · *Bercak/kebocoran cahaya* · *Garis/kedip*. Pengguna juga bisa mengetuk lokasi masalah (disimpan sebagai % posisi layar).
- **Bukti:** seluruhnya dikonfirmasi pengguna. Info terukur yang ditampilkan: resolusi dan layar internal (dari data GPU Fase 2).
- **Lulus/gagal:** *Tidak ada masalah* → Lulus (dikonfirmasi pengguna). Piksel mati/macet, garis, atau kedip → Gagal. Bercak ringan → Peringatan.
- **Keterbatasan:** piksel mati tidak bisa dideteksi otomatis. Di MacBook Pro 14/16 berponi, area di samping poni mungkin tidak tercakup mode layar penuh. Pengguna diminta menaikkan kecerahan dan mematikan True Tone/Night Shift sendiri bila perlu. Tes hanya untuk layar internal.
- **CSP:** warna memakai class Tailwind, tanpa `style=` inline.

### T2 — Keyboard
- **Alur:** gambar keyboard sesuai tata letak. Jenis bar fungsi (Touch Bar atau baris fisik) ditentukan dari model; ANSI, ISO, atau JIS dipilih pengguna. Tombol berubah hijau saat `keydown` diterima. Tersedia kotak teks untuk mencoba mengetik bebas.
- **Bukti terukur:**
  - `KeyboardEvent.code`, yaitu posisi fisik dan bukan karakter;
  - jumlah tombol yang teruji;
  - **ketikan ganda**: `keyup` → `keydown` tombol yang sama dalam < `CHATTER_WINDOW_MS` (awal 40 ms, eksperimental sampai dikalibrasi; relevan untuk keyboard *butterfly* 2016–2019);
  - **tombol macet**: `keydown` dengan `repeat` sejak awal, atau tanpa `keyup` > 3 dtk.
- **Konfirmasi pengguna:** lampu latar keyboard menyala dan merata.
- **Lulus/gagal:** semua tombol yang bisa diuji menerima event → Lulus (terukur). Tombol yang tidak merespons setelah ditekan pengguna, ditandai lewat "tombol ini tidak berfungsi" → Gagal.
- **Keterbatasan (ditampilkan):**
  - Touch ID/tombol daya dan Fn/Globe tidak mengirim event ke aplikasi (dipastikan di spike).
  - Kombinasi sistem (⌘Tab, ⌘Space, ⌘Q, Mission Control) diambil alih macOS.
  - Tombol F di baris fisik menjalankan fungsi kecerahan/volume kecuali Fn ditahan. Pengguna diminta menahan Fn; aplikasi tidak mengubah pengaturan.
  - Caps Lock hanya mengirim `keydown` saat menyala dan `keyup` saat padam (ditangani khusus).
- **Pengaman ⌘Q (D6):** selama tes, `RunEvent::ExitRequested` ditahan (`prevent_exit`) dan pengguna ditanya dulu.

### T3 — Touch Bar (bila ada)
- **Deteksi:** tabel model ber-Touch Bar yang sudah tetap karena produknya dihentikan: MacBookPro13,2/13,3, 14,2/14,3, 15,1–15,4, 16,1–16,4, 17,1, Mac14,7. Spike juga mencari sinyal *runtime* read-only sebagai konfirmasi. Model lain → **Tidak berlaku**. Model tidak dikenal → tanya pengguna.
- **Alur:** pengguna menahan Fn sehingga Touch Bar menampilkan F1–F12, lalu menyentuh setiap tombol dari kiri ke kanan. Event F1–F12 dipetakan ke 12 segmen bar sehingga area mati terlihat. Di model yang Esc-nya ada di Touch Bar (2016–2019), Esc ikut diuji.
- **Bukti terukur:** segmen yang mengirim event. **Konfirmasi pengguna:** tampilan bar tanpa piksel mati atau redup.
- **Keterbatasan:** aplikasi tidak bisa menggambar konten sendiri di Touch Bar karena Tauri tidak mendukung `NSTouchBar` tanpa kode native, dan pengaturan Touch Bar tidak diubah.
- **Verifikasi:** bisa diuji L3 langsung di MacBookPro16,2 milik pemilik.

### T4 — Trackpad
- **Langkah dan bukti terukur:**
  1. Gerakkan kursor mengisi kisi 8×5 dan menyentuh 4 tepi layar (`pointermove`).
  2. Klik primer (`pointerdown`/`click`) dan ketuk dua kali (`dblclick`).
  3. Klik sekunder dua jari (`contextmenu`, menu bawaan dicegah).
  4. Gulir dua jari vertikal dan horizontal (`wheel` deltaY/deltaX).
  5. Seret (*drag*).
  6. Pinch (WebKit `gesturechange`) dan Force Click (`webkitmouseforcedown`), bila event tersedia di WKWebView (dipastikan di spike). Bila tidak tersedia, langkah itu **Tidak tersedia**, bukan Gagal.
- **Indikasi eksperimental:** lompatan kursor besar dalam satu frame dicatat sebagai info saja.
- **Konfirmasi pengguna:** klik terasa normal, tanpa bunyi aneh atau area yang tidak merespons.
- **Keterbatasan:** event web memberi posisi kursor (relatif), bukan posisi jari di permukaan trackpad. Pemetaan permukaan butuh `NSTouch` (API AppKit publik lewat `objc2`), yang menjadi dependency langsung baru (D5, ditunda). Ketuk-untuk-klik bergantung pada pengaturan pengguna dan tidak diubah.

### T5 — Speaker kiri/kanan
- **Pra-cek (terukur):** `SPAudioDataType` menunjukkan apakah perangkat keluaran default adalah speaker internal (`coreaudio_device_transport` = builtin). Bila bukan (headphone, Bluetooth, HDMI), aplikasi meminta pengguna memindahkan keluaran sendiri. Nama perangkat eksternal tidak ditampilkan.
- **Alur:**
  1. Nada 1 kHz di kiri, kanan, lalu keduanya (Web Audio `StereoPannerNode`, gain tetap −12 dBFS, *fade in/out*).
  2. **Uji acak (*blind*)**: aplikasi memutar 6 nada di sisi acak dan pengguna menjawab kiri/kanan. Hasilnya: benar ≥ 5/6 per sisi.
  3. *Sweep* 100 Hz–12 kHz selama 8 detik untuk mendeteksi suara bergetar atau pecah.
- **Opsional (D3, eksperimental):** loopback speaker → mikrofon. Mikrofon direkam dengan `echoCancellation/noiseSuppression/autoGainControl: false`, lalu energi pada frekuensi nada dicari lewat `AnalyserNode` (FFT). Bukti ini terukur bahwa speaker dan mikrofon berfungsi bersama, tetapi tidak membedakan kiri/kanan.
- **Lulus/gagal:** satu sisi tidak terdengar, atau jawaban uji acak salah berulang → Gagal. Suara bergetar → Peringatan.
- **Keterbatasan:** volume dan *mute* tidak dibaca atau diubah (pengguna diminta mengatur ±50%). Driver speaker individual (woofer/tweeter) tidak diuji terpisah.

### T6 — Mikrofon
- **Alur:** `getUserMedia({ audio })` dengan pemrosesan suara dimatikan. Aplikasi mengukur 2 detik hening (*noise floor*), lalu pengguna bicara atau bertepuk selama 3 detik.
- **Bukti terukur:** puncak − *noise floor* ≥ `MIC_MIN_DELTA_DB` (awal 20 dB, eksperimental sampai dikalibrasi di Mac asli). Aplikasi juga mencatat apakah perangkat input default adalah mikrofon internal (`coreaudio_default_audio_input_device` + transport).
- **Opsional (D3):** rekam 5 detik **di memori** lalu putar ulang untuk menilai kejernihan (dikonfirmasi pengguna). Rekaman dibuang saat tes ditutup.
- **Lulus/gagal:** tidak ada sinyal di atas *noise floor* setelah pengguna bersuara → Gagal (terukur). Izin ditolak → Tidak tersedia.
- **Keterbatasan:** larik 3 mikrofon MacBook tampil sebagai satu perangkat, sehingga mikrofon tidak bisa diuji per kapsul.

### T7 — Webcam
- **Pra-cek (terukur, tanpa izin):** `SPCameraDataType` memastikan kamera terdeteksi macOS (nama model). `spcamera_unique-id` dibuang.
- **Alur:** `getUserMedia({ video })` → pratinjau langsung.
- **Bukti terukur:** *track* aktif; resolusi dan fps (`getSettings` + hitungan frame); **bukan frame hitam**, yaitu rata-rata luminans sampel kecil (64×36 di canvas, tidak disimpan) > `CAMERA_BLACK_LUMA` selama 2 detik. Frame hitam bisa berarti lensa tertutup atau kamera rusak; pengguna diminta memeriksa.
- **Konfirmasi pengguna:** gambar jernih, tanpa bercak atau piksel mati, warna wajar, dan **LED hijau menyala** (indikator hardware). Saat keluar, LED harus padam.
- **Lulus/gagal:** kamera tidak terdeteksi atau tidak ada frame → Gagal (terukur).

### T8 — Wi-Fi & Bluetooth (tanpa koneksi)
- **Wi-Fi (`SPAirPortDataType`):**
  - Data yang dibaca: kartu terdeteksi (`spairport_wireless_card_type`, firmware, mode PHY dan kanal yang didukung), status radio (`spairport_status_information`), **jumlah** jaringan sekitar yang terlihat, serta sinyal/noise koneksi saat ini dalam dBm.
  - **Dibuang di parser:** `spairport_wireless_mac_address`, `_name` (SSID) jaringan saat ini dan jaringan sekitar.
  - Lulus (terukur) bila adaptor terdeteksi, radio menyala, dan jumlah jaringan terlihat > 0 atau sedang tersambung.
  - Adaptor tidak terdeteksi → Gagal. Radio mati → Tidak tersedia ("nyalakan Wi-Fi sendiri lalu ulangi").
- **Bluetooth (`SPBluetoothDataType`):**
  - Data yang dibaca: controller terdeteksi, `controller_state`, chipset, firmware, transport, dan **jumlah** perangkat tersambung.
  - **Dibuang di parser:** `controller_address`, serta nama dan alamat perangkat.
  - Opsional: pengguna menyambungkan aksesori BT sendiri, lalu aplikasi memindai ulang dan perubahan jumlah perangkat menjadi bukti terukur.
- **Keterbatasan:** tidak ada uji kecepatan atau koneksi internet. Di macOS terbaru, daftar jaringan sekitar bisa disembunyikan tanpa izin lokasi. Aplikasi tidak meminta izin lokasi, jadi jumlahnya bisa 0. Dalam kasus itu, bukti diambil dari status radio/koneksi dan keterbatasan ini ditampilkan.

### T9 — USB/Thunderbolt & port lain
- **Mekanisme:** *snapshot* read-only yang dibandingkan sebelum dan sesudah pengguna mencolok perangkat. Aplikasi memeriksa ulang setiap ±2 detik selama menunggu, dengan batas 60 detik per langkah, dan hanya saat tes aktif.
- **Data yang dibandingkan:**
  - `SPThunderboltDataType`: `receptacle_N_tag.receptacle_status_key`, `link_status_key`, `current_speed_key` per port (MacBookPro16,2: 2 bus × 2 *receptacle* = 4 port);
  - `SPUSBHostDataType`: perangkat USB baru beserta kecepatannya. Di macOS 26 tipe lama `SPUSBDataType` sudah tidak ada;
  - `ioreg AppleSmartBattery` `ExternalConnected` + watt adaptor: port pengisian daya (MagSafe/USB-C);
  - `SPAudioDataType`: headphone di jack 3,5 mm;
  - `SPDisplaysDataType`: layar eksternal (HDMI/USB-C);
  - `SPCardReaderDataType`: kartu SD (MacBookPro16,2 tidak punya slot, jadi Tidak berlaku).
- **Alur:** pengguna memilih label posisi fisik ("kiri-depan", dst.), mencolok flashdisk/mouse/charger, lalu aplikasi menampilkan port yang berubah dan kecepatannya.
- **Bukti terukur:** perangkat terdeteksi di port tersebut. **Dikonfirmasi pengguna:** posisi fisik port.
- **Lulus/gagal:** perangkat dikenal-baik tidak terdeteksi di satu port, tetapi terdeteksi di port lain → Gagal untuk port itu. Pengguna tanpa aksesori → Tidak tersedia.
- **Privasi:** nomor seri, nama produk, dan *location ID* perangkat USB dibuang. Yang disimpan hanya jenis (penyimpanan/HID/daya/audio/layar) dan kecepatan.
- **Keterbatasan:** pemetaan *receptacle* ke posisi fisik berbeda per model, sehingga posisi diberi label oleh pengguna. Charger yang hanya memberi daya mungkin tidak mengubah status *receptacle*; pembuktiannya lewat status daya.

## 6. Sumber data dan API

| Kebutuhan | Sumber | Diverifikasi di Mac dev (macOS 26)? |
|---|---|---|
| Event keyboard/trackpad | DOM `keydown/keyup`, Pointer Events, `wheel`, WebKit `gesture*`, `webkitmouseforce*` | Belum: spike 3.0 |
| Nada uji, analisis audio | Web Audio API (`OscillatorNode`, `StereoPannerNode`, `AnalyserNode`) | Belum: spike 3.0 |
| Kamera/mikrofon | `navigator.mediaDevices.getUserMedia`. wry 0.57 menangani `requestMediaCapturePermission` dan **mengizinkan semua origin bila handler tidak dipasang**, jadi handler wajib dipasang (§7) | Kode wry diperiksa; perilaku runtime belum (spike 3.0) |
| Layar penuh | Tauri `Window.setFullscreen` (capability `core:window:allow-set-fullscreen`) | Belum |
| Usage description TCC | `src-tauri/Info.plist`: Tauri menyematkannya ke binary saat `tauri dev` dan menggabungkannya ke bundle | Kode tauri-codegen diperiksa |
| Audio devices | `system_profiler -json SPAudioDataType` (`coreaudio_device_transport`, `coreaudio_default_audio_*`) | ✅ kunci ada |
| Kamera | `SPCameraDataType` (`_name`, `spcamera_model-id`; `spcamera_unique-id` dibuang) | ✅ |
| Wi-Fi | `SPAirPortDataType` (berisi MAC dan SSID → wajib dibuang) | ✅ kunci ada |
| Bluetooth | `SPBluetoothDataType` (`controller_properties.*`; `controller_address` dibuang) | ✅ |
| Port | `SPThunderboltDataType` (`receptacle_*_tag`), `SPUSBHostDataType`, `SPCardReaderDataType` | ✅ (`SPUSBDataType` tidak ada di macOS 26) |
| Daya eksternal | `ioreg -rn AppleSmartBattery` (sudah dipakai Fase 2) | ✅ |
| Touch Bar | Tabel model + sinyal runtime (dicari di spike) | Sebagian |

Semua perintah dijalankan lewat `platform/macos/command.rs` dengan path absolut (`/usr/sbin/system_profiler`, `/usr/sbin/ioreg`), batas waktu, dan tanpa shell. Parser ditulis murni dan dites dengan fixture tersanitasi.

## 7. Arsitektur dan perubahan kode

**Frontend**
- `src/pages/InteractiveTestsPage.tsx` menggantikan placeholder "Tes Interaktif" di sidebar: daftar kartu tes, status, ringkasan, serta tombol Mulai/Ulangi/Lewati.
- `src/components/interactive/`: satu komponen per tes, ditambah kerangka layar tes (instruksi, langkah, tombol Keluar).
- `src/lib/interactive/*.ts`: **fungsi penilaian murni** (ketikan ganda, frame hitam, level mikrofon, uji acak speaker, *diff* port, penentuan outcome) yang dites dengan `node --test` di setiap batas. Ini mengikuti pola `lib/status.ts` karena datanya berasal dari event di WebView.
- `src/types/interactive.ts`: tipe hasil (§4). Tipe inventaris dicerminkan dari Rust.

**Rust (read-only)**
- `diagnostics/raw.rs`: `PeripheralInventory { audio, cameras, wifi, bluetooth, touch_bar, card_reader }` dan `PortSnapshot`. Struct ini sudah tanpa MAC, SSID, nama, maupun nomor seri.
- `Platform`: method `peripherals()` dan `port_snapshot()`, diimplementasikan di `macos/`, `unsupported.rs`, dan `fake.rs`.
- `platform/macos/`: modul baru `audio.rs`, `camera.rs`, `wireless.rs`, `ports.rs`, `touchbar.rs`, masing-masing dengan parser murni dan fixture.
- `diagnostics/peripherals.rs`: penilaian bagian yang berbasis inventaris (adaptor Wi-Fi/BT, kamera terdeteksi, *diff* port).
- Command baru: `get_peripheral_inventory`, `get_port_snapshot`, `set_media_test_active(bool)`.

**Konfigurasi (D4)**
- `src-tauri/Info.plist`: `NSCameraUsageDescription` dan `NSMicrophoneUsageDescription` dalam bahasa Indonesia. Tidak ada izin lokasi atau Bluetooth karena CoreBluetooth/CoreWLAN tidak dipakai.
- `capabilities/default.json`: `core:window:allow-set-fullscreen` (dan `allow-is-fullscreen`).
- `tauri::Builder::on_permission_request`: **tolak semua** jenis izin WebView kecuali kamera/mikrofon, dan keduanya hanya diizinkan saat `set_media_test_active(true)`. Ini lapisan pertahanan tambahan karena bawaan wry mengizinkan semua.
- CSP: `media-src 'self' mediastream: blob:` hanya bila spike membuktikan perlu. Tanpa sumber jaringan.
- Entitlement `com.apple.security.device.camera`/`audio-input` baru diperlukan saat *hardened runtime*/notarisasi (Fase 5).

## 8. Privasi dan keamanan (ringkas)

| Data | Perlakuan |
|---|---|
| Audio/video | Hanya di memori; tidak ada file; *track* dihentikan saat keluar |
| MAC Wi-Fi/BT, SSID/BSSID | Dibuang di parser; ada test yang memastikan nilainya tidak pernah muncul di struct/JSON |
| Nama perangkat BT/USB, nomor seri aksesori, ID unik kamera | Dibuang; hanya jenis dan jumlah |
| Label perangkat input/output di WebView | Boleh tampil di layar untuk memilih perangkat, tidak masuk hasil/laporan |
| Lokasi | Tidak diminta |
| Fixture | Diambil dengan skrip sanitasi yang diperluas (MAC, SSID, nama, serial, UUID). Ada test yang menolak pola MAC (`xx:xx:xx:xx:xx:xx`) di fixture |

## 9. Strategi pengujian

| Lapisan | Cakupan |
|---|---|
| L1 frontend (`node --test`) | Semua fungsi penilaian interaktif, setiap batas ambang (mis. 39/40/41 ms ketikan ganda; 19,9/20,0 dB mikrofon; 4/5/6 jawaban uji acak) dan penentuan outcome/label |
| L1 Rust (`cargo test`) | Parser terhadap fixture tersanitasi (audio, kamera, Wi-Fi, BT, Thunderbolt, USB host), *diff* snapshot, sanitasi (MAC/SSID tidak lolos), `fake.rs` |
| L0–L2 CI | Kompilasi, test, dan smoke inventaris di VM macOS Intel/arm64. VM tidak punya kamera, mikrofon, atau Touch Bar, sehingga hasilnya Unknown/Tidak berlaku. **Bukan bukti hardware** |
| L3 manual (Mac Intel pemilik) | Daftar periksa `docs/FASE3-L3-CHECKLIST.md`: setiap tes dijalankan nyata (4 port TB, Touch Bar, kamera, speaker, dll.). Hasil dan tanggal dicatat |
| Apple Silicon | Tetap Pratinjau. Fixture dan L3 dikerjakan bila perangkat tersedia |

Definisi selesai per perubahan tetap: typecheck · test · build · fmt · clippy · cargo test hijau, lalu `TASKS.md` diperbarui.

## 10. Milestone dan checkpoint

| Milestone | Isi | Checkpoint |
|---|---|---|
| **3.0 Spike teknis** | Halaman uji sementara di Mac Intel: `getUserMedia` audio/video di `tauri dev` **dan** `.app` debug (origin `tauri://`, prompt TCC, `Info.plist`); Web Audio stereo; `setFullscreen`; event Fn/F-keys/Caps Lock/⌘Q; `gesture*`/`webkitmouseforce*`; `contextmenu`; waktu eksekusi `system_profiler` per tipe; sinyal runtime Touch Bar. Hasil: laporan spike + rekomendasi final | **A**: laporan spike, persetujuan desain final |
| 3.1 Fondasi | Tipe hasil, halaman "Tes Interaktif", kerangka layar tes, command inventaris + parser + fixture tersanitasi, permission handler, `Info.plist` | — |
| 3.2 Layar | T1 | — |
| 3.3 Keyboard + Touch Bar | T2, T3 (+ pengaman ⌘Q) | — |
| 3.4 Trackpad | T4 | **B**: input & layar (L1 + demo L3) |
| 3.5 Speaker + mikrofon | T5, T6 (+ loopback opsional) | — |
| 3.6 Webcam | T7 | **C**: media & izin TCC |
| 3.7 Wi-Fi & Bluetooth | T8 | — |
| 3.8 Port | T9 | **D**: konektivitas & port |
| 3.9 Validasi | Daftar periksa L3 di Mac Intel, pembaruan dokumen | **E**: laporan akhir Fase 3 |

Setiap checkpoint diakhiri laporan, hasil test, dan permintaan izin commit. Commit, push, PR, merge, dan release hanya dilakukan dengan izin eksplisit sesuai `docs/GIT-WORKFLOW.md`.

## 11. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| `getUserMedia` tidak tersedia di origin produksi `tauri://localhost` (dianggap bukan *secure context*) atau perilakunya berbeda dari `tauri dev` | T5 (loopback), T6, dan T7 tidak bisa diukur | Spike 3.0 di `.app` debug. Bila gagal, pilihannya (keputusan pemilik): (a) skema/opsi Tauri lain bila ada, (b) capture native AVFoundation lewat FFI (usaha besar), (c) turun ke deteksi perangkat + konfirmasi pengguna lewat aplikasi bawaan yang dibuka pengguna sendiri |
| Prompt TCC di `tauri dev` dikaitkan ke Terminal/IDE, bukan ke aplikasi | Pengalaman uji dev berbeda | Uji izin final di `.app`. Dokumentasikan perbedaannya |
| Aplikasi portable tanpa tanda tangan dari flashdisk: TCC dan *App Translocation* | Izin bisa diminta ulang setiap sesi | Dicatat sebagai keterbatasan; dikaji di Fase 5 bersama *code signing* |
| Tombol yang diambil alih macOS (Fn/Globe, ⌘Tab, Touch ID) | Tidak bisa diuji | Tandai "Tidak dapat diuji lewat aplikasi", jangan dianggap gagal |
| Tombol F memicu kecerahan/volume tanpa Fn | Pengguna tidak sengaja mengubah pengaturan | Instruksi jelas untuk menahan Fn; aplikasi sendiri tidak mengubah apa pun |
| Variasi tata letak keyboard (ANSI/ISO/JIS, Touch Bar/baris fisik) | Peta tombol salah | Pakai `code` (posisi fisik), pilihan tata letak oleh pengguna, dan tombol "tidak ada di keyboard saya" |
| Pemetaan permukaan trackpad tidak mungkin lewat event web | Area mati trackpad tidak terdeteksi otomatis | Keterbatasan ditampilkan. Opsi `NSTouch` (D5) |
| Ambang mikrofon/kamera/ketikan ganda bergantung lingkungan | Alarm palsu | Ambang ditandai eksperimental dan tidak mengubah outcome sampai dikalibrasi di Mac asli |
| Format `system_profiler` berbeda antarversi macOS atau di Apple Silicon | Parser gagal | Fixture per perangkat; format tidak dikenal → Unknown, bukan crash |
| Wi-Fi/BT mati, daftar jaringan disembunyikan tanpa izin lokasi | Bukti terbatas | Tidak tersedia + instruksi. Aplikasi tidak menyalakan radio dan tidak meminta lokasi |
| Polling `system_profiler` membebani CPU | UI lambat | Polling hanya saat T9 aktif, interval ±2 detik, batas 60 detik, dijalankan di `spawn_blocking` |
| Poni layar MacBook Pro 14/16 | Sebagian piksel tidak tercakup T1 | Keterbatasan ditampilkan |
| CI tanpa hardware | L3 tidak bisa diotomatisasi | Daftar periksa L3 manual. Logika diuji L1 |

## 12. Keputusan yang dibutuhkan

| # | Keputusan | Rekomendasi |
|---|---|---|
| D1 | Hasil interaktif ditampilkan **terpisah** dari `HardwareSummary` di Fase 3, lalu digabung di ringkasan laporan Fase 4 | Ya |
| D2 | Model 6 outcome + label bukti (terukur / dikonfirmasi pengguna); "Lulus" tanpa bukti terukur ditampilkan "Lulus (dikonfirmasi pengguna)" | Ya |
| D3 | Mikrofon: rekaman 5 detik **di memori** untuk diputar ulang (tidak disimpan). Loopback speaker → mikrofon sebagai bukti eksperimental | Ya, keduanya opsional |
| D4 | Perubahan konfigurasi: `Info.plist` (2 usage description), capability *fullscreen*, permission handler (kamera/mikrofon hanya saat tes aktif, lainnya ditolak), dan `media-src` di CSP hanya bila terbukti perlu | Ya |
| D5 | Tanpa dependency baru. Pemetaan permukaan trackpad (`NSTouch` via `objc2` langsung) ditunda dan butuh persetujuan terpisah | Ya, tunda |
| D6 | Pengaman ⌘Q selama tes keyboard (`prevent_exit` + konfirmasi) | Ya |
| D7 | Cakupan port: USB-C/Thunderbolt/USB-A (data), pengisian daya, jack audio, layar eksternal, slot SD, masing-masing hanya bila ada. Tanpa aksesori → Tidak tersedia | Ya |
| D8 | Spike 3.0 butuh `.app` debug (`npm run tauri build -- --debug --bundles app`, tambahan ±1–2 GB sementara, dibersihkan setelahnya) untuk menguji origin produksi dan TCC | Izin saat spike |
| D9 | Branch `feature/interactive-testing` dibuat dari `main` **setelah** `feature/macos-only` di-merge pemilik, atau dari `feature/macos-only` bila ingin mulai sebelum merge | Dari `main` setelah merge |

## 13. Kriteria selesai Fase 3

- T1–T9 bisa dijalankan, dilewati, diulang, dan dibatalkan kapan saja. Outcome dan bukti (berlabel) tercatat.
- Tidak ada permintaan jaringan, dependency baru (kecuali disetujui), file rekaman, maupun perubahan pengaturan sistem atau hardware.
- MAC, SSID/BSSID, nama perangkat, dan nomor seri aksesori tidak pernah muncul di hasil, log, atau fixture (dijaga test).
- Kamera dan mikrofon dilepas saat tes ditutup (LED padam, *track* `ended`).
- Semua fungsi penilaian dites di setiap batas. Parser dites dengan fixture tersanitasi. Definisi selesai hijau dan CI `macos-intel`/`macos-arm64` hijau.
- Daftar periksa L3 lulus di Mac Intel asli. Apple Silicon tetap Pratinjau sampai diuji.

## 14. Dampak sumber daya

- **Dependency:** nol crate atau paket npm baru (target). Web Audio, MediaDevices, dan Pointer Events sudah tersedia di WKWebView.
- **Disk:** kode dan fixture kecil (< 1 MB). Spike `.app` debug memakan ±1–2 GB sementara (D8), dibersihkan setelah verifikasi.
- **Ukuran aplikasi:** bertambah sedikit (komponen UI dan parser). Tidak ada aset audio karena nada dibuat lokal.

## 15. Hasil Milestone 3.0 — keamanan kamera/mikrofon (19 Nov 2026)

Diverifikasi di MacBookPro16,2 (Intel, macOS 26), pada `tauri dev` dan build produksi (`npm run tauri build -- --bundles app`, release, `.app` tanpa tanda tangan, 4,7 MB).

### 15.1 Yang dipasang
| Lapisan | Isi |
|---|---|
| Handler izin WebView (`media_gate.rs`) | Semua jenis izin ditolak; kamera/mikrofon hanya saat gerbang dibuka untuk jenis itu, maksimal 300 dtk, ditutup saat halaman dimuat ulang, tidak pernah `Default` |
| Kunci API global (`lib/media/browser.ts`, dipanggil di `main.tsx`) | `navigator.mediaDevices.getUserMedia`/`getDisplayMedia` diganti fungsi yang selalu `NotAllowedError`; fungsi asli hanya dipegang modul media |
| Sesi media (`lib/media/session.ts`) | Gerbang dibuka tepat sebelum permintaan dan ditutup segera setelahnya; semua *track* dihentikan saat selesai, batas waktu 120 dtk, pindah halaman, `pagehide`/`beforeunload` |
| Info.plist | `NSCameraUsageDescription` dan `NSMicrophoneUsageDescription` (bahasa Indonesia), ada di bundle dan tertanam di binary dev |
| Penjaga statis (`guard.test.ts`) | API capture hanya boleh muncul di `src/lib/media/` |

### 15.2 Hasil verifikasi
| Pemeriksaan | Dev (`http://localhost`) | Produksi (`tauri://localhost`) |
|---|---|---|
| *Secure context*, `getUserMedia` tersedia | ✅ ya | ✅ ya — tes kamera/mikrofon lewat WebView memungkinkan |
| Permintaan saat gerbang tertutup (kamera, mikrofon, keduanya) | tidak diuji (TCC dev dikaitkan ke aplikasi induk) | ✅ semua `NotAllowedError`; handler mencatat penolakan |
| API global terkunci | — | ✅ ditolak; **tidak ada** permintaan TCC kamera/mikrofon di log selama jeda 2 dtk setelahnya |
| Gerbang setelah pemeriksaan / sesi aktif | tertutup / 0 | tertutup / 0 |
| Proses tersisa setelah keluar | tidak ada | tidak ada |
| Input Monitoring (`kTCCServiceListenEvent`) | — | hanya *preflight*, tidak pernah diminta |

### 15.3 Temuan keamanan
1. **Bawaan wry mengizinkan semua permintaan media** bila handler tidak dipasang. Sudah ditutup oleh handler tolak-default.
2. **WebKit menanyakan TCC macOS sebelum handler izin aplikasi.** Bila izin aplikasi belum pernah diputuskan, dialog macOS tetap muncul walau gerbang menolak. Gerbang hanya mencegah stream sampai ke halaman, tidak mencegah dialog. Mitigasinya kunci API global, sehingga hanya modul media yang bisa memicu dialog, dan modul itu hanya dipakai saat pengguna memulai tes.
   - *Kejadian saat verifikasi:* uji penolakan memunculkan dialog kamera dan mikrofon dua kali: build pertama pukul 13:39 dan build ulang pukul 13:45. Menurut log TCC, keempatnya dijawab **Izinkan**. Stream tidak pernah diterima halaman, dan log tidak menunjukkan stream kamera dimulai.
   - *Mencabut izin* (dilakukan pemilik): System Settings › Privacy & Security › Camera/Microphone, atau `tccutil reset Camera com.ezraanugrah.laptophealthcheck` dan `tccutil reset Microphone com.ezraanugrah.laptophealthcheck`.
3. **WebKit mengingat penolakan per halaman.** Setelah satu permintaan ditolak, permintaan sejenis berikutnya ikut ditolak tanpa bertanya lagi (3 permintaan, 2 keputusan handler). Akibatnya, tes kamera/mikrofon harus meminta akses sekali per sesi. Bila ditolak, hasilnya Tidak tersedia dengan petunjuk membuka ulang aplikasi.
4. **Build tanpa tanda tangan = identitas TCC baru.** Setiap build ulang meminta izin lagi (terbukti). Di Mac lain (portable/DMG), dialog muncul saat pertama dipakai. Identitas izin yang stabil butuh *code signing* (Fase 5).
5. **Belum terverifikasi:** apakah WebKit mengingat *izin yang diberikan*, sehingga permintaan ulang setelah gerbang ditutup lolos tanpa handler. Pemeriksaannya `LHC_SELFCHECK=media-interactive` (kamera menyala ±3 dtk lalu mikrofon). Perlu persetujuan dan kehadiran pemilik.

### 15.4 Keputusan
- Pembatasan akses di tingkat WebView **aman dan terverifikasi** untuk jalur tolak. Fitur yang tidak memakai media (Layar, Keyboard) dilanjutkan.
- ~~T5–T7 ditahan sampai temuan 5 diverifikasi.~~ Temuan 5 **terbukti** (Tes A pertama, 19 Nov 2026 14:02). Masalahnya diperbaiki dengan jendela media terpisah dan sudah diverifikasi ulang (§15.5). T5–T7 boleh dibuat dengan syarat semua akses media lewat jendela itu. Bila permintaan ulang ternyata lolos, alternatifnya:
  - (a) halaman dimuat ulang setelah setiap sesi media agar cache WebKit hilang;
  - (b) capture native AVFoundation lewat FFI (usaha besar);
  - (c) tes kamera/mikrofon hanya berupa deteksi perangkat (`system_profiler`) + konfirmasi pengguna lewat aplikasi bawaan macOS yang dibuka pengguna sendiri.
- ⌘Q tidak bisa ditahan (tao tidak menangani `applicationShouldTerminate`), sehingga D6 diganti peringatan di layar Tes Keyboard.
- Lima status hasil ditetapkan pemilik: Belum diuji, Lulus, Gagal, Tidak tersedia, Dibatalkan (§4).

### 15.5 Perbaikan: jendela media terpisah + verifikasi manual (19 Nov 2026)

**Temuan Tes A pertama (14:02):**
- WebKit mengingat izin kamera yang sudah diberikan selama halaman masih terbuka.
- Setelah gerbang ditutup, permintaan ulang dari halaman yang sama lolos **tanpa** handler ditanya. Log: sesi kamera dimulai lagi pukul 14:02:35,46.
- Pengujian dihentikan saat itu juga.

**Perbaikan (`src-tauri/src/media_window.rs`, `src/lib/media/window-session.ts`, `src/pages/MediaWindowPage.tsx`):**

| Aturan | Isi |
|---|---|
| Jendela utama (`main`) | Selalu ditolak untuk kamera/mikrofon dan tidak bisa membuka gerbang (handler memeriksa label webview) |
| Jendela tes media (`media-test`) | Dibuat per sesi hanya dari jendela utama setelah tindakan pengguna. *Incognito* (`WKWebsiteDataStore.nonPersistentDataStore` baru per jendela). Dihancurkan setelah melapor, saat ditutup pengguna, atau saat dibatalkan dari jendela utama |
| Gerbang | Hanya bisa dibuka dari jendela tes media, untuk tugas `Session`, dan untuk jenis yang ditugaskan |
| Penghentian | Tombol "Hentikan sekarang" (`accept_first_mouse` + fokus otomatis), Esc, dan batas waktu 10 dtk, dicatat terpisah |

**Hasil verifikasi (build produksi `.app`, MacBookPro16,2, macOS 26):**

| Tes | Akses media | Hasil |
|---|---|---|
| Isolasi otomatis (`media-isolation`) | tidak ada | ✅ Jendela utama tidak bisa membuka gerbang. Jendela latihan tidak bisa membuka gerbang. Penyimpanan tidak dibagi (probe `localStorage`). Batas waktu dan pembatalan bekerja. 0 dialog, 0 stream |
| Tes 0, latihan tombol (`media-dryrun`) | tidak ada | ✅ Berhenti oleh tombol setelah 1,6 dtk; 0 dialog, 0 stream |
| Tes A, kamera (`media-camera`) | kamera, ±6 dtk | ✅ Satu stream (14:24:44–14:24:50) dihentikan lewat tombol. Uji ulang dari jendela utama dan dari jendela baru tanpa gerbang ditolak (handler ditanya); tidak ada stream kedua |
| Tes B, mikrofon (`media-microphone`) | mikrofon, ±2 dtk | ✅ Input audio 14:27:08,8–14:27:10,2 dihentikan lewat tombol. Kedua uji ulang ditolak; tidak ada input audio kedua |
| Tes C, penolakan (`media-deny`) | tidak ada (diminta, ditolak) | ✅ Peluncuran baru dengan izin macOS sudah diberikan: API terkunci dan permintaan jendela utama ditolak; 0 dialog, 0 stream, 0 input audio |

Semua tes: tidak ada file media baru, tidak ada kode jaringan, dan tidak ada proses tersisa.

**Masih perlu konfirmasi pemilik:** pengamatan lampu kamera dan titik oranye. Log macOS tidak menunjukkan stream/input kedua.

**Catatan:**
- Jendela utama masih memakai data store WebKit persisten, yang menulis metadata standar di `~/Library/WebKit/com.ezraanugrah.laptophealthcheck`.
- Untuk mode portable tanpa jejak, pertimbangkan *incognito* untuk jendela utama juga (Fase 5).
- Izin TCC untuk build tanpa tanda tangan diminta ulang setiap build (temuan 4).
