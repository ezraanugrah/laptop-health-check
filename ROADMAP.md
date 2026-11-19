# Roadmap — Laptop Health Check (khusus macOS)

Pengembangan dilakukan bertahap. **Setiap fase, dan setiap checkpoint di dalam fase, diakhiri laporan dan persetujuan pemilik sebelum lanjut.**

| Fase | Nama | Status |
|---|---|---|
| 1 | Foundation | ✅ Selesai |
| 2 | macOS Core Diagnostics | ✅ Selesai untuk **Intel** (terverifikasi di MacBook Pro asli) · ⚠️ **Apple Silicon perlu validasi** di perangkat asli |
| 3 | Interactive Hardware Testing | 🚧 Berjalan: 3.0 keamanan media terverifikasi (jalur tolak), Tes Layar dan Keyboard dibuat; kamera/mikrofon ditahan ([PRD Fase 3](docs/FASE3-INTERACTIVE-TESTING-PRD.md) §15) |
| 4 | Reports & UI/UX | 🚧 Sebagian: tema Terang/Gelap dan bahasa Indonesia/English selesai; PDF/JSON dan riwayat direncanakan |
| 5 | Distribution | Direncanakan |
| — | Windows | ❌ Dibatalkan 19 Nov 2026 ([arsip](docs/archive/windows/FASE3-WINDOWS-PRD.md)) |
| — | Linux | Tidak direncanakan |

Prinsip yang berlaku di semua fase: offline-first, tanpa akun, tanpa telemetri, nomor seri disembunyikan secara default, read-only terhadap hardware, dan **hanya data nyata** (tidak ada hasil simulasi yang ditampilkan sebagai diagnosis).

Tingkat verifikasi: **L0** kompilasi · **L1** logika/parser (unit test + fixture) · **L2** smoke test di VM CI · **L3** Mac asli. Sebuah platform atau modul baru disebut "terverifikasi" setelah lolos L3.

---

### Fase 1 — Foundation ✅
- Environment, repo Git, dan Rust.
- Scaffold Tauri 2 + React 19 + TypeScript + Tailwind CSS v4.
- Konfigurasi: identitas aplikasi, CSP offline, profil build hemat disk.
- Struktur modular `platform/` (pembacaan) dan `diagnostics/` (penilaian).
- Pemeriksaan **Sistem**, UI awal (sidebar, Ringkasan, Tentang), dan dokumen produk.

### Fase 2 — macOS Core Diagnostics ✅ Intel · ⚠️ Apple Silicon
- 9 pemeriksaan berbasis data asli: Sistem, Baterai, SSD/HDD, RAM, CPU & status termal, Suhu, Kipas, GPU, serta Activation Lock & MDM. Nomor seri bersifat *opt-in*.
- SMC dibaca lewat FFI IOKit read-only. Semua batas ambang diuji; fixture tersanitasi berasal dari MacBookPro16,2.
- Penyempurnaan dari Milestone 3.0 yang dipertahankan: kategori pemeriksaan, `HardwareSummary` ("Pemeriksaan belum lengkap"), banner pratinjau Apple Silicon, field data eksperimental, dan CI GitHub Actions untuk macOS Intel dan arm64.
- Penyesuaian scope khusus macOS (branch `feature/macos-only`): kode Windows dikeluarkan.

**Sisa pekerjaan:** validasi di Mac Apple Silicon asli. Yang perlu dicek: pola sensor SMC, kipas, core P/E, format `system_profiler`, kapasitas baterai, dan `pmset`. Langkahnya adalah mengambil fixture dengan `sh scripts/capture-macos-fixtures.sh <perangkat>`, lalu menjalankan uji L3. Sampai saat itu, Apple Silicon tetap berstatus **Pratinjau**.

### Fase 3 — Interactive Hardware Testing
Tes yang dipandu dan melibatkan pengguna, dengan hasil berlabel **terukur** atau **dikonfirmasi pengguna**:
- layar/piksel mati;
- keyboard;
- trackpad;
- Touch Bar (bila ada);
- speaker;
- mikrofon;
- webcam;
- Wi-Fi/Bluetooth (deteksi adaptor dan status radio, tanpa koneksi);
- USB/Thunderbolt dan port lain yang bisa diverifikasi.

**Kriteria selesai:** setiap tes bisa dijalankan, dilewati, dan diulang. Hasilnya (Lulus / Gagal / Dilewati / Tidak berlaku / Tidak dapat dipastikan) tercatat beserta buktinya. Semua tes lolos L3 di Mac Intel asli. Tidak ada rekaman yang disimpan, tidak ada pengaturan sistem yang diubah, dan tidak ada akses jaringan. Detail: [`docs/FASE3-INTERACTIVE-TESTING-PRD.md`](docs/FASE3-INTERACTIVE-TESTING-PRD.md).

### Fase 4 — Reports & UI/UX
- Ekspor **PDF** dan **JSON**, dengan nomor seri hanya bila dipilih saat ekspor.
- Riwayat pemeriksaan lokal.
- Ringkasan kesehatan gabungan (otomatis + interaktif).
- Sumber data dan keterbatasan tampil di layar dan di laporan.
- Mode gelap/terang dengan opsi manual.

**Kriteria selesai:** laporan bisa diekspor dan dibuka di perangkat lain tanpa internet. Isi laporan sama dengan yang tampil di layar.

### Fase 5 — Distribution
- Build Intel dan build Apple Silicon (atau *universal binary*).
- Installer DMG.
- Mode portable di flashdisk: file penanda, folder data di samping aplikasi, dan fallback bila tidak bisa ditulisi. Kajian Gatekeeper dan *App Translocation* juga masuk di sini.
- Keputusan *code signing* dan notarisasi.
- GitHub Releases, dibuat oleh pemilik.
- Pengujian di beberapa Mac lain (Intel tanpa T2, Intel dengan GPU diskret, Apple Silicon M-series).

**Kriteria selesai:** DMG dan versi portable lulus uji offline di Mac Intel dan Apple Silicon asli.
