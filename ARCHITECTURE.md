# Arsitektur — Laptop Health Check

Status: Fase 2 (diagnostik inti macOS) selesai di branch `feature/core-diagnostics-macos`, menunggu persetujuan. Dokumen ini menjelaskan struktur saat ini dan rencana yang sudah disepakati.

## 1. Gambaran umum

```
┌──────────────────────────── Jendela Tauri (WebView sistem) ────────────────────────────┐
│  Frontend: React 19 + TypeScript + Tailwind CSS v4 (dibundel Vite, 100% lokal)          │
│  App.tsx ─ Sidebar ─ pages/* ─ components/*                                             │
│        │  lib/api.ts  (invoke bertipe)                                                  │
└────────┼────────────────────────────────────────────────────────────────────────────────┘
         │ IPC Tauri (JSON, camelCase)
┌────────▼──────────────────────────── Backend Rust (src-tauri) ──────────────────────────┐
│  commands.rs        : command tipis + spawn_blocking                                    │
│  diagnostics/       : PENILAIAN lintas platform (data mentah -> CheckResult/Status)     │
│  platform/          : PEMBACAAN data mentah per OS, dipilih saat kompilasi              │
│     ├─ macos/          sw_vers, sysctl, ioreg, system_profiler, diskutil(+plutil),      │
│     │                  vm_stat, pmset, profiles, Mach host_statistics, SMC (read-only)  │
│     ├─ windows.rs      kontrak saja; implementasi WMI/Win32 di Fase 3                   │
│     ├─ unsupported.rs  fallback (Linux ditunda)                                         │
│     └─ fake.rs         platform palsu KHUSUS TEST                                       │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Prinsip utama:
1. **Baca terpisah dari nilai.** `platform` hanya membaca fakta mentah (`diagnostics/raw.rs`). `diagnostics` yang memutuskan status. Logika penilaian dites tanpa hardware asli.
2. **Hanya data nyata.** Tidak ada nilai pengganti atau simulasi di jalur produksi. Data yang tidak tersedia menjadi `None`/`ProbeError`, lalu dinilai **Unknown** beserta alasannya. Data tidak tersedia tidak pernah dianggap sehat.
3. **Offline total, read-only, tanpa admin.** Tidak ada kode jaringan; tidak ada operasi tulis ke hardware.
4. **Dependency minimal.** Fase 2 tidak menambah crate atau paket npm apa pun (lihat §11).

## 2. Struktur folder

```
.
├─ index.html, vite.config.ts, tsconfig*.json, package.json
├─ scripts/capture-macos-fixtures.sh   Ambil output sistem + sanitasi serial/UUID/EDID
├─ src/                                Frontend
│  ├─ main.tsx, App.tsx, index.css
│  ├─ types/diagnostics.ts             Cermin tipe Rust (wajib sinkron)
│  ├─ lib/api.ts                       Wrapper invoke bertipe + deteksi mode desktop
│  ├─ lib/status.ts (+ .test.ts)       Helper murni: label status, urutan, format
│  ├─ components/                      Sidebar, StatusBadge, CheckCard, SerialNumberRow
│  └─ pages/                           DashboardPage, AboutPage, ComingSoonPage
├─ src-tauri/
│  ├─ tauri.conf.json, capabilities/default.json, Cargo.toml
│  ├─ fixtures/macos/<perangkat>/      Output asli tersanitasi untuk test parser
│  └─ src/
│     ├─ main.rs, lib.rs, commands.rs
│     ├─ diagnostics/
│     │  ├─ mod.rs        run_all (probe paralel), status keseluruhan
│     │  ├─ types.rs      tipe IPC (CheckId, Status, Reason, CheckResult, ...)
│     │  ├─ raw.rs        data mentah dari platform
│     │  ├─ findings.rs   pengumpul bukti -> status + alasan
│     │  ├─ format.rs     format angka untuk tampilan
│     │  └─ system, battery, storage, memory, cpu, temperature, fans, gpu, ownership .rs
│     └─ platform/
│        ├─ mod.rs        trait Platform, ProbeError, alias Current
│        ├─ macos/        mod, command, parse, system, battery, storage, memory,
│        │                cpu, gpu, ownership, smc, sensors
│        ├─ windows.rs, unsupported.rs, fake.rs
└─ PRD.md, ARCHITECTURE.md, ROADMAP.md, TASKS.md, CLAUDE.md
```

## 3. Kontrak IPC

| Command | Hasil | Keterangan |
|---|---|---|
| `get_app_info` | `AppInfo` | Nama, versi, OS, dan arsitektur build |
| `run_diagnostics` | `DiagnosticsReport` | Menjalankan 9 pemeriksaan (probe paralel, ±1,2 detik di Mac Intel) |
| `get_serial_number` | `string \| null` | **Opt-in**: hanya dipanggil saat pengguna menekan "Tampilkan" |

Command yang memblokir memakai `async` + `spawn_blocking`. Error dikirim sebagai `string`. Log debug hanya mencatat nama command dan status, tidak pernah nomor seri.

## 4. Model data

Tipe ada di `src-tauri/src/diagnostics/types.rs` dan dicerminkan di `src/types/diagnostics.ts`. Serde memakai `camelCase`.

- `CheckId`: `system | battery | storage | memory | cpu | temperature | fans | gpu | ownership`
- `Status`: `healthy | warning | critical | unknown | notApplicable`
  - Label UI: **Sehat**, **Peringatan**, **Kritis**, **Tidak diketahui**, **Tidak berlaku**.
- `CheckResult { id, status, summary, reasons: Reason[], metrics: Metric[], sources: string[], notes: string[] }`
  - `Reason { level: critical | warning | ok | info, text }`: bukti di balik status.
  - `sources`: sumber data yang dipakai (ditampilkan di kartu).
  - `notes`: keterbatasan deteksi (wajib untuk Activation Lock & MDM).
- `DiagnosticsReport { overall, generatedAt, durationMs, checks }`
- **Status keseluruhan** = status terburuk dengan urutan `healthy < unknown < warning < critical`. Status `notApplicable` tidak ikut dihitung. Jika ada satu saja yang `unknown` dan tidak ada yang lebih buruk, hasilnya `unknown`, bukan `healthy`.
- **Aturan `Healthy`** (`Findings::status(has_core_evidence)`): status Sehat hanya diberikan bila ada bukti inti. Contohnya kapasitas baterai terukur, SMART "Verified", atau sensor suhu CPU terbaca.

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
}
```

