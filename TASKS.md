# Tasks — Laptop Health Check (khusus macOS)

Legenda: `[x]` selesai · `[ ]` belum · **(izin)** = butuh persetujuan pemilik sebelum dikerjakan

Tingkat verifikasi: L0 kompilasi · L1 logika/parser · L2 smoke di VM CI · **L3 Mac asli**.

## Fase 1 — Foundation ✅

- [x] Rust stable (rustc/cargo 1.100.0, rustfmt, clippy)
- [x] Scaffold Tauri 2 + React 19 + TS + Tailwind CSS v4 (`@tailwindcss/vite`)
- [x] `tauri.conf.json`: nama, bundle ID, jendela, CSP offline, `freezePrototype`
- [x] `Cargo.toml`: metadata + profil dev hemat disk
- [x] Struktur modular: `commands.rs`, `diagnostics/`, `platform/`
- [x] Pemeriksaan **Sistem**, UI awal (Sidebar, Ringkasan, Tentang, mode gelap)
- [x] Dokumen: PRD, ARCHITECTURE, ROADMAP, TASKS, CLAUDE.md, README
- [x] Commit pertama `626b4a5` dan push ke `origin/main` (disetujui pemilik)

## Fase 2 — macOS Core Diagnostics ✅ Intel · ⚠️ Apple Silicon

Aturan: hanya data nyata; data yang tidak tersedia menjadi "Tidak diketahui"/"Tidak berlaku" beserta alasannya; fixture test berasal dari output perangkat asli yang disanitasi.

- [x] Model data: 5 status, alasan bertingkat, sumber data, keterbatasan
- [x] Helper perintah ber-timeout (tanpa shell, path absolut) + konversi plist via `plutil`
- [x] `scripts/capture-macos-fixtures.sh` + fixture tersanitasi `intel-macbookpro16-2`
- [x] Battery, SSD/HDD, RAM, CPU & status termal, Suhu (SMC read-only), Kipas, GPU, Activation Lock & MDM, nomor seri *opt-in*
- [x] UI: kartu per pemeriksaan, alasan berwarna, sumber data, keterbatasan, tombol "Periksa ulang"
- [x] L3 di MacBook Intel asli (MacBookPro16,2): data asli tampil, tanpa crash
- [x] Masuk ke `main` lewat PR #1 → `21a5f43`. PR ini dibuat dan di-merge tanpa persetujuan eksplisit pemilik; lihat `docs/GIT-WORKFLOW.md` §5.
- [x] Penyempurnaan dari Milestone 3.0, masuk ke `main` lewat PR #2 → `851586b` (di-merge pemilik): kategori inti/pelengkap/perangkat, `HardwareSummary` ("Pemeriksaan belum lengkap"), `PlatformSupport` + banner pratinjau, field `Metric.experimental`, `Platform::notes`, CI macOS
- [ ] Pasang ruleset proteksi `main` (dilakukan pemilik; panduan di `docs/GIT-WORKFLOW.md` §4). Per 19 Nov 2026 belum ada ruleset aktif.

### Belum terverifikasi
- [ ] **Apple Silicon (L3)**: pola sensor SMC (`Tp/Te/Tg`), data kipas (`flt`), core P/E, format `SPMemoryDataType`/`SPDisplaysDataType`, kapasitas baterai via `AppleRawMaxCapacity`, `pmset` tanpa `CPU_Speed_Limit`, layanan `AppleSMC`. Butuh fixture asli: `sh scripts/capture-macos-fixtures.sh <nama-perangkat>`. CI arm64 (VM) sudah lolos, tetapi itu bukan bukti hardware.
- [ ] Mac Intel lain (GPU diskret AMD, HDD/SATA, tanpa chip T2)
- [ ] Keausan SSD (persentase, TBW, jam pakai): tidak tersedia tanpa admin, jadi ditampilkan sebagai keterbatasan
- [ ] Uji beban CPU: sengaja tidak dibuat (keputusan pemilik)

## Penyesuaian scope khusus macOS (branch `feature/macos-only`, dari `main` @ `851586b`)

