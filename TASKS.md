# Tasks — Laptop Health Check

Legenda: `[x]` selesai · `[ ]` belum · **(izin)** = butuh persetujuan pemilik sebelum dikerjakan

## Fase 1 — Fondasi ✅

- [x] Rust stable terpasang (rustc/cargo 1.100.0, rustfmt, clippy)
- [x] Scaffold Tauri 2 + React + TS langsung di folder proyek (tanpa subfolder baru)
- [x] Tailwind CSS v4 via `@tailwindcss/vite`
- [x] `tauri.conf.json`: nama, bundle ID, ukuran jendela, CSP offline, `freezePrototype`, target `app`/`dmg`/`nsis`, WebView2 *offline installer*
- [x] `Cargo.toml`: metadata + profil dev hemat disk
- [x] Struktur modular: `commands.rs`, `diagnostics/`, `platform/{macos,windows,unsupported}.rs`
- [x] Pemeriksaan **Sistem** aktif (macOS: `sw_vers`, `sysctl`)
- [x] Kerangka pemeriksaan Baterai, Penyimpanan, CPU, Memori (status "Segera hadir")
- [x] UI awal: Sidebar, Ringkasan, Tentang, halaman placeholder, mode gelap
- [x] Dokumen: PRD, ARCHITECTURE, ROADMAP, TASKS, CLAUDE.md, README + keputusan produk
- [x] Test: Rust (unit + integrasi macOS), frontend (`node --test`), typecheck, clippy, fmt
- [x] Aplikasi berjalan di macOS (`npm run tauri dev` dan build produksi tanpa server dev)
- [x] Hapus file demo template yang tidak dipakai (`src/App.css`, `src/assets/react.svg`, `public/vite.svg`)
- [x] Commit pertama ke `main`
- [ ] Push ke `origin/main` **(izin)**

## Fase 2 — Diagnostik inti macOS ✅ (branch `feature/core-diagnostics-macos`, belum di-commit)

Aturan: hanya data nyata; data tak tersedia = "Tidak diketahui"/"Tidak berlaku" beserta alasannya; *fixture* test dari output perangkat asli yang disanitasi.

- [x] Push Fase 1 (`626b4a5`) ke `origin/main`, buat branch `feature/core-diagnostics-macos`
- [x] Model data: status Sehat/Peringatan/Kritis/Tidak diketahui/Tidak berlaku, alasan bertingkat, sumber data, keterbatasan
- [x] Helper perintah ber-timeout (tanpa shell, path absolut) + konversi plist via `plutil`
- [x] Skrip `scripts/capture-macos-fixtures.sh` + fixture tersanitasi `intel-macbookpro16-2`
- [x] Battery Health (kapasitas vs desain, siklus vs batas desain, kondisi macOS, PermanentFailure, suhu)
- [x] SSD/HDD Health (SMART, jenis, antarmuka, TRIM, ruang kosong volume sistem; disk eksternal tidak dinilai)
- [x] RAM Information & Memory Pressure (modul + status, pemakaian, swap, tekanan memori)
- [x] CPU Information & Thermal Status (core P/E, beban via Mach, `CPU_Speed_Limit`, peringatan termal)
- [x] Temperature Monitoring (SMC read-only + suhu baterai; ambang bergantung beban CPU)
- [x] Fan Monitoring (SMC read-only; RPM vs min/maks; tanpa kipas = Tidak berlaku)
- [x] GPU Information (model, jenis, VRAM, Metal, layar)
- [x] Serial Number opt-in (tersembunyi default, command terpisah, tidak dicatat di log)
- [x] Activation Lock & MDM (+ keterbatasan deteksi selalu ditampilkan)
- [x] UI: 9 kartu, alasan berwarna, sumber data, keterbatasan, pemeriksaan otomatis saat dibuka, tombol "Periksa ulang"
- [x] Test: 102 otomatis + 2 perangkat-asli (`--ignored`), uji semua batas ambang
- [x] Uji di MacBook Intel asli (MacBookPro16,2): data asli tampil, 0 crash
- [x] Commit Fase 2 ke branch `feature/core-diagnostics-macos`
- [ ] Push branch **(izin)** · merge ke `main` **(izin)**

### Belum terverifikasi / belum selesai
- [ ] **Apple Silicon**: pola sensor SMC (`Tp/Te/Tg`), data kipas (`flt`), core P/E, format `SPMemoryDataType`/`SPDisplaysDataType`, kapasitas baterai via `AppleRawMaxCapacity`, `pmset` tanpa `CPU_Speed_Limit`, pembukaan layanan `AppleSMC`. Butuh fixture asli: `sh scripts/capture-macos-fixtures.sh <nama-perangkat>`
- [ ] Mac Intel lain (dengan GPU diskret AMD, HDD/SATA, tanpa chip T2) belum diuji
- [ ] Keausan SSD (persentase, TBW, jam pakai): tidak tersedia tanpa admin, jadi ditampilkan sebagai keterbatasan
- [ ] Screenshot otomatis jendela native butuh izin *Screen Recording* (diatur pemilik di System Settings)
- [ ] Uji beban CPU: sengaja belum dibuat (sesuai keputusan pemilik)

## Fase 3 — Windows + CI

- [ ] Implementasi `platform/windows.rs` (WMI/Win32) untuk Sistem + semua pemeriksaan inti
- [ ] Workflow GitHub Actions build + test (macOS & Windows) **(izin: menambah file di repo & menjalankan CI)**
- [ ] Verifikasi kompilasi Windows (modul `windows.rs` belum pernah dikompilasi)
- [ ] Uji di laptop Windows 10/11 asli

## Fase 5 — Laporan

- [ ] Ekspor JSON (`DiagnosticsReport` + metadata versi aplikasi)
- [ ] Ekspor PDF lokal (putuskan: crate PDF Rust vs. cetak WebView ke PDF)
- [ ] Opsi "sertakan nomor seri" saat ekspor (default: tidak)

## Fase 6 — Portable & packaging

- [ ] Deteksi mode portable + folder data di samping aplikasi
- [ ] Windows: cek WebView2 sebelum `Builder::run()` + kotak pesan native berisi instruksi
- [ ] `rustup target add aarch64-apple-darwin` + build universal macOS
- [ ] Verifikasi CSP produksi pada build rilis penuh (`npm run tauri build`)

## Backlog

- [ ] Ikon aplikasi khusus (saat ini masih ikon bawaan Tauri)
- [ ] Putuskan: bahasa Inggris sejak MVP? *Code signing*/notarisasi? (PRD §9)