- `run_all::<P: Platform>()` menjalankan 8 probe paralel (`std::thread::scope`). Probe yang panik diubah menjadi `ProbeError`, jadi aplikasi tidak ikut jatuh.
- Setiap OS **wajib** mengimplementasikan semua method (dipaksa compiler). Windows mengembalikan error "dijadwalkan Fase 3", sehingga hasilnya **Unknown**.
- Perintah sistem dipanggil dengan **path absolut** dan **batas waktu 20 detik**, tanpa shell.

### Cara menambah pemeriksaan
1. Tambah struct data mentah di `raw.rs` dan method di trait `Platform`.
2. Implementasikan di `platform/macos/<modul>.rs` dengan **parser murni** (`parse(...)`), lalu di `windows.rs`, `unsupported.rs`, dan `fake.rs`.
3. Ambil fixture asli: `sh scripts/capture-macos-fixtures.sh <perangkat>`. Tes parser terhadap fixture.
4. Buat `diagnostics/<modul>.rs`: konstanta ambang, `evaluate(&Result<..>)`, `assess(..)` memakai `Findings`. Uji **setiap batas** ambang.
5. Daftarkan di `run_all`, `CheckId`, `sources()`, tipe TypeScript, dan `CHECK_ORDER`/`CHECK_TITLES`.

## 6. Sumber data per OS

