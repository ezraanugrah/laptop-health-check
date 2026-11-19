# CLAUDE.md — panduan untuk Claude Code

Laptop Health Check: aplikasi desktop **offline**, **khusus macOS**, untuk memeriksa kesehatan hardware Mac.
Stack: **Tauri 2 · React 19 · TypeScript · Tailwind CSS v4 · Rust** · package manager **npm**.
Target: Mac Intel (x86_64) dan Apple Silicon (arm64). Distribusi: installer DMG + `.app` portable di flashdisk.

Baca juga: `PRD.md` (apa & mengapa), `ARCHITECTURE.md` (bagaimana), `ROADMAP.md` (fase), `TASKS.md` (pekerjaan berikutnya), `docs/FASE3-INTERACTIVE-TESTING-PRD.md` (rencana Fase 3).

## Aturan kerja (wajib)

- **Khusus macOS (scope resmi sejak 19 Nov 2026).** Jangan menambah fitur, kode, target build, atau job CI untuk Windows/Linux. `docs/archive/windows/` hanya riwayat dan bukan rencana aktif.
- **Alur Git wajib mengikuti `docs/GIT-WORKFLOW.md`.** Ringkasnya:
  - Commit dan push branch fitur hanya dengan izin eksplisit per aksi yang menyebut branch-nya. Tidak pernah push ke `main`.
  - **Jangan pernah membuat Pull Request** (`gh pr create`, API, atau tombol aplikasi) kecuali pemilik menulis persetujuan eksplisit "buat PR" beserta branch sumber/tujuan. PR dibuat sebagai **Draft**.
  - **Jangan pernah me-merge PR, mengaktifkan auto-merge, menghapus branch/tag, atau membuat release.** Merge ke `main` dilakukan pemilik di GitHub web setelah CI hijau.
  - Tidak ada `reset --hard`, `push --force`, atau penulisan ulang riwayat yang sudah di-push.
  - Setelah push, periksa ulang status PR tepat sebelum melapor, dan sebutkan bahwa status bisa berubah.
  - Membaca status (`git status/log/fetch`, `gh ... view`, `gh api` GET) boleh tanpa izin.
