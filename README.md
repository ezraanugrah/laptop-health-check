# Laptop Health Check

Aplikasi desktop **khusus macOS** untuk memeriksa kesehatan perangkat keras Mac (MacBook Intel dan Apple Silicon) secara **offline**. Dibangun dengan **Tauri 2**, **React 19**, **TypeScript**, **Rust**, dan **Tailwind CSS v4**.

> Status: Fase 2 (macOS Core Diagnostics) selesai. Ada 9 pemeriksaan berbasis data asli: Sistem, Baterai, SSD/HDD, RAM, CPU & status termal, Suhu, Kipas, GPU, serta Activation Lock & MDM. Nomor seri bersifat *opt-in*. Mac Intel sudah terverifikasi di perangkat asli; Apple Silicon masih **pratinjau**. Fase 3 (Interactive Hardware Testing) sedang berjalan: keamanan kamera/mikrofon sudah terverifikasi, dan Tes Layar serta Tes Keyboard sudah tersedia. Aplikasi dwibahasa (Indonesia/English) dengan tema Terang/Gelap (lihat [ROADMAP.md](ROADMAP.md)).

Target: Mac Intel (x86_64) dan Apple Silicon (arm64) · 100% offline · installer DMG dan portable dari flashdisk.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [PRD.md](PRD.md) | Kebutuhan produk: masalah, pengguna, fitur, non-fungsional, riwayat scope |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arsitektur, kontrak IPC, model data, sumber data macOS, keamanan offline, packaging |
| [ROADMAP.md](ROADMAP.md) | Fase pengembangan 1–5 |
| [TASKS.md](TASKS.md) | Daftar pekerjaan per fase |
| [docs/FASE3-INTERACTIVE-TESTING-PRD.md](docs/FASE3-INTERACTIVE-TESTING-PRD.md) | Rencana detail Fase 3: tes perangkat keras interaktif |
| [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) | Alur Git/PR, aturan Claude, panduan GitHub Rulesets |
| [CLAUDE.md](CLAUDE.md) | Panduan dan aturan kerja untuk Claude Code |
| [docs/archive/windows/](docs/archive/windows/FASE3-WINDOWS-PRD.md) | Arsip rencana Windows (dibatalkan 19 Nov 2026), hanya riwayat |

## Prasyarat

- macOS dengan Xcode Command Line Tools (`xcode-select --install`)
- [Rust](https://rustup.rs) (stable): `rustc`, `cargo`
- [Node.js](https://nodejs.org) 20.19+ dan npm
- Lihat juga: https://tauri.app/start/prerequisites/

## Menjalankan

```bash
npm install          # instal dependency frontend
npm run tauri dev    # jalankan aplikasi dalam mode pengembangan
npm run tauri build  # buat bundle rilis (.app / .dmg) — berat
```

## Pengujian

```bash
npm run typecheck    # pemeriksaan tipe TypeScript
npm test             # test frontend (node --test)
npm run build        # build frontend
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
cargo test -- --ignored   # baca sensor SMC dan laporan nyata dari Mac ini
```

CI GitHub Actions menjalankan langkah yang sama di VM macOS Intel dan arm64. Hasil CI bukan bukti hardware asli.

## Struktur

```
src/                  Frontend React + TypeScript + Tailwind
  lib/api.ts          Satu-satunya pemanggil invoke()
  types/diagnostics.ts  Cermin tipe Rust
src-tauri/            Backend Rust (Tauri 2)
  src/commands.rs     Command Tauri (IPC)
  src/diagnostics/    Penilaian status (tanpa API OS)
  src/platform/macos/ Pembacaan data macOS (read-only)
  fixtures/macos/     Output asli tersanitasi untuk test parser
  tauri.conf.json     Konfigurasi aplikasi
```

## IDE yang disarankan

[VS Code](https://code.visualstudio.com/) + ekstensi [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