| Data | macOS (Fase 2) | Windows 10/11 (Fase 3, rencana) | Catatan/risiko |
|---|---|---|---|
| Sistem | `sw_vers`, `sysctl` ✅ | WMI `Win32_OperatingSystem`, `Win32_ComputerSystem` | — |
| Baterai | `ioreg -rn AppleSmartBattery` (mAh, siklus, suhu, PermanentFailure) + `system_profiler SPPowerDataType` (kondisi macOS) ✅ | WMI `root\WMI` (`BatteryStaticData`, `BatteryFullChargedCapacity`, `BatteryCycleCount`) | Kelas WMI baterai berbeda antarvendor |
| SSD/HDD | `diskutil list/info -plist` (dikonversi `plutil`) + `system_profiler SPNVMeDataType/SPSerialATADataType` ✅ | `MSFT_PhysicalDisk` (HealthStatus) | Keausan/TBW/jam pakai tidak tersedia tanpa admin |
| RAM | `sysctl` (memsize, swapusage, memorystatus_vm_pressure_level), `vm_stat`, `system_profiler SPMemoryDataType` ✅ | `GlobalMemoryStatusEx`, WMI `Win32_PhysicalMemory` | Kerusakan sel RAM tidak bisa diuji dari OS |
| CPU | `sysctl`, Mach `host_statistics` (beban), `pmset -g therm` (speed limit, peringatan) ✅ | WMI `Win32_Processor`, PDH | Apple Silicon tidak mencetak `CPU_Speed_Limit` |
| Temperatur | SMC via IOKit (read-only) + suhu baterai `ioreg` ✅ | `MSAcpi_ThermalZoneTemperature` | SMC tidak didokumentasikan; pola sensor Apple Silicon belum diverifikasi |
| Kipas | SMC `FNum`, `F{n}Ac/Mn/Mx` ✅ | WMI `Win32_Fan` (jarang diisi) | Windows sering "Tidak diketahui" |
| GPU | `system_profiler SPDisplaysDataType` ✅ | WMI `Win32_VideoController`, DXGI | Tidak ada metrik resmi "kesehatan GPU" |
| Activation Lock & MDM | `system_profiler SPHardwareDataType` (`activation_lock_status`), `profiles status -type enrollment` ✅ | — (konsep berbeda di Windows) | Bukan jaminan; lihat keterbatasan di kartu |
| Nomor seri | `ioreg IOPlatformExpertDevice` (opt-in) ✅ | WMI `Win32_BIOS.SerialNumber` | Hanya dibaca atas permintaan |

### SMC (read-only)
- `platform/macos/smc.rs` memakai FFI IOKit milik sendiri (tanpa crate). Hanya perintah `READ_KEYINFO` (9), `READ_BYTES` (5), dan `READ_INDEX` (8) yang **didefinisikan**. Perintah tulis tidak ada di kode.
- Ukuran struct parameter dikunci 80 byte dengan `const assert`. Bila layanan SMC tidak ada atau tidak kompatibel, hasilnya `ProbeError` dan kartu menampilkan **Unknown** beserta kendalanya.
- Sensor terverifikasi di MacBookPro16,2 (Intel): CPU `TC0E TC0F TC0P TC1C–TC4C TCXC`, baterai `TB0T–TB2T`, 2 kipas (nilai `flt`). Tidak ada sensor GPU terpisah.
- Apple Silicon memakai pola `Tp**`/`Te**` (CPU), `Tg**` (GPU), dan `TB*T`, aktif hanya di arsitektur `aarch64`. Pola ini **belum diverifikasi**.

## 7. Offline dan keamanan

- **CSP produksi**: `default-src 'self'`, `connect-src` hanya untuk IPC, `object-src 'none'`, `frame-ancestors 'none'`. Terverifikasi lewat build ber-aset tertanam di Fase 1. `devCsp: null` untuk HMR Vite.
- **`freezePrototype: true`**, capabilities minimal (`core:default`, `opener:default`).
- Tanpa plugin `http`/`updater`/analytics, tanpa akun, tanpa telemetri. Informasi perangkat tidak dikirim tanpa persetujuan eksplisit.
- **Nomor seri**: command terpisah dan opt-in. Tidak disimpan di laporan dan tidak dicatat di log. `ownership.rs` hanya mengambil `activation_lock_status` dari `SPHardwareDataType`; nomor seri dari output yang sama langsung dibuang.
- **Read-only**: tidak ada operasi tulis ke SMC, kipas, daya, maupun konfigurasi sistem.

## 8. Penyimpanan data dan mode portable (rencana Fase 6)

- **Installer**: data aplikasi disimpan di direktori data milik OS lewat API path Tauri.
- **Portable**: aktif bila ada file penanda `portable` di samping aplikasi. Data dan laporan disimpan di `LaptopHealthCheck-Data/` di flashdisk. Jika USB *read-only*, aplikasi beralih ke folder sementara OS dan memberi tahu pengguna.
- **WebView2 (Windows portable)**: dicek di Rust **sebelum** `Builder::run()`. Bila tidak ada, aplikasi menampilkan kotak pesan native berisi instruksi pemasangan, lalu keluar dengan rapi.
- **Laporan (Fase 5)**: JSON dari `DiagnosticsReport`, PDF dibuat lokal. Nomor seri hanya disertakan bila dipilih.