- **Jangan menghapus file penting** atau menimpa konfigurasi Git yang sudah benar. Penghapusan file harus seizin pemilik.
- **Kerja per fase.** Jangan membangun seluruh fitur sekaligus. Di akhir setiap fase, laporkan hasilnya dan tunggu persetujuan.
- **Disk mesin dev terbatas** (~25 GB kosong). Hindari dependency yang tidak perlu. Jangan memasang target Rust tambahan atau build rilis besar tanpa alasan. Bersihkan artefak sementara bila aman.
- **Offline total.** Dilarang menambah kode/plugin jaringan, aset dari CDN, font web, telemetri, atau auto-update daring. Tanpa akun pengguna. Informasi perangkat tidak boleh dikirim tanpa persetujuan eksplisit.
- **Hanya data nyata.** Jangan pernah menampilkan nilai contoh, simulasi, *mock*, atau tebakan sebagai hasil diagnosis. Data yang tidak bisa dibaca menjadi `Status::Unknown` (atau `NotApplicable` bila memang tidak berlaku) beserta alasannya. **Jangan anggap komponen sehat hanya karena datanya tidak tersedia**: `Healthy` butuh bukti inti (`Findings::status(has_core_evidence)`). Data palsu hanya boleh ada di test (`platform/fake.rs`, contoh format berlabel "BUKAN data perangkat asli").
- **Data eksperimental** (mis. sensor Apple Silicon yang belum terverifikasi, atau ambang tes interaktif yang belum dikalibrasi) wajib ditandai `experimental: true` (field `Metric.experimental`), hanya berupa informasi, dan **tidak boleh mengubah status** sebelum terverifikasi di hardware asli. Jangan menyebut sebuah platform atau modul "terverifikasi" sebelum lolos uji Mac asli (L3). Hasil CI di VM bukan bukti hardware. Apple Silicon tetap berstatus **Pratinjau** sampai lolos L3.
- **Tes interaktif (Fase 3):** hasil yang berasal dari pengamatan pengguna wajib diberi label "dikonfirmasi pengguna" dan tidak boleh disajikan sebagai hasil pengukuran. Izin kamera/mikrofon hanya diminta setelah pengguna mencentang persetujuan dan memulai tes tersebut. Jangan menyimpan rekaman audio/video/gambar ke disk atau mengirimnya; pengecualian (keputusan pemilik 19 Nov 2026): tes mikrofon boleh merekam ≤5 dtk **hanya di memori jendela tes media**, diputar ulang setelah mikrofon mati, lalu dibuang. Uji nyata kamera/mikrofon hanya dengan persetujuan pemilik per tes. Jangan mengubah volume, kecerahan, Wi-Fi/Bluetooth, atau pengaturan sistem lain. Jangan menampilkan atau mencatat alamat MAC, SSID/BSSID, atau nama perangkat Bluetooth/USB.
- **API native (read-only/UI saja):** CoreWLAN hanya membaca status antarmuka (tanpa `ssid`/`bssid`/`hardwareAddress`/scan); Bluetooth/USB/Thunderbolt/audio via `system_profiler` dengan kunci identitas disaring; NSTouchBar hanya selama tes Touch Bar dan selalu dilepas; NSSavePanel untuk ekspor laporan (aplikasi tidak menulis ke path yang tidak dipilih pengguna). Uji koneksi internet **belum diizinkan** (aturan offline) — menunggu keputusan pemilik.
- **Akses kamera/mikrofon hanya di jendela tes media terpisah** (`media_window.rs`: dibuat per sesi, *incognito*, dihancurkan setelahnya; jendela utama selalu ditolak) **dan hanya lewat `src/lib/media/session.ts`** (gerbang izin Rust `media_gate.rs`, tolak secara default). WebKit mengingat izin per halaman, jadi jangan meminta media di jendela yang hidup lebih lama dari satu sesi. Jangan memanggil `getUserMedia` langsung di komponen, jangan melonggarkan handler izin (mis. mengembalikan `Allow`/`Default` tanpa gerbang), dan jangan menambah izin WebView lain. Listener keyboard hanya dipasang di jendela aplikasi selama tes terbuka; catat `KeyboardEvent.code`, jangan pernah teks yang diketik.
- **Kesehatan hardware ≠ keamanan OS/kepemilikan.** Kategori `deviceSecurity` tidak memengaruhi `HardwareSummary`. Bila data inti tidak tersedia, hasilnya "Pemeriksaan belum lengkap", tidak pernah "Sehat".
- **Read-only terhadap hardware.** Pembacaan SMC hanya memakai perintah baca; jangan pernah menambah perintah tulis SMC atau apa pun yang mengubah kipas, daya, atau konfigurasi sistem. SMC gagal = `Unknown` + kendala.
- **Belum ada uji beban CPU** (stress test) sampai pemilik menyetujuinya.
- **Activation Lock & MDM** wajib selalu menampilkan keterbatasan deteksi; hasilnya bukan jaminan bebas penguncian atau bukti kepemilikan.
- **Nomor seri disembunyikan secara default.** Hanya dibaca lewat command terpisah saat pengguna memilih "Tampilkan", dan tidak masuk laporan kecuali dipilih saat ekspor. *Fixture* test wajib dibersihkan dari nomor seri asli.
- Jangan menghapus cache global (misalnya `~/.npm`, `~/.cargo/registry`) tanpa izin.
- Komunikasi dengan pemilik dalam **bahasa Indonesia**. UI dwibahasa: **id-ID (default)** dan **en-US**.
- **i18n wajib terpusat.** Jangan menulis teks UI langsung di komponen; pakai `t("kunci")` dari `useI18n()` dan tambahkan entri `{ id, en }` di `src/i18n/ui.ts`. Pesan dari Rust memakai `tr!("kode", teks_indonesia, param = nilai)` (`diagnostics/text.rs`), dengan entri di `src/i18n/backend.ts`. `npm test` menolak kode tanpa terjemahan, kunci yang tidak terpakai, dan placeholder yang berbeda. Jangan menerjemahkan nama hardware, nomor seri, kode teknis, atau perintah sumber data. Jangan mengubah logika penilaian demi terjemahan. Tanpa layanan penerjemah online.
- **Tema** memakai kelas `dark` di `<html>` (default Gelap). Selalu beri pasangan `dark:` dan hindari teks kontras rendah (`text-slate-400` di latar terang).

## Perintah

```bash
npm install                 # dependency frontend
npm run tauri dev           # jalankan aplikasi (Vite :1420 + jendela Tauri)
npm run build               # tsc + vite build -> dist/
npm run typecheck           # tsc --noEmit
npm test                    # node --test "src/**/*.test.ts"
npm run tauri build         # bundle rilis (.app/.dmg di macOS) — berat, minta izin dulu

cd src-tauri
cargo test                  # unit + parser (fixture) + integrasi ringan macOS
cargo test -- --ignored smc --nocapture          # SMC perangkat asli (cetak sensor)
LHC_REPORT_OUT=/tmp/r.json cargo test dump_real_report -- --ignored   # laporan nyata ke JSON
cargo clippy --all-targets -- -D warnings
cargo fmt --check
cargo clean                 # bersihkan target (±1,5–2 GB) setelah verifikasi

sh scripts/capture-macos-fixtures.sh <nama-perangkat>   # fixture tersanitasi (mis. Apple Silicon)

# Verifikasi izin kamera/mikrofon (hasil: satu baris "[selfcheck] {json}", lalu app keluar)
LHC_SELFCHECK=media-passive npm run tauri dev           # tanpa getUserMedia (aman di dev)
open -n -W --env LHC_SELFCHECK=media-isolation --stdout /tmp/sc.out "src-tauri/target/release/bundle/macos/Laptop Health Check.app"   # otomatis, tanpa kamera/mikrofon
# media-dryrun (tombol, tanpa media) · media-camera / media-microphone / media-deny: hanya dengan persetujuan pemilik
```

