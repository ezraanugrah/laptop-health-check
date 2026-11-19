# Arsitektur — Laptop Health Check

Status: Fase 1 (fondasi). Dokumen ini menjelaskan struktur saat ini dan rencana yang sudah disepakati.

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
│     ├─ macos.rs        (sw_vers, sysctl; nanti IOKit/ioreg/diskutil)                    │
│     ├─ windows.rs      (std; nanti WMI/Win32)                                           │
│     └─ unsupported.rs  (fallback; Linux ditunda)                                        │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

Prinsip utama:
1. **Baca terpisah dari nilai.** `platform` hanya membaca fakta mentah. `diagnostics` yang memutuskan Baik/Perlu perhatian/Bermasalah. Dengan begitu logika penilaian bisa dites tanpa hardware asli.
2. **Offline total.** Tidak ada kode jaringan, plugin jaringan, atau aset dari CDN.
3. **Dependency minimal.** Setiap crate/paket baru harus punya alasan dan dicatat di bagian Keputusan.

## 2. Struktur folder

```
.
├─ index.html, vite.config.ts, tsconfig*.json, package.json
├─ src/                         Frontend
│  ├─ main.tsx, App.tsx, index.css
│  ├─ types/diagnostics.ts      Cermin tipe Rust (wajib sinkron)
│  ├─ lib/api.ts                Wrapper invoke bertipe + deteksi mode desktop
│  ├─ lib/status.ts (+ .test.ts) Helper murni: label status, format, hitung
│  ├─ components/               Sidebar, StatusBadge, CheckCard
│  └─ pages/                    DashboardPage, AboutPage, ComingSoonPage
├─ src-tauri/                   Backend
│  ├─ tauri.conf.json           Konfigurasi app, CSP, bundle
│  ├─ capabilities/default.json Izin IPC jendela utama (minimal)
│  ├─ Cargo.toml
│  └─ src/
│     ├─ main.rs, lib.rs        Entry point + registrasi command
│     ├─ commands.rs
│     ├─ diagnostics/{mod,types,system,battery,storage,cpu,memory}.rs
│     └─ platform/{mod,macos,windows,unsupported}.rs
└─ PRD.md, ARCHITECTURE.md, ROADMAP.md, TASKS.md, CLAUDE.md
```

## 3. Kontrak IPC

| Command | Hasil | Keterangan |
|---|---|---|
| `get_app_info` | `AppInfo` | Nama, versi, OS, dan arsitektur build |
| `get_system_overview` | `SystemOverview` | Data identitas perangkat (mentah) |
| `run_diagnostics` | `DiagnosticsReport` | Menjalankan semua pemeriksaan |

Command yang bisa memblokir (menjalankan proses OS, membaca hardware) memakai `async` + `tauri::async_runtime::spawn_blocking`. Error dikirim ke frontend sebagai `string`.

## 4. Model data

Didefinisikan di `src-tauri/src/diagnostics/types.rs` dan dicerminkan di `src/types/diagnostics.ts`. Serde memakai `camelCase`.

- `CheckId`: `system | battery | storage | cpu | memory`
- `Status`: `pass | warning | fail | unknown | notImplemented | unsupported`
- `CheckResult { id, status, summary, metrics: Metric[] }`
- `Metric { label, value }`. Nilai sudah diformat untuk tampilan, dan teksnya berbahasa Indonesia.
- `DiagnosticsReport { overall, generatedAt (ms epoch), checks }`
- **Status keseluruhan** = status terburuk dari pemeriksaan yang dihitung, dengan urutan keparahan `pass < unknown < warning < fail`. Status `notImplemented` dan `unsupported` tidak ikut dihitung. Jika tidak ada satu pun yang dihitung, hasilnya `unknown`.

Test `serializes_camel_case_for_frontend` menjaga bentuk JSON tetap cocok dengan tipe TypeScript.

## 5. Abstraksi platform

```rust
pub trait Platform {
    fn system_overview() -> Result<SystemOverview, ProbeError>;
    // nanti: battery(), storage(), cpu(), memory()
}
// dipilih saat kompilasi:
#[cfg(target_os = "macos")]   pub use macos::MacOs as Current;
#[cfg(target_os = "windows")] pub use windows::Windows as Current;
```

- `diagnostics::run_all::<P: Platform>()` bersifat generik. Produksi memakai `Current`, sedangkan test memakai platform palsu (lihat `diagnostics/system.rs`).
- Karena dipilih saat kompilasi, tidak ada overhead runtime, dan setiap OS **wajib** mengimplementasikan seluruh method trait.
- Perintah sistem dipanggil dengan **path absolut** (misalnya `/usr/sbin/sysctl`) agar tidak bisa dibajak lewat `PATH`. Ini penting karena aplikasi bisa dijalankan di laptop orang lain.

