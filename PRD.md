# PRD — Laptop Health Check

| | |
|---|---|
| Versi dokumen | 0.3 (scope khusus macOS) |
| Tanggal | 19 November 2026 |
| Pemilik | Ezra Alfa Anugrahni |
| Status | Scope diubah resmi menjadi **khusus macOS** (19 Nov 2026, lihat §10). Fase 1 dan 2 selesai. Bagian bertanda **(asumsi)** masih perlu dikonfirmasi. |

## 1. Ringkasan

Laptop Health Check adalah aplikasi desktop **offline** untuk memeriksa kondisi perangkat keras **Mac**, yaitu MacBook dengan prosesor Intel maupun Apple Silicon. Hasilnya cepat dan mudah dipahami. Aplikasi dapat **dipasang lewat installer DMG** atau **dijalankan langsung dari flashdisk (portable)** tanpa dipasang.

## 2. Masalah

- Menilai kondisi MacBook, misalnya saat membeli unit bekas, menerima unit servis, atau mengaudit inventaris, butuh beberapa alat dan menu yang tersebar: System Information, Terminal, dan aplikasi pihak ketiga. Hasilnya sering terlalu teknis.
- Risiko khusus Mac bekas, yaitu Activation Lock dan MDM organisasi, tidak terlihat jelas oleh pembeli awam.
- Banyak alat diagnostik butuh internet, akun, atau instalasi. Itu merepotkan saat memeriksa Mac orang lain di lokasi.
- Belum ada ringkasan sederhana bertanda "baik / perlu perhatian / bermasalah" yang dilengkapi tes fungsi (layar, keyboard, trackpad, audio, kamera, port) dan laporan yang bisa disimpan.

## 3. Pengguna sasaran

| Prioritas | Persona | Kebutuhan utama |
|---|---|---|
| 1 | Pembeli MacBook bekas | Menilai baterai, penyimpanan, Activation Lock/MDM, dan fungsi dasar dalam beberapa menit, langsung dari flashdisk, tanpa memasang apa pun di Mac penjual |
| 1 | Teknisi servis Mac | Memeriksa sebelum dan sesudah servis, lalu menyimpan laporan PDF/JSON untuk pelanggan |
| 1 | Pengguna Mac pribadi | Mengetahui apakah baterai, SSD, atau kipas Mac-nya perlu perhatian |
| 2 | Staf IT / pengelola inventaris Mac | Pemeriksaan berkala banyak unit (sekunder) |

## 4. Tujuan dan non-tujuan

**Tujuan**
1. Pemeriksaan otomatis inti macOS (sistem, baterai, SSD, RAM, CPU, suhu, kipas, GPU, Activation Lock/MDM) dengan status yang jelas dan berbasis data nyata.
2. Tes perangkat keras interaktif yang dipandu, seperti layar, keyboard, trackpad, Touch Bar, audio, kamera, nirkabel, dan port (Fase 3).
3. Berjalan 100% offline, tanpa akun, tanpa telemetri.
4. Mendukung Mac Intel (x86_64) dan Apple Silicon (arm64).
5. Dua mode distribusi: installer DMG dan aplikasi portable di flashdisk.
6. Laporan hasil yang bisa disimpan atau diekspor (PDF dan JSON).

**Non-tujuan**
- **Windows**: dibatalkan pada 19 Nov 2026. Rencana lama diarsipkan di [`docs/archive/windows/`](docs/archive/windows/FASE3-WINDOWS-PRD.md) hanya sebagai riwayat.
- **Linux**: tidak direncanakan.
- Perbaikan otomatis, mengubah pengaturan sistem atau hardware (kipas, daya, kecerahan, volume, Wi-Fi/Bluetooth), dan pembaruan firmware.
- Uji beban (*stress test*) CPU/GPU, kecuali disetujui pemilik nanti, serta benchmark performa mendalam.
- Fitur berbasis cloud, sinkronisasi, atau akun.

## 5. Platform dan distribusi