Jangan menjalankan mode yang meminta media lewat `tauri dev`: di mode dev, macOS mengaitkan izin TCC ke aplikasi induk (Terminal/Claude), bukan ke Laptop Health Check. WebKit menanyakan TCC **sebelum** handler izin aplikasi, sehingga `media-deny` pun bisa memunculkan dialog izin macOS bila izin belum pernah diputuskan. `media-deny`, `media-camera`, dan `media-microphone` hanya dijalankan dengan persetujuan pemilik, satu per satu. Pemilik menekan tombol Mulai di jendela; kamera/mikrofon aktif maksimal 10 detik.

Rust ada di `~/.cargo/bin`. Shell baru otomatis memuatnya. Di shell non-login jalankan dulu `. "$HOME/.cargo/env"`.

## Struktur dan aturan lapisan

```
src/                      frontend
  types/diagnostics.ts    CERMIN tipe Rust — wajib diperbarui bila types.rs berubah
  lib/api.ts              satu-satunya tempat memanggil invoke()
  lib/status.ts           helper murni (dites dengan node --test)
  i18n/                   katalog id/en (ui.ts, backend.ts) + translate.ts
  lib/preferences.tsx     provider tema/bahasa (settings.json lokal via Rust)
  components/, pages/
src-tauri/src/
  commands.rs             command Tauri tipis; kerja blocking -> spawn_blocking
  diagnostics/            PENILAIAN (tanpa API OS); raw.rs = data mentah macOS
  platform/               PEMBACAAN data mentah (trait Platform, alias Current = MacOs)
    macos/                satu modul per sumber; parser murni + command.rs (timeout) + smc.rs
src-tauri/fixtures/       output asli tersanitasi untuk test parser
```

- `platform/*` hanya membaca data. `diagnostics/*` yang menilai (Sehat/Peringatan/Kritis/Tidak diketahui/Tidak berlaku), dengan ambang sebagai konstanta bernama dan alasan (`Reason`) untuk setiap status.
- Sumber data baru: tambah method di trait `Platform`, lalu implementasikan di `platform/macos/`, `unsupported.rs` (fallback OS lain, selalu error), **dan** `fake.rs`.
- Perintah sistem dipanggil lewat `platform/macos/command.rs` dengan **path absolut** (`bin::SYSCTL`, bukan `sysctl`) dan batas waktu.
- Hindari fitur yang butuh hak admin. Bila data tidak tersedia, kembalikan `Status::Unknown` dengan penjelasan, jangan sampai panic.
- Serde `rename_all = "camelCase"` di semua tipe IPC. Test `serializes_camel_case_for_frontend` menjaga kecocokan dengan TypeScript.
- Frontend: tanpa router/state library (navigasi `useState`). Tanpa inline `style=` karena CSP produksi `style-src 'self'`. Pakai class Tailwind saja.
- File test TS memakai sintaks yang bisa di-*erase* (`erasableSyntaxOnly`), mengimpor modul lokal dengan ekstensi `.ts`, dan mengimpor tipe dengan `import type`.

## Menambah pemeriksaan baru

Ikuti langkah di `ARCHITECTURE.md` §5. Wajib ada: test parser terhadap fixture tersanitasi, unit test **setiap batas** ambang di `assess`, dan test integrasi ringan di `platform/macos/`.

## Definisi selesai (per perubahan)

`npm run typecheck` · `npm test` · `npm run build` · `cargo fmt --check` · `cargo clippy --all-targets -- -D warnings` · `cargo test`. Semuanya harus hijau, lalu perbarui `TASKS.md`.

## Catatan environment

- Mesin dev: MacBook Intel (x86_64), macOS 26, Xcode **Command Line Tools** saja (tanpa Xcode penuh; cukup untuk desktop).
- Jalur Apple Silicon (sensor SMC, core P/E, format system_profiler) belum diverifikasi di perangkat asli. CI `macos-arm64` hanya membuktikan kompilasi dan smoke test di VM.
- Mesin dev (MacBookPro16,2) punya Touch Bar, sehingga tes Touch Bar Fase 3 bisa diverifikasi di sini.
- Proses ini tidak punya izin *Screen Recording*, jadi `screencapture` jendela native gagal. Untuk pratinjau visual, pakai browser pane dengan laporan JSON nyata dari `dump_real_report`, dan beri label jelas.
- Profil dev mengompilasi dependency tanpa debuginfo (lihat `Cargo.toml`) untuk menghemat disk.
