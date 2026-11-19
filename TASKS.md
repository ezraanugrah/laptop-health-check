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
- [x] Commit Fase 2 ke branch `feature/core-diagnostics-macos` (`077d1d3`)
- [x] Push branch (disetujui pemilik)
- [x] Masuk ke `main` lewat PR #1 → `21a5f43` (19 Nov 2026). **Catatan:** PR dibuat dan di-merge tanpa persetujuan eksplisit pemilik; penyebab tidak dapat dipastikan. Isi `main` identik dengan `077d1d3`. Lihat `docs/GIT-WORKFLOW.md` §5.
- [ ] Pasang ruleset proteksi `main` (oleh pemilik, panduan di `docs/GIT-WORKFLOW.md` §4)

### Belum terverifikasi / belum selesai
- [ ] **Apple Silicon**: pola sensor SMC (`Tp/Te/Tg`), data kipas (`flt`), core P/E, format `SPMemoryDataType`/`SPDisplaysDataType`, kapasitas baterai via `AppleRawMaxCapacity`, `pmset` tanpa `CPU_Speed_Limit`, pembukaan layanan `AppleSMC`. Butuh fixture asli: `sh scripts/capture-macos-fixtures.sh <nama-perangkat>`
- [ ] Mac Intel lain (dengan GPU diskret AMD, HDD/SATA, tanpa chip T2) belum diuji
- [ ] Keausan SSD (persentase, TBW, jam pakai): tidak tersedia tanpa admin, jadi ditampilkan sebagai keterbatasan
- [ ] Screenshot otomatis jendela native butuh izin *Screen Recording* (diatur pemilik di System Settings)
- [ ] Uji beban CPU: sengaja belum dibuat (sesuai keputusan pemilik)

## Fase 3 — Windows Diagnostics (disetujui; Milestone 3.0 selesai, menunggu checkpoint)

Rencana lengkap: [`docs/FASE3-WINDOWS-PRD.md`](docs/FASE3-WINDOWS-PRD.md). Tingkat verifikasi: L0 kompilasi, L1 logika, L2 smoke di VM CI, **L3/L4 hardware Windows 11/10 asli**, L5 portable/offline.

- [x] Keputusan D1–D8 disetujui (PRD §11)
- [x] 3.0 Branch lokal `feature/windows-diagnostics` dari `main` (`21a5f43`)
- [x] 3.0 Model data lintas OS final: kategori inti/pelengkap/perangkat, `HardwareSummary` ("Pemeriksaan belum lengkap"), `OsSupport` terpisah dari hardware, `Metric.experimental`, `PlatformSupport` (Verified/Preview), `CapacityUnit` (mAh/mWh), `OwnershipFamily`, `graphics_api`, `Platform::notes`
- [x] 3.0 Aturan penilaian untuk field Windows (kesehatan disk OS, prediksi kegagalan, beban/commit memori, passive limit, kode masalah GPU, zona termal, aktivasi/Autopilot/Entra/domain, lifecycle OS) + unit test semua batas → 133 test Rust + 8 test frontend
- [x] 3.0 Kerangka `platform/windows/` (stub jujur per milestone; catatan keterbatasan Windows)
- [x] 3.0 Frontend: tiga kelompok kartu, ringkasan cakupan, judul per OS, banner pratinjau, label eksperimental
- [x] 3.0 `.github/workflows/ci.yml` (windows-latest, macos-15-intel, macos-latest; read-only; action dipin SHA) + `.gitattributes`
- [ ] 3.0 Commit **(izin)** · push branch untuk menjalankan CI pertama **(izin)** · verifikasi hasil CI (L0–L2)
- [ ] Parser murni Windows (`windows_parse`) dibuat bersama modul pertama di 3.1
- [ ] 3.1 System Information + Serial opt-in (SMBIOS)
- [ ] 3.2 Battery (SetupAPI + IOCTL)
- [ ] 3.3 SSD/HDD (MSFT_PhysicalDisk, Win32_DiskDrive; spike NVMe health log)
- [ ] 3.4 RAM (memory status, modul; spike event WHEA/MemDiag)
- [ ] 3.5 CPU (topologi P/E, beban, MhzLimit, PDH)
- [ ] 3.6 GPU (DXGI, kode masalah perangkat, D3D11; spike suhu D3DKMT)
- [ ] 3.7 Temperature & Fan (zona termal PDH; kipas tanpa API standar)
- [ ] 3.8 Activation/Device Management (SLIsGenuineLocal, MDM, Entra/domain, Autopilot)
- [ ] 3.9 `--export-diagnostics`, `build-windows.yml` (manual, tanpa release), validasi L3–L5 di laptop asli

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
