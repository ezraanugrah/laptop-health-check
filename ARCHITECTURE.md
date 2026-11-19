# Arsitektur — Laptop Health Check (khusus macOS)

Status: Fase 2 (macOS Core Diagnostics) ada di `main`. Penyesuaian scope khusus macOS sedang dikerjakan di branch `feature/macos-only`. Dokumen ini menjelaskan struktur saat ini dan rencana yang sudah disepakati. Rencana Fase 3 dijelaskan di [`docs/FASE3-INTERACTIVE-TESTING-PRD.md`](docs/FASE3-INTERACTIVE-TESTING-PRD.md).

## 1. Gambaran umum

```
┌──────────────────────────── Jendela Tauri (WKWebView macOS) ───────────────────────────┐
│  Frontend: React 19 + TypeScript + Tailwind CSS v4 (dibundel Vite, 100% lokal)          │
│  App.tsx ─ Sidebar ─ pages/* ─ components/*                                             │
│        │  lib/api.ts  (invoke bertipe)                                                  │
└────────┼────────────────────────────────────────────────────────────────────────────────┘
         │ IPC Tauri (JSON, camelCase)
┌────────▼──────────────────────────── Backend Rust (src-tauri) ──────────────────────────┐
│  commands.rs        : command tipis + spawn_blocking                                    │
│  diagnostics/       : PENILAIAN (data mentah -> CheckResult/Status), tanpa API OS       │
│  platform/          : PEMBACAAN data mentah, dipilih saat kompilasi                     │
│     ├─ macos/          sw_vers, sysctl, ioreg, system_profiler, diskutil(+plutil),      │
│     │                  vm_stat, pmset, profiles, Mach host_statistics, SMC (read-only)  │
│     ├─ unsupported.rs  fallback OS selain macOS (selalu error → Unknown), bukan target  │
│     └─ fake.rs         platform palsu KHUSUS TEST                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Prinsip utama:
1. **Baca terpisah dari nilai.** `platform` hanya membaca fakta mentah (`diagnostics/raw.rs`), sedangkan `diagnostics` yang memutuskan status. Logika penilaian dites tanpa hardware asli.
2. **Hanya data nyata.** Tidak ada nilai pengganti atau simulasi di jalur produksi. Data yang tidak tersedia menjadi `None`/`ProbeError`, lalu dinilai **Unknown** beserta alasannya. Data yang tidak tersedia tidak pernah dianggap sehat.
3. **Offline total, read-only, tanpa admin.** Tidak ada kode jaringan dan tidak ada operasi tulis ke hardware.
4. **Dependency minimal.** Fase 2 tidak menambah crate atau paket npm apa pun (lihat §11).

## 2. Struktur folder

```
.
├─ index.html, vite.config.ts, tsconfig*.json, package.json
├─ .github/workflows/ci.yml            CI macOS Intel + arm64 (read-only, action dipin SHA)
├─ scripts/capture-macos-fixtures.sh   Ambil output sistem + sanitasi serial/UUID/EDID
├─ src/                                Frontend
│  ├─ main.tsx, App.tsx, index.css
│  ├─ types/diagnostics.ts             Cermin tipe Rust (wajib sinkron)
│  ├─ lib/api.ts                       Wrapper invoke bertipe + deteksi mode desktop
│  ├─ lib/status.ts (+ .test.ts)       Helper murni: label status, judul, urutan, cakupan
│  ├─ lib/interactive/                 Tes Interaktif: outcome, display, keyboard (+ test)
│  ├─ lib/media/                       Sesi kamera/mikrofon + pemeriksaan izin (+ test)
│  ├─ types/interactive.ts             Tipe hasil tes + cermin GateStatus/LaunchMode/DeviceProfile
│  ├─ i18n/                            ui.ts & backend.ts (katalog id/en), translate.ts (inti), test
│  ├─ lib/preferences.tsx, settings.ts Provider tema/bahasa + pembersih pengaturan
│  ├─ components/                      Sidebar, StatusBadge, CheckCard, SerialNumberRow
│  │  └─ interactive/                  TestCard, DisplayTest, KeyboardTest
│  └─ pages/                           DashboardPage, InteractiveTestsPage, SelfCheckPage, AboutPage, ComingSoonPage
├─ src-tauri/
│  ├─ tauri.conf.json, capabilities/default.json, Cargo.toml
│  ├─ Info.plist                       Usage description kamera/mikrofon (TCC)
│  ├─ fixtures/macos/<perangkat>/      Output asli tersanitasi untuk test parser
│  └─ src/
│     ├─ main.rs, lib.rs, commands.rs
│     ├─ media_gate.rs     gerbang izin kamera/mikrofon WebView (tolak secara default)
│     ├─ selfcheck.rs      mode verifikasi izin media (LHC_SELFCHECK)
│     ├─ media_window.rs   jendela tes media terpisah (per sesi, incognito)
│     ├─ settings.rs       preferensi tema/bahasa (settings.json lokal)
│     ├─ diagnostics/
│     │  ├─ mod.rs        run_all (probe paralel), hardware_summary
│     │  ├─ types.rs      tipe IPC (CheckId, CheckCategory, Status, Reason, CheckResult, ...)
│     │  ├─ raw.rs        data mentah dari platform (khusus macOS)
│     │  ├─ findings.rs   pengumpul bukti -> status + alasan
│     │  ├─ format.rs     format angka untuk tampilan
│     │  ├─ text.rs       pesan berkode untuk i18n (`Text`, makro `tr!`)
│     │  ├─ device_profile.rs  model + Touch Bar (tabel model tetap)
│     │  └─ system, battery, storage, memory, cpu, temperature, fans, gpu, ownership .rs
│     └─ platform/
│        ├─ mod.rs        trait Platform, ProbeError, alias Current
│        ├─ macos/        mod, command, parse, system, battery, storage, memory,
│        │                cpu, gpu, ownership, smc, sensors
│        ├─ unsupported.rs, fake.rs
├─ docs/                               GIT-WORKFLOW, PRD Fase 3, archive/windows (riwayat)
└─ PRD.md, ARCHITECTURE.md, ROADMAP.md, TASKS.md, CLAUDE.md
```

## 3. Kontrak IPC

| Command | Hasil | Keterangan |
|---|---|---|
| `get_app_info` | `AppInfo` | Nama, versi, OS, arsitektur build, dan `support` (verified/preview) |
| `run_diagnostics` | `DiagnosticsReport` | Menjalankan 9 pemeriksaan (probe paralel, ±1,2 detik di Mac Intel) |
| `get_serial_number` | `string \| null` | **Opt-in**: hanya dipanggil saat pengguna menekan "Tampilkan" |
| `get_device_profile` | `DeviceProfile` | Model (`hw.model`) dan Touch Bar (`true`/`false`/`null` = tidak diketahui) untuk Tes Interaktif |
| `set_window_fullscreen` | — | Layar penuh *simple fullscreen* jendela aplikasi untuk Tes Layar; tidak mengubah pengaturan tampilan sistem |
| `media_gate_open(camera, microphone)` / `media_gate_close` / `media_gate_status` | `GateStatus` | Gerbang izin kamera/mikrofon (§7.1). Hanya dipakai `lib/media/session.ts` |
| `open_media_window(kind, purpose, holdMs)` / `get_media_task` / `focus_media_window` / `finish_media_session` / `cancel_media_window` / `media_window_open` | `MediaTask` / … | Jendela tes media terpisah (§7.1). `open`/`cancel` hanya dari jendela utama; `finish`/`focus` hanya dari jendela media |
| `get_settings` / `save_settings(settings)` | `Settings` | Preferensi tema/bahasa di `settings.json` lokal (§12). Default Gelap + Bahasa Indonesia |
| `get_launch_mode` / `report_selfcheck` | `LaunchMode` / — | Mode pemeriksaan izin media (`LHC_SELFCHECK`, §7.1). `report_selfcheck` ditolak di mode normal |

Command yang memblokir memakai `async` + `spawn_blocking`. Error dikirim sebagai `string`. Log debug hanya mencatat nama command dan status, tidak pernah nomor seri.

## 4. Model data

Tipe ada di `src-tauri/src/diagnostics/types.rs` dan dicerminkan di `src/types/diagnostics.ts`. Serde memakai `camelCase`.

- `CheckId`: `system | battery | storage | memory | cpu | temperature | fans | gpu | ownership`
- `Status`: `healthy | warning | critical | unknown | notApplicable`
  - Label UI: **Sehat**, **Peringatan**, **Kritis**, **Tidak diketahui**, **Tidak berlaku**.
- `CheckCategory`:
  - `coreHardware`: baterai, SSD/HDD, RAM, CPU.
  - `supplementaryHardware`: suhu, kipas, GPU.
  - `deviceSecurity`: sistem dan Activation Lock/MDM. Kelompok ini tidak memengaruhi kesimpulan kesehatan hardware.
- `CheckResult { id, category, status, summary, reasons: Reason[], metrics: Metric[], sources: string[], notes: string[] }`
  - `Reason { level: critical | warning | ok | info, text }`: bukti di balik status.
  - `Metric { label, value, experimental }`: field `experimental` disiapkan untuk data yang belum terverifikasi di hardware asli (mis. sensor Apple Silicon). Bila `true`, metrik diberi label di UI dan **tidak pernah mengubah status**. Saat ini belum ada metrik macOS yang eksperimental (dijaga test `metrics_are_never_experimental_yet`).
  - `sources` dan `notes` disediakan lapisan platform (`Platform::sources`, `Platform::notes`).
- `DiagnosticsReport { hardware: HardwareSummary, generatedAt, durationMs, checks }`
- **`HardwareSummary { status, measured, total, missingCore, missingSupplementary }`** (`hardware_summary`). Status ditentukan dengan urutan berikut:
  1. Ada Kritis → **Kritis**.
  2. Selain itu, ada Peringatan → **Peringatan**. Temuan tetap ditampilkan walau data belum lengkap.
  3. Selain itu, ada pemeriksaan inti yang Tidak diketahui → **Pemeriksaan belum lengkap** (`incomplete`). Kondisi ini tidak pernah disimpulkan sehat.
  4. Selain itu → **Sehat**. Pemeriksaan pelengkap yang tidak terukur hanya dicatat di cakupan.
  - `notApplicable` dihitung sebagai terukur.
- `AppInfo.support: PlatformSupport { level: verified | preview, note }`:
  - Mac Intel (`x86_64`) = `verified`.
  - Apple Silicon (`aarch64`) = `preview`, dan UI menampilkan banner pratinjau sampai lolos uji L3.
- **Aturan `Healthy`** (`Findings::status(has_core_evidence)`): status Sehat hanya diberikan bila ada bukti inti. Contohnya kapasitas baterai terukur, SMART "Verified", atau sensor suhu terbaca.
- **Model mentah** (`raw.rs`) khusus macOS. Contohnya:
  - kapasitas baterai dalam mAh dari `AppleSmartBattery`;
  - SMART dari `diskutil`;
  - tekanan memori dari `memorystatus_vm_pressure_level`;
  - `graphics_api` (Metal);
  - kepemilikan: `activation_lock_enabled`, `provisioning_enrolled` (DEP), dan `mdm_enrolled`.
  - Tidak ada field untuk nama organisasi, nama komputer, maupun nama pengguna.

## 5. Abstraksi platform

```rust
pub trait Platform {
    fn system_overview() -> Result<SystemOverview, ProbeError>;
    fn battery() -> Result<Option<BatteryInfo>, ProbeError>; // None = tanpa baterai
    fn storage() -> Result<Vec<DiskInfo>, ProbeError>;
    fn memory() -> Result<MemoryInfo, ProbeError>;
    fn cpu() -> Result<CpuInfo, ProbeError>;                  // termasuk sampel beban 1 dtk
    fn sensors() -> Result<SensorReadings, ProbeError>;       // suhu + kipas, read-only
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError>;
    fn ownership() -> Result<OwnershipInfo, ProbeError>;
    fn serial_number() -> Result<Option<String>, ProbeError>; // opt-in
    fn sources(check: CheckId) -> &'static [&'static str];
    fn notes(check: CheckId) -> &'static [&'static str];     // keterbatasan deteksi
    fn support() -> PlatformSupport;                         // verified / preview
}
```

- `run_all::<P: Platform>()` menjalankan 8 probe paralel (`std::thread::scope`). Probe yang panik diubah menjadi `ProbeError`, jadi aplikasi tidak ikut jatuh.
- `platform::Current` = `macos::MacOs` di macOS. Di OS lain, `unsupported::Unsupported` hanya menjaga crate tetap terkompilasi; semua probe mengembalikan error sehingga hasilnya **Unknown**. Ini bukan target dukungan.
- Perintah sistem dipanggil dengan **path absolut** dan **batas waktu 20 detik**, tanpa shell.

### Cara menambah pemeriksaan
1. Tambah struct data mentah di `raw.rs` dan method di trait `Platform`.
2. Implementasikan di `platform/macos/<modul>.rs` dengan **parser murni** (`parse(...)`), lalu di `unsupported.rs` dan `fake.rs`.
3. Ambil fixture asli dengan `sh scripts/capture-macos-fixtures.sh <perangkat>`, lalu tes parser terhadap fixture tersebut.
4. Buat `diagnostics/<modul>.rs` yang berisi konstanta ambang, `evaluate(&Result<..>)`, dan `assess(..)` memakai `Findings`. Uji **setiap batas** ambang.
5. Daftarkan di `run_all`, `CheckId`, `CheckCategory`, `sources()`/`notes()`, tipe TypeScript, serta `CHECK_ORDER`/judul di `lib/status.ts`.

## 6. Sumber data macOS

| Data | Sumber (tanpa admin) | Catatan/risiko |
|---|---|---|
| Sistem | `sw_vers`, `sysctl` | — |
| Baterai | `ioreg -rn AppleSmartBattery` (mAh, siklus, suhu, PermanentFailure) + `system_profiler SPPowerDataType` (kondisi macOS) | Apple Silicon: kapasitas via `AppleRawMaxCapacity` belum diverifikasi |
| SSD/HDD | `diskutil list/info -plist` (dikonversi `plutil`) + `system_profiler SPNVMeDataType/SPSerialATADataType` | Keausan, TBW, dan jam pakai tidak tersedia tanpa admin |
| RAM | `sysctl` (memsize, swapusage, memorystatus_vm_pressure_level), `vm_stat`, `system_profiler SPMemoryDataType` | Kerusakan sel RAM tidak bisa diuji dari OS |
| CPU | `sysctl`, Mach `host_statistics` (beban), `pmset -g therm` (batas kecepatan, peringatan) | Apple Silicon tidak mencetak `CPU_Speed_Limit` |
| Suhu | SMC via IOKit (read-only) + suhu baterai `ioreg` | SMC tidak didokumentasikan; pola sensor Apple Silicon belum diverifikasi |
| Kipas | SMC `FNum`, `F{n}Ac/Mn/Mx` | Mac tanpa kipas = Tidak berlaku |
| GPU | `system_profiler SPDisplaysDataType` | Tidak ada metrik resmi "kesehatan GPU" |
| Activation Lock & MDM | `system_profiler SPHardwareDataType` (`activation_lock_status`), `profiles status -type enrollment` | Bukan jaminan; keterbatasan selalu ditampilkan |
| Nomor seri | `ioreg IOPlatformExpertDevice` (opt-in) | Hanya dibaca atas permintaan |

Rencana sumber data Fase 3 (audio, kamera, Wi-Fi, Bluetooth, USB/Thunderbolt) ada di PRD Fase 3 §6.

### SMC (read-only)
- `platform/macos/smc.rs` memakai FFI IOKit buatan sendiri (tanpa crate). Hanya perintah `READ_KEYINFO` (9), `READ_BYTES` (5), dan `READ_INDEX` (8) yang **didefinisikan**. Perintah tulis tidak ada di kode.
- Ukuran struct parameter dikunci 80 byte dengan `const assert`. Bila layanan SMC tidak ada atau tidak kompatibel, hasilnya `ProbeError` dan kartu menampilkan **Unknown** beserta kendalanya.
- Sensor terverifikasi di MacBookPro16,2 (Intel): CPU `TC0E TC0F TC0P TC1C–TC4C TCXC`, baterai `TB0T–TB2T`, dan 2 kipas (nilai `flt`). Tidak ada sensor GPU terpisah.
- Apple Silicon memakai pola `Tp**`/`Te**` (CPU), `Tg**` (GPU), dan `TB*T`, yang aktif hanya di arsitektur `aarch64`. Pola ini **belum diverifikasi**.

## 7. Offline dan keamanan

- **CSP produksi**: `default-src 'self'`, `connect-src` hanya untuk IPC, `object-src 'none'`, `frame-ancestors 'none'`. Sudah terverifikasi lewat build ber-aset tertanam di Fase 1. `devCsp: null` untuk HMR Vite.
- **`freezePrototype: true`**, capabilities minimal (`core:default`, `opener:default`).
- Tanpa plugin `http`/`updater`/analytics, tanpa akun, dan tanpa telemetri. Informasi perangkat tidak dikirim tanpa persetujuan eksplisit.
- **Nomor seri**: command terpisah dan opt-in. Tidak disimpan di laporan dan tidak dicatat di log. `ownership.rs` hanya mengambil `activation_lock_status` dari `SPHardwareDataType`, sedangkan nomor seri dari output yang sama langsung dibuang.
- **Read-only**: tidak ada operasi tulis ke SMC, kipas, daya, maupun konfigurasi sistem.
- **CI**: `permissions: contents: read`, tanpa secret, action dipin ke commit SHA, tidak membuat tag/release/PR.

### 7.1 Izin kamera/mikrofon (Fase 3.0)

- **Masalah bawaan**: tanpa handler, wry 0.57 menjawab `requestMediaCapturePermission` WKWebView dengan *Grant* untuk semua origin.
- **Gerbang izin** (`src-tauri/src/media_gate.rs`, dipasang di `tauri::Builder::on_permission_request`):
  - semua jenis izin WebView selain kamera/mikrofon selalu **ditolak**;
  - kamera/mikrofon hanya diizinkan saat gerbang dibuka untuk jenis tersebut, paling lama `MAX_OPEN_SECS` (300 dtk);
  - handler tidak pernah menjawab `Default`, karena di macOS jawaban itu memunculkan dialog WebKit sendiri;
  - gerbang ditutup saat halaman mulai dimuat (`on_page_load`).
- **Jendela tes media terpisah** (`src-tauri/src/media_window.rs`):
  - WebKit mengingat izin yang sudah diberikan selama halaman terbuka (terbukti di Tes A pertama), sehingga gerbang saja tidak cukup;
  - kamera/mikrofon hanya diminta di jendela `media-test`, yang dibuat per sesi dari jendela utama, memakai *incognito* (data store baru), dan dihancurkan setelah sesi;
  - jendela utama selalu ditolak dan tidak bisa membuka gerbang;
  - event `media-session-finished` memberi tahu jendela utama, termasuk bila jendela tes ditutup pengguna.
- **Sesi media** (`src/lib/media/session.ts`):
  - gerbang dibuka tepat sebelum `getUserMedia` dan ditutup segera setelah permintaan selesai, baik berhasil maupun gagal;
  - hanya jenis yang diminta yang masuk constraint;
  - `release()` menghentikan semua *track* dan dipanggil otomatis saat batas waktu sesi (120 dtk) habis, saat pindah halaman, dan saat `pagehide`/`beforeunload`;
  - tidak ada perekaman ke file.
- **Kunci API global** (`lib/media/browser.ts`, dipanggil pertama di `main.tsx`): `navigator.mediaDevices.getUserMedia`/`getDisplayMedia` diganti fungsi yang selalu menolak, dan fungsi aslinya hanya dipegang modul media. Alasannya: **WebKit menanyakan TCC sebelum handler izin** (terbukti di build produksi), sehingga pemanggilan yang tidak disengaja tetap bisa memunculkan dialog macOS walau gerbang menolak. Penjaga statis (`guard.test.ts`) memastikan API capture hanya muncul di `src/lib/media/`.
- **TCC macOS** tetap berlaku di atas gerbang. `src-tauri/Info.plist` berisi `NSCameraUsageDescription` dan `NSMicrophoneUsageDescription` dalam bahasa Indonesia. Tauri menyematkannya ke binary saat `tauri dev` dan menggabungkannya ke `Contents/Info.plist` bundle. Aplikasi tidak pernah mengubah pengaturan privasi.
- **Verifikasi** dengan `LHC_SELFCHECK=media-passive|media-deny|media-interactive` (`src-tauri/src/selfcheck.rs`, `src/lib/media/selfcheck.ts`):
  - hasil dicetak sebagai `[selfcheck] {json}` berisi jumlah dan status saja, tanpa label atau ID perangkat;
  - setelah itu aplikasi keluar;
  - variabel ini hanya bisa diset dari Terminal, tidak pernah saat aplikasi dibuka dari Finder.

## 8. Penyimpanan data dan mode portable (rencana Fase 4–5)

- **Installer (DMG)**: data aplikasi (riwayat, laporan) disimpan di direktori data milik macOS lewat API path Tauri.
- **Portable**: aktif bila ada file penanda `portable` di samping `.app`. Data dan laporan disimpan di `LaptopHealthCheck-Data/` di flashdisk. Jika folder itu tidak bisa ditulisi, aplikasi beralih ke folder sementara dan memberi tahu pengguna.
- **Risiko**: aplikasi tanpa tanda tangan yang dikarantina dapat dijalankan macOS dari lokasi acak yang read-only (*App Translocation*), sehingga aplikasi tidak bisa menemukan folder di sampingnya. Hal ini dikaji di Fase 5 bersama keputusan *code signing*.
- **Laporan (Fase 4)**: JSON dari `DiagnosticsReport` ditambah hasil interaktif. PDF dibuat lokal. Nomor seri hanya disertakan bila dipilih.

## 9. Packaging dan build

| Target | Perintah | Catatan |
|---|---|---|
| macOS (arsitektur mesin build) | `npm run tauri build` | `.app` + `.dmg` (`bundle.targets: ["app", "dmg"]`) |
| Apple Silicon dari Mac Intel | `npm run tauri build -- --target aarch64-apple-darwin` | Butuh `rustup target add aarch64-apple-darwin` (ditunda karena disk) |
| Universal | `npm run tauri build -- --target universal-apple-darwin` | Butuh kedua target; keputusan di Fase 5 |

**Hemat disk**: profil `dev` mengompilasi dependency tanpa debuginfo. Folder `target` dibersihkan (`cargo clean`) setelah verifikasi.

## 10. Strategi testing

| Lapisan | Alat | Cakupan |
|---|---|---|
| Parser macOS | `cargo test` + fixture asli tersanitasi (`fixtures/macos/intel-macbookpro16-2`) | ioreg, system_profiler, diskutil, vm_stat, swapusage, pmset, profiles |
| Format Apple Silicon | `cargo test` dengan contoh format **berlabel "bukan data perangkat asli"** | Struktur JSON/teks yang berbeda di Apple Silicon |
| Logika penilaian | `cargo test` + `platform::fake` | **Setiap batas** ambang (mis. kapasitas 80,0/79,9/60,0/59,9%) |
| Integrasi perangkat asli | `cargo test` (otomatis) + `cargo test -- --ignored` (SMC, laporan nyata) | Membaca Mac asli tanpa admin |
| CI (L0–L2) | GitHub Actions `macos-intel` (macos-15-intel) + `macos-arm64` (macos-latest) | Typecheck, test, build, fmt, clippy, cargo test, smoke `dump_real_report` di VM. **Bukan bukti hardware asli** |
| Helper frontend | `node --test` | `src/lib/status.ts` |
| Tipe & lint | `tsc --noEmit`, `cargo clippy --all-targets -D warnings`, `cargo fmt --check` | Seluruh kode |
| End-to-end | `npm run tauri dev` | Jendela muncul, diagnostik berjalan otomatis, dan log menampilkan status per pemeriksaan |

## 11. Keputusan arsitektur (ADR singkat)

| # | Keputusan | Alasan | Tinjau ulang bila |
|---|---|---|---|
| 1 | Tanpa router/state library | Hanya beberapa halaman, hemat dependency | Alur makin kompleks |
| 2 | Tipe TypeScript ditulis manual, dijaga test JSON | Menghindari `ts-rs`/`specta` | Tipe bertambah banyak |
| 3 | Utilitas macOS bawaan sebagai sumber data utama | Nol dependency, tanpa admin | Butuh data yang hanya ada di API native |
| 4 | `node --test` sebagai pengganti Vitest/Jest | Nol dependency | Butuh test komponen React |
| 5 | Pemilihan platform saat kompilasi (`cfg` + trait) | Kontrak dipaksa compiler; fake platform untuk test | — |
| 6 | Profil dev tanpa debuginfo dependency | Disk mesin dev terbatas | Perlu debug ke dalam dependency |
| 7 | ~~WebView2 offline installer~~ | Dibatalkan: scope khusus macOS | — |
| 8 | ~~Portable Windows: deteksi WebView2~~ | Dibatalkan: scope khusus macOS | — |
| 9 | Nomor seri lewat command terpisah, opt-in | Privasi default | — |
| 10 | Plist dikonversi dengan `plutil` bawaan, bukan crate `plist` | Nol dependency | `plutil` tidak tersedia/berubah |
| 11 | FFI IOKit/Mach ditulis sendiri (SMC, `host_statistics`), bukan crate | Nol dependency; bisa diaudit (read-only) | Banyak API native lain dibutuhkan |
| 12 | Probe dijalankan paralel (`thread::scope`) | Total ±1,2 dtk vs ±4 dtk berurutan | — |
| 13 | Ambang suhu/kipas bergantung beban CPU yang diukur | Hindari alarm palsu saat beban tinggi | Ada data lapangan yang lebih baik |
| 14 | Disk eksternal tidak dinilai | Flashdisk portable (SMART tidak didukung) tidak boleh membuat status "Tidak diketahui" | — |
| 15 | Scope khusus macOS (19 Nov 2026): kode Windows dikeluarkan, model kategori/`HardwareSummary`/`PlatformSupport` dari Milestone 3.0 dipertahankan | Keputusan pemilik; mengurangi kompleksitas dan kode yang tidak terverifikasi | — |
| 16 | `unsupported.rs` dipertahankan sebagai fallback OS lain | Crate tetap terkompilasi tanpa `cfg` berserakan; selalu Unknown | — |

## 12. Tampilan (tema) dan bahasa (i18n)

**Tema.**
- Tailwind memakai varian `dark` berbasis kelas (`@custom-variant dark` di `index.css`), bukan `prefers-color-scheme`.
- `PreferencesProvider` (`src/lib/preferences.tsx`) memasang kelas `dark` dan atribut `lang` pada `<html>`, sehingga perubahan terlihat seketika tanpa restart.
- Default **Gelap**, sudah ditetapkan di `index.html` agar tidak berkedip saat dibuka.
- Tidak ada style inline (CSP).

**Preferensi.**
- Disimpan sebagai `{ "theme": "dark"|"light", "language": "id-ID"|"en-US" }` di `~/Library/Application Support/com.ezraanugrah.laptophealthcheck/settings.json` (`src-tauri/src/settings.rs`). Penulisannya atomik (file sementara lalu `rename`).
- Nilai rusak atau tidak dikenal jatuh ke default per field.
- Jendela utama memakai penyimpanan WebKit sementara (*incognito*), jadi preferensi tidak disimpan di `localStorage`. Pengecualian: mode browser pratinjau.
- Tidak pernah dikirim ke mana pun. Untuk mode portable (Fase 5), lokasi file akan dipindah ke samping aplikasi.

**i18n terpusat** (`src/i18n`):
- `ui.ts` berisi teks antarmuka, dan `backend.ts` berisi pesan dari Rust.
- Setiap entri `{ id, en }` ditulis berdampingan. Kelengkapan kunci UI dicek TypeScript (`UiKey`).
- `translate.ts` adalah satu-satunya tempat bahasa dipilih. Urutan fallback: bahasa aktif → Indonesia → teks Indonesia dari backend → nama kunci (kunci yang hilang dicatat).
- Parameter `@kunci` diterjemahkan bertingkat, dan parameter berupa daftar digabung otomatis.
- Format tanggal dan durasi mengikuti bahasa.

**Backend berkode** (`diagnostics/text.rs`):
- Ringkasan, alasan, label/nilai metrik, catatan keterbatasan, dan catatan dukungan membawa `code` + `params`, di samping `text` Indonesia sebagai fallback dan untuk log/JSON. Contoh: `tr!("battery.reason.capacityWarning", teks, pct = …, limit = …)`.
- Logika penilaian tidak bergantung pada teks. Terbukti: laporan Mac asli sebelum dan sesudah refactor identik untuk 75 dari 75 teks, dengan angka diabaikan.
- Nama hardware, angka, nomor seri, dan perintah sumber data tidak diberi kode.
- Label metrik untuk salah satu dari beberapa perangkat membawa parameter `group` (mis. "disk0 · Type").

**Hasil Tes Interaktif** disimpan sebagai kode + parameter (`Evidence.code`, `summaryCode`), sehingga mengikuti bahasa saat diganti. Log verifikasi di terminal selalu dalam Bahasa Indonesia.

**Laporan PDF/JSON (Fase 4).** Karena laporan menyimpan kode, parameter, dan teks Indonesia, laporan bisa dirender dalam bahasa yang dipilih saat ekspor. Pelanggaran keamanan di laporan pemeriksaan izin juga berupa kunci yang netral bahasa.

**Test penjaga** (`src/i18n/i18n.test.ts`):
- setiap kode di Rust non-test ada di katalog dalam dua bahasa, dan tidak ada kunci yang tidak terpakai;
- placeholder id/en identik;
- tidak ada teks kosong;
- fallback dan kunci bertingkat bekerja.