| Platform | Status verifikasi | Installer | Portable |
|---|---|---|---|
| macOS Intel (x86_64) | **Terverifikasi** di MacBook Pro asli (MacBookPro16,2) untuk diagnostik otomatis | `.dmg` | `.app` dijalankan dari flashdisk |
| macOS Apple Silicon (arm64) | **Pratinjau**: kode sudah ada dan lolos CI di VM arm64, tetapi belum diuji di Mac Apple Silicon asli | `.dmg` | `.app` dijalankan dari flashdisk |

- Pilihan build (dua build per arsitektur atau satu *universal binary*) diputuskan di Fase 5.
- Versi macOS minimum belum ditetapkan **(asumsi)**: ditetapkan di Fase 5 setelah diuji. Mesin pengembangan memakai macOS 26.
- Aplikasi yang belum ditandatangani (Apple Developer ID) dan belum dinotarisasi akan diblokir Gatekeeper saat pertama dibuka. Hal ini juga memengaruhi mode portable (lihat §6.5 dan pertanyaan terbuka §9).

## 6. Fitur

### 6.1 Diagnostik otomatis ✅ (Fase 2)

| Pemeriksaan | Data yang dibaca (tanpa admin) | Kriteria utama |
|---|---|---|
| Sistem | Versi macOS, model, prosesor, core, RAM, arsitektur | Lengkap terbaca = Sehat |
| Baterai | Siklus vs batas desain, kapasitas penuh vs desain (mAh), kondisi menurut macOS, PermanentFailure, suhu | ≥ 80% kapasitas desain = Sehat; 60–79% = Peringatan; < 60%, kondisi "Service", atau kegagalan permanen = Kritis. Tanpa baterai = Tidak berlaku |
| SSD/HDD | Model, jenis, antarmuka, kapasitas, SMART, TRIM, ruang kosong volume sistem | SMART gagal = Kritis; ruang kosong < 10% = Peringatan. Disk eksternal tidak dinilai |
| RAM | Total, modul dan statusnya, pemakaian, swap, tekanan memori | Modul berstatus selain "ok" = Kritis; tekanan memori tinggi = Peringatan. Kerusakan sel RAM tidak bisa diuji dari OS |
| CPU | Model, core (P/E di Apple Silicon), beban, batas kecepatan, peringatan termal | Pembatasan termal = Peringatan |
| Suhu | Sensor SMC (read-only) dan suhu baterai | Ambang bergantung beban CPU yang diukur |
| Kipas | RPM aktual vs minimum/maksimum (SMC read-only) | Suhu tinggi tetapi kipas 0 RPM = Kritis. Tanpa kipas = Tidak berlaku |
| GPU | Model, jenis, VRAM, dukungan Metal, layar | GPU tanpa dukungan Metal = Peringatan |
| Activation Lock & MDM | Status Activation Lock, pendaftaran DEP, pendaftaran MDM | Aktif atau terdaftar = Peringatan. Selalu disertai keterbatasan deteksi; bukan jaminan bebas penguncian atau bukti kepemilikan |

Status: **Sehat**, **Peringatan**, **Kritis**, **Tidak diketahui**, dan **Tidak berlaku**. Setiap kartu menampilkan alasan, sumber data, dan keterbatasan. Pemeriksaan dikelompokkan menjadi *hardware inti* (baterai, SSD, RAM, CPU), *hardware pelengkap* (suhu, kipas, GPU), serta *perangkat & kepemilikan* (sistem, Activation Lock/MDM). Kelompok terakhir tidak memengaruhi kesimpulan kesehatan hardware. Bila data hardware inti tidak lengkap, kesimpulannya **"Pemeriksaan belum lengkap"**, tidak pernah "Sehat".

**Integritas data:** setiap status harus berasal dari data nyata yang dibaca dari perangkat. Aplikasi tidak boleh menampilkan nilai contoh, simulasi, atau tebakan sebagai hasil diagnosis. Data yang tidak bisa dibaca ditampilkan sebagai **Tidak diketahui** beserta alasannya.