### Cara menambah pemeriksaan (contoh: baterai)
1. Tambah struct data mentah (misalnya `BatteryInfo`) di `types.rs`, lalu cerminkan di TypeScript bila dikirim ke UI.
2. Tambah method `fn battery() -> Result<Option<BatteryInfo>, ProbeError>` di trait `Platform`.
3. Implementasikan di `macos.rs` dan `windows.rs` (`unsupported.rs` cukup mengembalikan error).
4. Di `diagnostics/battery.rs`: `run::<P>()` memanggil platform, lalu `evaluate(&BatteryInfo) -> CheckResult` berisi ambang penilaian.
5. Tulis unit test untuk `evaluate` (berbagai kondisi) dan test integrasi ringan di `macos.rs`.

## 6. Sumber data per OS (rencana)

| Data | macOS | Windows 10/11 | Catatan/risiko |
|---|---|---|---|
| Sistem | `sw_vers`, `sysctl` ✅ | WMI `Win32_OperatingSystem`, `Win32_ComputerSystem`, `Win32_Processor` | — |
| Baterai | `ioreg -rn AppleSmartBattery` (siklus, kapasitas desain/maksimum) | WMI `root\WMI` (`BatteryStaticData`, `BatteryFullChargedCapacity`, `BatteryCycleCount`) | Kelas WMI baterai berbeda antarvendor |
| Penyimpanan | `diskutil info`, `system_profiler SPNVMeDataType/SPSerialATADataType` (status SMART) | `MSFT_PhysicalDisk` / `Get-PhysicalDisk` (HealthStatus), ruang via Win32 | Atribut SMART detail umumnya butuh admin |
| CPU/suhu | `sysctl`, beban via `host_statistics`; suhu Intel via SMC | Beban via PDH; suhu `MSAcpi_ThermalZoneTemperature` | Suhu Apple Silicon hanya lewat API privat; suhu di Windows sering butuh admin dan tidak akurat → boleh "Tidak diketahui" |
| Memori | `sysctl hw.memsize`, `vm_stat`, `memory_pressure` | `GlobalMemoryStatusEx` | — |
| Kipas | Kunci SMC (`FNum`, `F0Ac`, `F0Mn`, `F0Mx`), hanya membaca | WMI `Win32_Fan` (jarang diisi vendor) | Di Windows sering tidak tersedia → "Tidak diketahui" |
| GPU | `system_profiler SPDisplaysDataType` | WMI `Win32_VideoController`, DXGI | Kesehatan GPU tidak punya metrik resmi; yang dilaporkan deteksi, driver, dan suhu bila ada |
| Nomor seri | `system_profiler SPHardwareDataType` / `ioreg IOPlatformExpertDevice` | WMI `Win32_BIOS.SerialNumber` | Hanya dibaca atas permintaan pengguna (lihat §7) |

Pilihan crate (misalnya `sysinfo`, `windows`, `wmi`) diputuskan saat fase terkait. Kriterianya: ukuran, lisensi, dan tidak butuh admin.

## 7. Offline dan keamanan

- **CSP produksi** (`tauri.conf.json`): `default-src 'self'`, skrip dan style hanya dari aplikasi, `connect-src` hanya untuk IPC, `object-src 'none'`, `frame-ancestors 'none'`. Jadi tidak ada sumber eksternal yang bisa dimuat. `devCsp: null` agar HMR Vite tetap jalan saat pengembangan.
- **`freezePrototype: true`**: mengeraskan frontend dari *prototype pollution*.
- **Capabilities minimal**: hanya `core:default` dan `opener:default` untuk jendela `main`. Plugin `opener` disiapkan untuk membuka/menampilkan file laporan di Finder/Explorer.
- Tidak ada plugin `http`, `updater`, atau analytics. Tanpa akun, tanpa telemetri; informasi perangkat tidak dikirim ke mana pun tanpa persetujuan eksplisit pengguna.
- **Nomor seri** dibaca lewat command terpisah yang hanya dipanggil saat pengguna memilih "Tampilkan". Nomor seri tidak disimpan di laporan kecuali dipilih saat ekspor.
- **Integritas data**: lapisan `platform` tidak pernah mengisi nilai pengganti atau simulasi. Data yang gagal dibaca menjadi `None` atau `ProbeError`, lalu dinilai `Unknown` dengan alasan yang jelas.
- Hanya font sistem (tanpa Google Fonts/CDN).
- Pembaruan aplikasi dilakukan manual (installer/portable baru), karena tidak ada auto-update daring.

## 8. Penyimpanan data dan mode portable (rencana Fase 6)

- **Mode installer**: data disimpan di direktori data aplikasi milik OS, lewat API path Tauri.
  - macOS: `~/Library/Application Support/com.ezraanugrah.laptophealthcheck`
  - Windows: `%APPDATA%\com.ezraanugrah.laptophealthcheck`
