# Roadmap — Laptop Health Check

Pengembangan dilakukan bertahap. **Setiap fase diakhiri laporan dan persetujuan sebelum lanjut ke fase berikutnya.**

| Fase | Nama | Status |
|---|---|---|
| 0 | Persiapan environment & repo | ✅ Selesai |
| 1 | Fondasi proyek | ✅ Selesai & disetujui |
| 2 | Diagnostik inti macOS | ⏳ Berikutnya (rencana menunggu persetujuan) |
| 3 | Diagnostik inti Windows + CI | Direncanakan |
| 4 | Tes interaktif | Direncanakan |
| 5 | Skor kesehatan & laporan PDF/JSON | Direncanakan |
| 6 | Mode portable & packaging | Direncanakan |
| 7 | QA & rilis 1.0 | Direncanakan |
| — | Linux | Ditunda |

Prinsip yang berlaku di semua fase: offline-first, tanpa akun, tanpa telemetri, nomor seri disembunyikan secara default, dan **hanya data nyata** (tidak ada hasil simulasi yang ditampilkan sebagai diagnosis).

---

### Fase 0 — Persiapan ✅
Git di-init (`main`), remote `origin` terhubung ke GitHub, dan environment dicek (Xcode CLT, Node, npm). Rust dipasang via rustup.

### Fase 1 — Fondasi ✅
- Scaffold Tauri 2 + React + TypeScript + Tailwind CSS v4 di folder proyek.
- Konfigurasi awal: identitas aplikasi, jendela, CSP offline, target bundle (dmg/nsis), WebView2 offline, profil build hemat disk.
- Struktur modular `diagnostics/` (penilaian) dan `platform/` (macOS/Windows).
- Satu pemeriksaan aktif: **Sistem**. Pemeriksaan lain masih kerangka berstatus "Segera hadir".
- UI awal: sidebar, Ringkasan, Tentang, halaman placeholder.
- Dokumen PRD, ARCHITECTURE, ROADMAP, TASKS, dan CLAUDE.md, beserta keputusan produk.
- Pemeriksaan: build, typecheck, clippy, fmt, test Rust + frontend. Aplikasi berjalan di macOS (mode dev dan produksi).

### Fase 2 — Diagnostik inti macOS
Baterai, SSD/HDD, CPU, RAM, temperatur, kipas, GPU, dan nomor seri (*opt-in*) di macOS. Diuji langsung di Intel; Apple Silicon diuji bila ada perangkat.
**Kriteria selesai:** setiap pemeriksaan memberi status dari data nyata, atau "Tidak diketahui"/"Tidak berlaku" beserta alasannya. Dilengkapi unit test ambang penilaian dengan *fixture* dari perangkat asli dan uji di mesin nyata.

### Fase 3 — Diagnostik inti Windows + CI
- Implementasi `platform/windows.rs` (WMI/Win32) untuk semua pemeriksaan inti.
- GitHub Actions: build + test di `windows-latest` dan `macos-latest`. CI tidak memakai disk lokal. Workflow baru dibuat setelah disetujui, karena menambah file di repo.

**Kriteria selesai:** CI hijau di Windows dan macOS, diuji di minimal satu laptop Windows 10/11 asli.

### Fase 4 — Tes interaktif
Keyboard, layar (piksel mati), speaker, mikrofon, kamera, touchpad, port USB.
**Kriteria selesai:** setiap tes bisa dijalankan dan hasilnya (lulus/gagal/dilewati) tercatat.

### Fase 5 — Skor kesehatan & laporan
Skor 0–100, riwayat pemeriksaan, ekspor **PDF dan JSON**. Nomor seri hanya disertakan bila dipilih pengguna.
**Kriteria selesai:** laporan bisa diekspor dan dibuka di perangkat lain tanpa internet.

### Fase 6 — Mode portable & packaging
- Deteksi mode portable (file penanda), folder data di samping aplikasi, dan fallback bila USB *read-only*.
- Windows portable: deteksi WebView2 Runtime sebelum jendela dibuat, lalu pesan native berisi instruksi bila belum ada.
- Build universal macOS (Intel + Apple Silicon), installer NSIS dengan WebView2 offline, serta `.exe` portable.
- Keputusan *code signing*/notarisasi.

**Kriteria selesai:** installer dan versi portable lulus uji offline di ketiga platform target.

### Fase 7 — QA & rilis 1.0
Uji lintas perangkat, perbaikan bug, aksesibilitas, dokumentasi pengguna, rilis di GitHub Releases.
