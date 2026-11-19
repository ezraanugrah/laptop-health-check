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

## Fase 2 — Diagnostik inti macOS (rencana detail menunggu persetujuan)

Ruang lingkup: Baterai, SSD/HDD, CPU, RAM, Temperatur, Kipas, GPU, Nomor seri (*opt-in*).
Aturan: hanya data nyata; data tak tersedia = "Tidak diketahui"/"Tidak berlaku" beserta alasannya; *fixture* test diambil dari output perangkat asli dengan nomor seri dihapus.

- [ ] Persiapan: perluas tipe IPC, helper `system_profiler`/`ioreg` dengan timeout, *fixture* test
- [ ] Baterai
- [ ] SSD/HDD
- [ ] RAM
- [ ] CPU + status termal/*throttling*
- [ ] Temperatur + Kipas (pembaca SMC)
- [ ] GPU
- [ ] Nomor seri *opt-in* (tersembunyi secara default)
- [ ] UI: kartu baru, progres, alasan "Tidak diketahui", tombol tampilkan nomor seri
- [ ] Uji di MacBook Intel asli; Apple Silicon bila perangkat tersedia

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
