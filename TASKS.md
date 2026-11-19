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

## Fase 3 — Interactive Hardware Testing (branch `feature/complete-hardware-tests`, belum di-commit)

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
- [x] 3.3b Touch Bar: deteksi hardware (IORegistry "Touch Bar Display/Backlight" + TouchBarServer, bukan nama model), 8 tombol uji NSTouchBar (`touchbar.rs`, dipasang di NSWindow + WKWebView, dilepas saat selesai/batal + pengaman 600 dtk), F1–F12 lewat `code`, konfirmasi tampilan. **Belum diuji di Touch Bar fisik** (sesi native 19 Nov tidak menjalankannya).
- [x] 3.4 Trackpad: kisi gerak 6×4, klik primer/sekunder/ganda, gulir V/H, seret-lepas, cubit (GestureEvent/ctrl+wheel), Force Click opsional; gestur 3/4 jari & rasa klik = dikonfirmasi pengguna. ✅ Uji native pemilik 19 Nov 2026 (WKWebView, build produksi Intel): Lulus — 24/24 sel, 7/7 fungsi wajib, cubit (event gesture WebKit) dan Force Click (webkitmouseforce) terukur; gestur 3/4 jari & rasa klik dikonfirmasi pengguna.
- [x] 3.5a Speaker: Web Audio kiri/kanan/stereo, gain 0,08 (maks 0,1), hanya setelah klik; peringatan bila output default bukan speaker bawaan. **Belum diuji dengar.**
- [x] 3.5b Mikrofon: jendela media terpisah + persetujuan, meter level (eksperimental), rekaman ≤5 dtk hanya di memori, diputar setelah mikrofon mati. **Uji nyata menunggu persetujuan pemilik.**
- [x] 3.6 Kamera: jendela media terpisah + persetujuan, pratinjau ≤10 dtk, jumlah frame terukur, konfirmasi gambar & lampu. ✅ Dijalankan pemilik 19 Nov 2026: Lulus — 640×480 30 fps, 124 frame; log macOS: 1 dialog izin (diizinkan), tepat 1 stream kamera (±5 dtk) lalu berhenti, gerbang tertutup, 0 file media, 0 proses tersisa.
- [x] 3.7 Wi-Fi (CoreWLAN tanpa scan/SSID; rute `scutil --nwi`) dan Bluetooth (`system_profiler`, tanpa nama/alamat). Uji internet aktif: menunggu keputusan pemilik (aturan offline).
- [x] 3.8 USB/Thunderbolt: bus/receptacle/pengontrol, tes colok manual (potret sebelum/sesudah); port kosong ≠ rusak. **Belum diuji dengan perangkat dicolok.**
- [ ] 3.8b Pengisian daya, jack audio, layar eksternal, kartu SD (belum)
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
- [x] Uji native ulang oleh pemilik (19 Nov 2026, build produksi `105d168`, 5 sesi):
  - P1: Esc dan tombol Keluar membatalkan Tes Layar 4× ("Dibatalkan" setelah 2 atau 4 dari 7 pola), layar penuh kembali normal, log "fokus ok";
  - Tes Layar 7/7 pola Lulus (dikonfirmasi pengguna); Tes Keyboard 64/64 Lulus, fn tercatat "tidak terbaca" (P2);
  - Tes 0 (`media-dryrun`): berhenti oleh tombol setelah 2,03 dtk, gerbang ditolak dari jendela utama & jendela latihan, 0 pelanggaran;
  - P5: tidak ada tulisan baru di `~/Library/WebKit|Caches/com.ezraanugrah.laptophealthcheck`;
  - 0 dialog TCC, 0 akses kamera/mikrofon, 0 stream, 0 proses tersisa, 0 crash.

## Fase 4 — Reports & UI/UX

### Tampilan & bahasa ✅ (di `main` lewat PR #3)
- [x] Tema Terang/Gelap: kelas `dark`, default Gelap, perubahan instan, kontras teks diperbaiki (`slate-400` → `slate-500/600` di latar terang)
- [x] Preferensi lokal `settings.json` (Rust `settings.rs`, 5 test), dengan fallback per field
- [x] i18n terpusat id-ID/en-US (`src/i18n`):
  - 194 kode backend dan 321 kunci UI;
  - fallback dan kunci bertingkat;
  - format tanggal dan durasi per bahasa.
- [x] Backend berkode (`text.rs`, `tr!`) untuk semua 9 pemeriksaan, catatan keterbatasan, dan catatan dukungan. Logika tidak berubah: teks laporan Mac asli identik 75/75.
- [x] ~~Halaman Pengaturan~~ → diganti header global (lihat di bawah)
- [x] Test: 17 test i18n/pengaturan baru (frontend total 64), 140 test Rust
- [x] Uji browser 900×600 kedua bahasa: tanpa teks terpotong, tanpa kunci hilang
- [x] Uji native: default, baca file setelah restart, file rusak → default, tanpa akses kamera/mikrofon, isolasi media lulus
- [x] Uji tangan pemilik (19 Nov 2026): simpan lewat UI (Terang/Gelap, English/Indonesia) tercatat di log; setelah restart app membaca English lalu Gelap + Indonesia dari `settings.json`

### Header global: tema & bahasa (working tree, belum di-commit)
- [x] Header di area konten (`src/components/header/`): judul halaman aktif di kiri, dropdown bahasa (🇮🇩 ID / 🇬🇧 EN) dan tombol tema (ikon matahari/bulan + label) di kanan; di luar area gulir sehingga selalu terlihat; `z-30` di bawah overlay tes (`z-40`/`z-50`)
- [x] Dropdown aksesibel (pola menu WAI-ARIA): Enter/Spasi/↓/↑ membuka, ↑/↓/Home/End, Esc menutup & mengembalikan fokus, klik di luar menutup, `menuitemradio` + `aria-checked`, `lang` per nama bahasa
- [x] Memakai `PreferencesProvider` & i18n yang ada (kunci `prefs.*`); galat simpan tampil ringkas di header
- [x] Halaman & menu Pengaturan dihapus (disetujui pemilik); judul `h1` halaman pindah ke header; `settings.json` tidak berubah
- [x] Test: helper menu bahasa/tema & navigasi menu (frontend total 67)
- [x] Uji browser 900×600: default Gelap+ID, ganti bahasa/tema instan, tersimpan setelah *reload*, semua halaman konsisten, menu tidak terpotong, overlay Tes Layar/Keyboard menutupi header, Spasi/Enter di Tes Keyboard tidak memicu tombol header
- [ ] Uji native: header saat pertama dibuka, ganti tema/bahasa, restart **(izin build)**

### Laporan ✅ (branch `feature/complete-hardware-tests`, belum di-commit)
- [x] Halaman Laporan: ringkasan perangkat, 9 pemeriksaan, 10 tes interaktif (belum diuji/belum tersedia tidak pernah Lulus), catatan; dua bahasa
- [x] Ekspor JSON (`schemaVersion` 1) ke lokasi pilihan pengguna lewat NSSavePanel (`report_export.rs`: validasi JSON, nama file aman, tulis atomik, hanya jendela utama)
- [x] Ekspor PDF lewat dialog cetak macOS (Simpan sebagai PDF); versi cetak hitam-putih terpisah (`PrintableReport`)
- [x] Opsi "sertakan nomor seri" (default: tidak; dibaca hanya saat dicentang)
- [ ] Uji native ekspor JSON & PDF (butuh klik pemilik di dialog)
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
