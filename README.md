# Laptop Health Check

Aplikasi desktop untuk mengecek kesehatan laptop, dibangun dengan **Tauri 2**, **React**, **TypeScript**, **Rust**, dan **Tailwind CSS v4**.

> Status: Fase 2 (diagnostik inti macOS) — 9 pemeriksaan berbasis data asli: Sistem, Baterai, SSD/HDD, RAM, CPU & status termal, Temperatur, Kipas, GPU, Activation Lock & MDM (+ nomor seri opt-in). Windows menyusul di Fase 3 (lihat [ROADMAP.md](ROADMAP.md)).

Target: macOS (Intel & Apple Silicon) dan Windows 10/11 · berjalan 100% offline · mode installer & portable USB.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [PRD.md](PRD.md) | Kebutuhan produk: masalah, pengguna, fitur, non-fungsional |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Arsitektur, kontrak IPC, abstraksi platform, keamanan offline, packaging |
| [ROADMAP.md](ROADMAP.md) | Fase pengembangan |
| [TASKS.md](TASKS.md) | Daftar pekerjaan per fase |
| [CLAUDE.md](CLAUDE.md) | Panduan & aturan kerja untuk Claude Code |

## Prasyarat

- [Rust](https://rustup.rs) (stable) — `rustc`, `cargo`
- [Node.js](https://nodejs.org) 20.19+ dan npm
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Lihat juga: https://tauri.app/start/prerequisites/

## Menjalankan

```bash
npm install          # instal dependency frontend
npm run tauri dev    # jalankan aplikasi dalam mode pengembangan
npm run tauri build  # buat bundle rilis (.app / .dmg)

npm test             # test frontend (node --test)
npm run typecheck    # pemeriksaan tipe TypeScript
cd src-tauri && cargo test && cargo clippy --all-targets -- -D warnings
```

## Struktur

```
src/            Frontend React + TypeScript + Tailwind
src-tauri/      Backend Rust (Tauri 2)
  src/lib.rs    Perintah (command) Tauri
  tauri.conf.json  Konfigurasi aplikasi
```

## IDE yang disarankan

[VS Code](https://code.visualstudio.com/) + ekstensi [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