- [x] Sinkronisasi aman: `git fetch`, `main` lokal di-*fast-forward* dari `21a5f43` ke `851586b`. Isi tree `851586b` identik dengan commit Milestone 3.0 `538ddd3`.
- [x] Kode Windows dikeluarkan: `platform/windows/`, cfg Windows di `platform/mod.rs`, tipe/field khusus Windows di `raw.rs` (OsSupport, CapacityUnit, DiskHealth, ThermalZone, OwnershipFamily, DirectoryJoin, dll.), aturan penilaian Windows, dan 22 test khusus Windows (4 test macOS hanya berganti nama, 1 test baru)
- [x] Frontend: judul kartu dan teks hanya untuk macOS (`checkTitle`, `missingText`)
- [x] `tauri.conf.json`: target bundle `app` + `dmg` (NSIS/WebView2 dihapus), deskripsi Mac
- [x] CI: hanya `macos-intel` (macos-15-intel) dan `macos-arm64` (macos-latest)
- [x] Dokumen diperbarui untuk macOS. PRD Windows diarsipkan di `docs/archive/windows/`
- [x] Validasi lokal: typecheck, 8 test frontend, build, fmt, clippy, 112 test Rust + 2 test perangkat asli. Hasil L3 sama dengan sebelum perubahan (Hardware Peringatan 7/7: baterai dan SSD Peringatan).
- [ ] Commit di `feature/macos-only` **(izin)** · push branch **(izin)** · verifikasi CI macOS (L0–L2)

### Riwayat Windows (dibatalkan 19 Nov 2026)
- Milestone 3.0 di-merge lewat PR #2 (`851586b`). Job CI `windows` gagal di PR tersebut (run `44461751812` dan `44461836379`, clippy `dead_code` untuk varian yang tidak dibuat di build Windows). Job macOS lolos. Masalah ini tidak diperbaiki karena kode Windows dikeluarkan.
- Modul Windows 3.1–3.9 tidak dikerjakan. Rencana lama: [`docs/archive/windows/FASE3-WINDOWS-PRD.md`](docs/archive/windows/FASE3-WINDOWS-PRD.md). Kodenya tetap ada di riwayat Git (`538ddd3`).

## Fase 3 — Interactive Hardware Testing (berjalan, working tree `feature/macos-only`, belum di-commit)

Rencana dan hasil: [`docs/FASE3-INTERACTIVE-TESTING-PRD.md`](docs/FASE3-INTERACTIVE-TESTING-PRD.md) (hasil Milestone 3.0 di §15).

- [x] 3.0 Keamanan kamera/mikrofon:
  - handler izin tolak-default (`media_gate.rs`, 8 test);
  - kunci API capture global;
  - sesi media dengan penghentian *track* otomatis (11 test);
  - `Info.plist` usage description;
  - penjaga statis (3 test).
- [x] 3.0 Verifikasi dev + build produksi (`LHC_SELFCHECK`):
  - `tauri://` adalah *secure context*;
  - permintaan dengan gerbang tertutup ditolak;
  - API terkunci tidak menyentuh TCC;
  - tidak ada proses tersisa.
- [x] 3.0 Verifikasi manual oleh pemilik (19 Nov 2026). Tes A pertama menemukan izin WebKit terbawa dalam halaman yang sama. Perbaikannya **jendela media terpisah** (per sesi, *incognito*, dihancurkan; jendela utama selalu menolak), lalu lulus:
  - isolasi otomatis;
  - Tes 0 (tombol);
  - Tes A (kamera);
  - Tes B (mikrofon);
  - Tes C (penolakan).

  Detail di PRD Fase 3 §15.5. Masih menunggu konfirmasi pengamatan lampu kamera dan titik oranye.
- [x] 3.1 Fondasi:
  - model 5 status (Belum diuji/Lulus/Gagal/Tidak tersedia/Dibatalkan) dengan label terukur vs dikonfirmasi pengguna;
  - halaman "Tes Interaktif";
  - profil perangkat (Touch Bar dari tabel model, 4 test).
- [x] 3.2 Tes Layar: 7 pola, *simple fullscreen*, kontrol tersembunyi otomatis, keluar dengan Esc/tombol; hasil selalu "dikonfirmasi pengguna"
- [x] 3.3a Tes Keyboard:
  - tata letak ANSI/ISO, baris fisik/Touch Bar;
  - hanya `KeyboardEvent.code` saat jendela tes aktif;
  - deteksi ketikan ganda (eksperimental);
  - tahan Esc untuk keluar.
- [ ] 3.2/3.3a L3 di jendela native: diuji di browser pane (Chromium) dengan event otomasi. Belum diuji tangan di WKWebView native: tombol fn/Caps Lock/F-keys asli dan *fullscreen* native. Butuh pemilik karena proses ini tidak punya izin Screen Recording atau kontrol desktop.
- [ ] 3.3b Touch Bar (bisa diuji L3 di MacBookPro16,2)
- [ ] 3.4 Trackpad
- [ ] 3.5 Speaker dan mikrofon (wajib lewat jendela media terpisah)
- [ ] 3.6 Webcam (wajib lewat jendela media terpisah)
- [ ] 3.7 Wi-Fi dan Bluetooth (tanpa koneksi)
- [ ] 3.8 USB/Thunderbolt, pengisian daya, jack audio, layar eksternal, kartu SD
- [ ] 3.9 Validasi L3 di Mac Intel asli + daftar periksa `docs/FASE3-L3-CHECKLIST.md`
- [ ] Persetujuan sisa keputusan D1–D9 (PRD Fase 3 §12); D6 (pengaman ⌘Q) tidak mungkin dibuat dan diganti peringatan