- **Mode portable**: aktif bila ada file penanda `portable` (atau `portable.txt`) di samping executable/`.app`. Data dan laporan disimpan di folder `LaptopHealthCheck-Data/` di samping aplikasi (di flashdisk), sehingga laptop yang diperiksa tetap bersih.
- Jika folder portable tidak bisa ditulisi (misalnya USB *read-only*), aplikasi beralih ke folder sementara OS dan memberi tahu pengguna.
- **Deteksi WebView2 (Windows portable)**: tanpa WebView2 Runtime, jendela Tauri tidak bisa dibuat sama sekali. Karena itu pengecekan dilakukan di Rust **sebelum** `Builder::run()` (misalnya `tauri::webview_version()`). Bila gagal, aplikasi menampilkan kotak pesan native Windows berisi instruksi pemasangan: jalankan installer WebView2 offline yang disertakan di folder USB, atau unduh dari situs Microsoft di komputer lain. Setelah itu aplikasi keluar dengan rapi.
- **Laporan (Fase 5)**: JSON diserialisasi langsung dari `DiagnosticsReport`. PDF dibuat secara lokal; pilihan antara crate PDF Rust dan cetak WebView ke PDF diputuskan di Fase 5.

## 9. Packaging dan build

| Target | Perintah | Catatan |
|---|---|---|
| macOS Intel | `npm run tauri build` | Menghasilkan `.app` + `.dmg` (target default mesin dev) |
| macOS universal (Intel + Apple Silicon) | `npm run tauri build -- --target universal-apple-darwin` | Butuh `rustup target add aarch64-apple-darwin` (~200 MB, ditunda karena disk) |
| Windows | `npm run tauri build` di Windows atau CI | NSIS + WebView2 *offline installer* (+~127 MB). Portable: `.exe` dari `target/release` + deteksi WebView2 saat start (§8). Tidak di-*cross-compile* dari Mac. |

- `bundle.targets = ["app", "dmg", "nsis"]`. Bundler Tauri otomatis hanya membuat target yang sesuai OS build.
- Tanpa *code signing*, macOS Gatekeeper dan Windows SmartScreen akan menampilkan peringatan. Keputusan signing/notarisasi ada di PRD §9.
- **Hemat disk**: profil `dev` mengompilasi dependency tanpa debuginfo (`[profile.dev.package."*"] debug = false`). Profil `release` memakai LTO, `strip`, dan `panic = "abort"` agar binary kecil.

## 10. Strategi testing

| Lapisan | Alat | Cakupan |
|---|---|---|
| Logika penilaian Rust | `cargo test` + platform palsu | Ambang status, status keseluruhan, format, bentuk JSON |
| Platform macOS | `cargo test` (test integrasi ringan) | Membaca sistem asli tanpa admin |
| Platform Windows | CI Windows (rencana) | Kompilasi + test di Windows |
| Helper frontend | `node --test` (bawaan Node, *type stripping*) | Fungsi murni di `src/lib` |
| Tipe & lint | `tsc --noEmit`, `cargo clippy -D warnings`, `cargo fmt --check` | Seluruh kode |
| End-to-end | Manual (`npm run tauri dev`) | Jendela muncul, IPC berjalan |

## 11. Keputusan arsitektur (ADR singkat)

| # | Keputusan | Alasan | Tinjau ulang bila |
|---|---|---|---|
| 1 | Tanpa router atau state library; navigasi pakai `useState` | Hanya 4 halaman, hemat dependency | Halaman/alur makin kompleks |
| 2 | Tipe TypeScript ditulis manual sebagai cermin Rust, dijaga test JSON | Menghindari `ts-rs`/`specta` | Tipe bertambah banyak |
| 3 | Fase 1 memakai utilitas OS bawaan (`sw_vers`, `sysctl`) | Nol dependency, tanpa admin | Butuh data yang hanya ada di API native |
| 4 | `node --test` sebagai pengganti Vitest/Jest | Nol dependency (Node 26 bisa menjalankan `.ts` langsung) | Butuh test komponen React/DOM |
| 5 | Pemilihan platform saat kompilasi (`cfg` + trait), bukan `dyn` | Tanpa overhead, kontrak dipaksa compiler | — |
| 6 | Profil dev tanpa debuginfo dependency | Disk mesin dev terbatas | Perlu debugging ke dalam dependency |
| 7 | WebView2 *offline installer* untuk installer Windows | Wajib bisa offline | Ukuran installer jadi masalah |
| 8 | Portable Windows: deteksi WebView2 + instruksi, tanpa *fixed runtime* | Keputusan pemilik; menghemat ~180 MB | Banyak pengguna target tanpa WebView2 |
| 9 | Nomor seri lewat command terpisah, *opt-in* | Privasi default | — |
