# CLAUDE.md — panduan untuk Claude Code

Laptop Health Check: aplikasi desktop **offline** untuk memeriksa kesehatan hardware laptop.
Stack: **Tauri 2 · React 19 · TypeScript · Tailwind CSS v4 · Rust** · package manager **npm**.
Target: macOS Intel, macOS Apple Silicon, Windows 10/11 (Linux ditunda). Distribusi: installer + portable USB.

Baca juga: `PRD.md` (apa & mengapa), `ARCHITECTURE.md` (bagaimana), `ROADMAP.md` (fase), `TASKS.md` (pekerjaan berikutnya).

## Aturan kerja (wajib)

- **Jangan commit, push, merge, atau mengubah repo GitHub tanpa izin eksplisit pemilik** untuk setiap tindakan.
- **Jangan menghapus file penting** atau menimpa konfigurasi Git yang sudah benar. Penghapusan file harus seizin pemilik.
- **Kerja per fase.** Jangan membangun seluruh fitur sekaligus. Di akhir setiap fase, laporkan hasilnya dan tunggu persetujuan.
- **Disk mesin dev terbatas** (~25 GB kosong). Hindari dependency yang tidak perlu. Jangan memasang target Rust tambahan atau build rilis besar tanpa alasan. Bersihkan artefak sementara bila aman.
- **Offline total.** Dilarang menambah kode/plugin jaringan, aset dari CDN, font web, telemetri, atau auto-update daring. Tanpa akun pengguna. Informasi perangkat tidak boleh dikirim tanpa persetujuan eksplisit.
- **Hanya data nyata.** Jangan pernah menampilkan nilai contoh, simulasi, *mock*, atau tebakan sebagai hasil diagnosis. Data yang tidak bisa dibaca menjadi `Status::Unknown` (atau `Unsupported`) beserta alasannya. Data palsu hanya boleh ada di test (platform palsu/*fixture*).
- **Nomor seri disembunyikan secara default.** Hanya dibaca lewat command terpisah saat pengguna memilih "Tampilkan", dan tidak masuk laporan kecuali dipilih saat ekspor. *Fixture* test wajib dibersihkan dari nomor seri asli.
- Jangan menghapus cache global (misalnya `~/.npm`, `~/.cargo/registry`) tanpa izin.
- Komunikasi dengan pemilik dalam **bahasa Indonesia**. Teks UI juga bahasa Indonesia.

## Perintah

```bash
npm install                 # dependency frontend
npm run tauri dev           # jalankan aplikasi (Vite :1420 + jendela Tauri)
npm run build               # tsc + vite build -> dist/
npm run typecheck           # tsc --noEmit
npm test                    # node --test "src/**/*.test.ts"
npm run tauri build         # bundle rilis (.app/.dmg di macOS) — berat, minta izin dulu

cd src-tauri
cargo test                  # unit + integrasi (macOS membaca sistem asli)
cargo clippy --all-targets -- -D warnings
cargo fmt --check
```

Rust ada di `~/.cargo/bin`. Shell baru otomatis memuatnya. Di shell non-login jalankan dulu `. "$HOME/.cargo/env"`.

## Struktur dan aturan lapisan

```
src/                      frontend
  types/diagnostics.ts    CERMIN tipe Rust — wajib diperbarui bila types.rs berubah
  lib/api.ts              satu-satunya tempat memanggil invoke()
  lib/status.ts           helper murni (dites dengan node --test)
  components/, pages/
src-tauri/src/
  commands.rs             command Tauri tipis; kerja blocking -> spawn_blocking
  diagnostics/            PENILAIAN lintas platform (tanpa API OS)
  platform/               PEMBACAAN data mentah per OS (trait Platform, alias Current)
```

- `platform/*` hanya membaca data. `diagnostics/*` yang menilai (Baik/Perlu perhatian/Bermasalah).
- Fitur OS baru: tambah method di trait `Platform`, lalu implementasikan di `macos.rs`, `windows.rs`, **dan** `unsupported.rs`.
- Perintah sistem dipanggil dengan **path absolut** (`/usr/sbin/sysctl`, bukan `sysctl`).
- Hindari fitur yang butuh hak admin. Bila data tidak tersedia, kembalikan `Status::Unknown` dengan penjelasan, jangan sampai panic.
- Serde `rename_all = "camelCase"` di semua tipe IPC. Test `serializes_camel_case_for_frontend` menjaga kecocokan dengan TypeScript.
- Frontend: tanpa router/state library (navigasi `useState`). Tanpa inline `style=` karena CSP produksi `style-src 'self'`. Pakai class Tailwind saja.
- File test TS memakai sintaks yang bisa di-*erase* (`erasableSyntaxOnly`), mengimpor modul lokal dengan ekstensi `.ts`, dan mengimpor tipe dengan `import type`.

## Menambah pemeriksaan baru

Ikuti langkah di `ARCHITECTURE.md` §5. Wajib ada unit test untuk fungsi `evaluate` (ambang penilaian) memakai platform palsu, serta test integrasi ringan di `platform/macos.rs`.

## Definisi selesai (per perubahan)

`npm run typecheck` · `npm test` · `npm run build` · `cargo fmt --check` · `cargo clippy --all-targets -- -D warnings` · `cargo test`. Semuanya harus hijau, lalu perbarui `TASKS.md`.

## Catatan environment

- Mesin dev: MacBook Intel (x86_64), macOS 26, Xcode **Command Line Tools** saja (tanpa Xcode penuh; cukup untuk desktop).
- Modul `platform/windows.rs` belum pernah dikompilasi di Windows. Verifikasi via CI/mesin Windows (Fase 3).
- Profil dev mengompilasi dependency tanpa debuginfo (lihat `Cargo.toml`) untuk menghemat disk.