## 9. Packaging dan build

| Target | Perintah | Catatan |
|---|---|---|
| macOS Intel | `npm run tauri build` | `.app` + `.dmg` |
| macOS universal | `npm run tauri build -- --target universal-apple-darwin` | Butuh `rustup target add aarch64-apple-darwin` (ditunda karena disk) |
| Windows | `npm run tauri build` di Windows/CI | NSIS + WebView2 *offline installer*; portable `.exe` + deteksi WebView2 |

**Hemat disk**: profil `dev` mengompilasi dependency tanpa debuginfo. Folder `target` dibersihkan (`cargo clean`) setelah verifikasi.

## 10. Strategi testing

| Lapisan | Alat | Cakupan |
|---|---|---|
| Parser macOS | `cargo test` + fixture asli tersanitasi (`fixtures/macos/intel-macbookpro16-2`) | ioreg, system_profiler, diskutil, vm_stat, swapusage, pmset, profiles |
| Format Apple Silicon | `cargo test` dengan contoh format **berlabel "bukan data perangkat asli"** | Struktur JSON/teks yang berbeda di Apple Silicon |
| Logika penilaian | `cargo test` + `platform::fake` | **Setiap batas** ambang (mis. kapasitas 80,0/79,9/60,0/59,9%) |
| Integrasi perangkat asli | `cargo test` (otomatis) + `cargo test -- --ignored` (SMC, laporan nyata) | Membaca Mac asli tanpa admin |
| Helper frontend | `node --test` | `src/lib/status.ts` |
| Tipe & lint | `tsc --noEmit`, `cargo clippy --all-targets -D warnings`, `cargo fmt --check` | Seluruh kode |
| End-to-end | `npm run tauri dev` | Jendela muncul; diagnostik berjalan otomatis; log menampilkan status per pemeriksaan |

## 11. Keputusan arsitektur (ADR singkat)

| # | Keputusan | Alasan | Tinjau ulang bila |
|---|---|---|---|
| 1 | Tanpa router/state library | Hanya 4 halaman, hemat dependency | Alur makin kompleks |
| 2 | Tipe TypeScript ditulis manual, dijaga test JSON | Menghindari `ts-rs`/`specta` | Tipe bertambah banyak |
| 3 | Utilitas OS bawaan sebagai sumber data utama | Nol dependency, tanpa admin | Butuh data yang hanya ada di API native |
| 4 | `node --test` sebagai pengganti Vitest/Jest | Nol dependency | Butuh test komponen React |
| 5 | Pemilihan platform saat kompilasi (`cfg` + trait) | Kontrak dipaksa compiler | — |
| 6 | Profil dev tanpa debuginfo dependency | Disk mesin dev terbatas | Perlu debug ke dalam dependency |
| 7 | WebView2 *offline installer* untuk installer Windows | Wajib bisa offline | Ukuran installer jadi masalah |
| 8 | Portable Windows: deteksi WebView2 + instruksi | Keputusan pemilik; hemat ~180 MB | Banyak pengguna tanpa WebView2 |
| 9 | Nomor seri lewat command terpisah, opt-in | Privasi default | — |
| 10 | Plist dikonversi dengan `plutil` bawaan, bukan crate `plist` | Nol dependency | `plutil` tidak tersedia/berubah |
| 11 | FFI IOKit/Mach ditulis sendiri (SMC, `host_statistics`), bukan crate | Nol dependency; bisa diaudit (read-only) | Banyak API native lain dibutuhkan |
| 12 | Probe dijalankan paralel (`thread::scope`) | Total ±1,2 dtk vs ±4 dtk berurutan | — |
| 13 | Ambang suhu/kipas bergantung beban CPU yang diukur | Hindari alarm palsu saat beban tinggi | Ada data lapangan yang lebih baik |
| 14 | Disk eksternal tidak dinilai | USB portable (SMART tak didukung) tidak boleh membuat status "Tidak diketahui" | — |