### Keterbatasan Apple Silicon (Fase 3)
- Tes Layar dan Keyboard tidak bergantung arsitektur, tetapi belum diuji di Mac Apple Silicon.
- MacBook Pro 14"/16" berponi: area di samping kamera mungkin tidak tercakup Tes Layar.
- Tabel Touch Bar mengenal MacBookPro17,1 (M1) dan Mac14,7 (M2). Model Apple Silicon lain dianggap "tidak diketahui", sehingga pengguna memilih baris fungsi.
- Perilaku izin TCC/WebKit hanya diverifikasi di macOS 26 Intel.

## Perbaikan setelah uji native Display/Keyboard (P1–P5) ✅

- [x] P1 Fokus keyboard di layar penuh (Rust `set_focus` setelah *simple fullscreen*, fokus ke area pola, Esc ditangkap di fase *capture*)
- [x] P2 Sinyal dari tombol "tidak bisa diuji" (fn, Touch ID) dicatat sebagai info, tanpa mengubah hasil
- [x] P3 Pertanyaan lampu latar dengan petunjuk cek pengaturan dan 4 jawaban (rusak hanya bila tetap mati setelah dicek)
- [x] P4 Penanda "N catatan" di kartu Lulus, tanpa status baru
- [x] P5 Jendela utama *incognito*: tidak ada jejak WebKit di disk (terverifikasi native)
- [ ] Uji native ulang P1 (Esc di layar penuh) oleh pemilik

## Fase 4 — Reports & UI/UX

### Tampilan & bahasa ✅ (working tree `feature/macos-only`, belum di-commit)
- [x] Tema Terang/Gelap: kelas `dark`, default Gelap, perubahan instan, kontras teks diperbaiki (`slate-400` → `slate-500/600` di latar terang)
- [x] Preferensi lokal `settings.json` (Rust `settings.rs`, 5 test), dengan fallback per field
- [x] i18n terpusat id-ID/en-US (`src/i18n`):
  - 194 kode backend dan 321 kunci UI;
  - fallback dan kunci bertingkat;
  - format tanggal dan durasi per bahasa.
- [x] Backend berkode (`text.rs`, `tr!`) untuk semua 9 pemeriksaan, catatan keterbatasan, dan catatan dukungan. Logika tidak berubah: teks laporan Mac asli identik 75/75.
- [x] Halaman Pengaturan (Tampilan, Bahasa, status tersimpan)
- [x] Test: 17 test i18n/pengaturan baru (frontend total 64), 140 test Rust
- [x] Uji browser 900×600 kedua bahasa: tanpa teks terpotong, tanpa kunci hilang
- [x] Uji native: default, baca file setelah restart, file rusak → default, tanpa akses kamera/mikrofon, isolasi media lulus
- [ ] Uji tangan pemilik: ganti tema dan bahasa di app native, tutup, lalu buka lagi

### Laporan
- [ ] Ekspor JSON (`DiagnosticsReport` + hasil interaktif + metadata versi aplikasi)
- [ ] Ekspor PDF lokal (putuskan: crate PDF Rust vs. cetak WebView ke PDF)
- [ ] Opsi "sertakan nomor seri" saat ekspor (default: tidak)
- [ ] Riwayat pemeriksaan lokal
- [ ] Ringkasan kesehatan gabungan (otomatis + interaktif)

## Fase 5 — Distribution

- [ ] Build Intel + Apple Silicon (`rustup target add aarch64-apple-darwin` bila perlu, atau *universal*) **(izin, disk)**
- [ ] DMG + verifikasi CSP produksi pada build rilis penuh (`npm run tauri build`) **(izin)**
- [ ] Mode portable: file penanda, folder data di samping aplikasi, fallback read-only, kajian Gatekeeper/*App Translocation*
- [ ] Keputusan *code signing* dan notarisasi (Apple Developer ID)
- [ ] Uji di Mac lain (Apple Silicon asli, Intel tanpa T2, Intel dengan GPU diskret)
- [ ] GitHub Releases (dibuat pemilik)

## Backlog

- [ ] Ikon aplikasi khusus (saat ini masih ikon bawaan Tauri)
- [ ] Putuskan: bahasa Inggris sejak 1.0? Skor 0–100? Versi macOS minimum? (PRD §9)