### 6.2 Tes perangkat keras interaktif (Fase 3)

Tes yang dipandu dan melibatkan pengguna:
- layar (piksel mati/macet, keseragaman, *backlight bleed*);
- keyboard (semua tombol, termasuk deteksi ketikan ganda);
- trackpad (gerak, klik, klik sekunder, gulir, gestur);
- Touch Bar (bila ada);
- speaker kiri/kanan dan mikrofon;
- webcam;
- Wi-Fi dan Bluetooth (deteksi adaptor dan status radio, tanpa menyambung ke jaringan);
- port USB/Thunderbolt dan port lain yang bisa diverifikasi.

Setiap hasil diberi label **terukur** (bukti dari data perangkat) atau **dikonfirmasi pengguna** (pengamatan pengguna). Label ini tidak boleh dikaburkan. Rencana detail ada di [`docs/FASE3-INTERACTIVE-TESTING-PRD.md`](docs/FASE3-INTERACTIVE-TESTING-PRD.md).

### 6.3 Laporan dan UI/UX (Fase 4)

- Ringkasan kesehatan yang menggabungkan hasil otomatis dan hasil tes interaktif.
- Ekspor laporan **PDF** (untuk dibaca atau dicetak) dan **JSON** (data terstruktur). Pada mode portable, laporan bisa langsung disimpan ke flashdisk.
- Riwayat pemeriksaan di perangkat.
- Sumber data dan keterbatasan deteksi tampil di layar dan di laporan.
- Mode gelap/terang (mengikuti sistem, dengan opsi manual).
- Skor 0–100 masih dipertimbangkan **(asumsi)**. Status kategori tetap menjadi acuan utama.

### 6.4 Privasi dan nomor seri

- Nomor seri **disembunyikan secara default** dan hanya dibaca saat pengguna memilih "Tampilkan". Nomor seri hanya masuk ke laporan bila dipilih saat ekspor.
- Tes interaktif tidak menyimpan rekaman audio, video, atau gambar. Data dari mikrofon dan kamera hanya diproses di memori selama tes berjalan.
- Alamat MAC, nama jaringan Wi-Fi (SSID/BSSID), nama perangkat Bluetooth/USB, dan nomor seri aksesori tidak ditampilkan di laporan dan tidak dicatat di log.
- Tanpa akun pengguna. Tanpa telemetri. Tidak ada informasi perangkat yang dikirim ke mana pun tanpa persetujuan eksplisit pengguna.

### 6.5 Mode portable (Fase 5)

- `.app` dijalankan dari flashdisk tanpa instalasi dan tanpa hak administrator.
- Data dan laporan disimpan di folder di samping aplikasi agar tidak meninggalkan jejak di Mac yang diperiksa *(rencana)*. Bila folder itu tidak bisa ditulisi, aplikasi beralih ke folder sementara dan memberi tahu pengguna.
- Risiko yang perlu dikaji di Fase 5: Gatekeeper dan *App Translocation*. macOS dapat menjalankan aplikasi yang dikarantina dari lokasi acak yang bersifat read-only, sehingga aplikasi tidak bisa menemukan folder di sampingnya.

## 7. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| Offline | Tidak ada permintaan jaringan sama sekali. Semua aset (font, ikon, skrip, nada uji) dibundel atau dibuat lokal. CSP memblokir sumber eksternal. |
| Privasi | Lihat §6.4. Data tidak meninggalkan perangkat kecuali diekspor pengguna. |
| Integritas data | Hanya data nyata dari perangkat. Tidak ada hasil simulasi atau contoh yang ditampilkan sebagai diagnosis. Hasil yang dikonfirmasi pengguna selalu diberi label tersendiri. |
| Hak akses | Tidak butuh hak administrator. Data yang butuh admin ditandai "Tidak diketahui" beserta penjelasannya. |
| Izin macOS | Izin kamera dan mikrofon (TCC) hanya diminta saat pengguna memulai tes yang membutuhkannya. Bila izin ditolak, tes ditandai "Tidak dapat dijalankan" beserta petunjuk. Aplikasi tidak mengubah pengaturan privasi. |
| Read-only | Aplikasi tidak mengubah pengaturan hardware atau sistem: kipas, daya, kecerahan, volume, Wi-Fi/Bluetooth, maupun konfigurasi lain. Pembacaan SMC hanya memakai perintah baca. |
| Performa | Pemeriksaan otomatis selesai < 30 detik (saat ini ±1,2 detik di Mac Intel). UI tidak membeku karena pembacaan hardware dijalankan di thread terpisah. |
| Ukuran | Aplikasi sekecil mungkin. Dependency baru harus punya alasan yang jelas dan disetujui pemilik. |
| Bahasa | Antarmuka dan hasil pemeriksaan dalam **Bahasa Indonesia (default)** dan **English**, dapat diganti seketika dari header (kanan atas). Nama hardware dan kode teknis tidak diterjemahkan. Tanpa layanan penerjemah online. |
| Aksesibilitas | Kontras cukup, tema Terang/Gelap (default Gelap) yang dipilih dari header (kanan atas), navigasi keyboard. Preferensi disimpan lokal. |

## 8. Kriteria keberhasilan 1.0

- Semua pemeriksaan otomatis memberi hasil bermakna dari data nyata, baik di Mac Intel maupun Apple Silicon **asli**. Data yang memang tidak tersedia ditandai jelas sebagai "Tidak diketahui" atau "Tidak berlaku".
- Tes interaktif bisa dijalankan, dilewati, dan diulang. Hasilnya tercatat beserta labelnya (terukur atau dikonfirmasi pengguna).
- Aplikasi berjalan tanpa internet, baik dari DMG maupun dari flashdisk.
- Laporan PDF dan JSON bisa diekspor dan dibuka di perangkat lain.

## 9. Keputusan produk

| Topik | Keputusan |
|---|---|
| Target platform | **Khusus macOS**: Mac Intel dan Apple Silicon (19 Nov 2026). Windows dibatalkan; Linux tidak direncanakan. |
| Distribusi | Installer DMG dan `.app` portable di flashdisk |
| Persona prioritas | Pembeli MacBook bekas, teknisi servis, pengguna pribadi |
| Nomor seri | Disembunyikan secara default, bisa ditampilkan atas pilihan pengguna |
| Format laporan | PDF dan JSON |
| Prinsip | Offline-first, tanpa akun, tanpa telemetri atau pengiriman data tanpa persetujuan, hanya data nyata, read-only terhadap hardware |

### Pertanyaan yang masih terbuka
1. Apakah aplikasi akan ditandatangani dan dinotarisasi (Apple Developer ID, berbayar)? Tanpa itu, Gatekeeper memblokir aplikasi saat pertama dibuka dan mode portable terkena *App Translocation*.
2. Build per arsitektur atau *universal binary*? Berapa versi macOS minimum?
3. ~~Apakah perlu bahasa Inggris sejak 1.0?~~ Diputuskan: ya, id-ID (default) + en-US (19 Nov 2026).
4. Apakah perlu skor 0–100 di samping status kategori?

## 10. Riwayat perubahan scope

| Tanggal | Perubahan |
|---|---|
| 19 Nov 2026 | PRD 0.1–0.2: target macOS (Intel & Apple Silicon) dan Windows 10/11. |
| 19 Nov 2026 | Milestone 3.0 Windows (model data lintas OS, kerangka Windows, CI) masuk ke `main` lewat PR #2 (`851586b`). |
| 19 Nov 2026 | **Perubahan resmi scope: khusus macOS.** Kode Windows dikeluarkan di branch `feature/macos-only`. Perbaikan yang berguna untuk macOS dipertahankan: kategori pemeriksaan, "Pemeriksaan belum lengkap", banner pratinjau, kerangka data eksperimental, dan CI macOS. PRD Windows diarsipkan di `docs/archive/windows/`. Roadmap disusun ulang (lihat `ROADMAP.md`). |
