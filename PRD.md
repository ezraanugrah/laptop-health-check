# PRD — Laptop Health Check

| | |
|---|---|
| Versi dokumen | 0.2 (Fase 1 final) |
| Tanggal | 19 November 2026 |
| Pemilik | Ezra Alfa Anugrahni |
| Status | Disetujui untuk Fase 1. Keputusan produk ada di §9. Bagian bertanda **(asumsi)** masih perlu dikonfirmasi. |

## 1. Ringkasan

Laptop Health Check adalah aplikasi desktop **offline** untuk memeriksa kondisi perangkat keras laptop dengan cepat dan mudah dipahami. Aplikasi bisa **dipasang (installer)** atau **dijalankan langsung dari flashdisk USB (portable)**. Platform yang didukung: macOS (Intel dan Apple Silicon) serta Windows 10/11.

## 2. Masalah

- Menilai kondisi laptop (misalnya saat membeli laptop bekas, menerima unit servis, atau audit inventaris) butuh banyak alat yang berbeda untuk tiap OS. Hasilnya juga sering terlalu teknis.
- Banyak alat diagnostik butuh internet, akun, atau instalasi. Itu merepotkan saat memeriksa laptop orang lain di lokasi.
- Belum ada ringkasan sederhana bertanda "baik / perlu perhatian / bermasalah" beserta laporan yang bisa disimpan.

## 3. Pengguna sasaran

| Prioritas | Persona | Kebutuhan utama |
|---|---|---|
| 1 | Pembeli laptop bekas | Menilai kondisi baterai, penyimpanan, dan fungsi dasar dalam beberapa menit, langsung dari USB, tanpa memasang apa pun di laptop penjual |
| 1 | Teknisi servis | Pemeriksaan sebelum dan sesudah servis, lalu menyimpan laporan PDF/JSON untuk pelanggan |
| 1 | Pengguna pribadi | Mengetahui apakah baterai, SSD, atau kipas laptopnya perlu perhatian |
| 2 | Staf IT / pengelola inventaris | Pemeriksaan berkala banyak unit (sekunder) |

## 4. Tujuan dan non-tujuan

**Tujuan**
1. Pemeriksaan otomatis inti (sistem, baterai, SSD/HDD, CPU, RAM, temperatur, kipas, GPU) dengan status yang jelas dan berbasis data nyata.
2. Berjalan 100% offline, tanpa akun, tanpa telemetri.
3. Satu aplikasi untuk macOS Intel, macOS Apple Silicon, dan Windows 10/11.
4. Dua mode distribusi: installer dan portable USB.
5. Laporan hasil yang bisa disimpan atau diekspor.

**Non-tujuan (saat ini)**
- Dukungan Linux (ditunda).
- Perbaikan otomatis, *overclocking*, pembaruan driver/firmware.
- Benchmark performa mendalam.
- Fitur berbasis cloud, sinkronisasi, atau akun.

## 5. Platform dan distribusi

| Platform | Status | Mode installer | Mode portable |
|---|---|---|---|
| macOS Intel (x86_64) | Target utama (mesin pengembangan) | `.dmg` | `.app` dijalankan dari USB |
| macOS Apple Silicon (arm64) | Target | `.dmg` (universal binary) | `.app` dijalankan dari USB |
| Windows 10/11 (x64) | Target | Installer NSIS `.exe` (termasuk WebView2 offline) | `.exe` tunggal dari USB. Butuh WebView2 Runtime; aplikasi mendeteksinya dan memberi instruksi bila belum ada. |
| Linux | Ditunda | — | — |

## 6. Fitur

### 6.1 Diagnostik otomatis (MVP)

| Pemeriksaan | Data yang dibaca | Kriteria awal (disetel di Fase 2) |
|---|---|---|
| Sistem ✅ *(Fase 1)* | OS dan versinya, model, prosesor, jumlah core, total RAM, arsitektur | Lengkap terbaca = Baik |
| Baterai | Jumlah siklus, kapasitas desain vs. kapasitas penuh saat ini, kondisi dari OS, status pengisian | ≥ 80% kapasitas desain = Baik; 60–79% = Perlu perhatian; < 60% atau kondisi "Service" = Bermasalah. Laptop tanpa baterai = Tidak berlaku |
| SSD/HDD | Model, jenis, kapasitas, ruang kosong, status SMART, sisa umur SSD (jika tersedia tanpa admin) | SMART gagal = Bermasalah; ruang kosong < 10% = Perlu perhatian |
| CPU | Model, core, beban, *throttling*/status termal | *Throttling* saat beban ringan = Perlu perhatian |
| RAM | Total, modul (bila dilaporkan OS), pemakaian, tekanan memori, swap | Tekanan tinggi terus-menerus = Perlu perhatian. Catatan: kerusakan fisik RAM hanya bisa diuji dengan alat *memtest* saat boot, di luar cakupan aplikasi. |
| Temperatur | Sensor CPU/GPU/baterai yang bisa dibaca tanpa admin | Suhu idle tinggi = Perlu perhatian |
| Kipas | Jumlah kipas, RPM aktual vs. minimum/maksimum | Suhu tinggi tetapi kipas 0 RPM = Bermasalah. Laptop tanpa kipas = Tidak berlaku |
| GPU | Model, jenis (terintegrasi/diskret), VRAM, dukungan Metal/DirectX, layar terhubung | GPU tidak terdeteksi driver = Bermasalah |

Status yang dipakai: **Baik**, **Perlu perhatian**, **Bermasalah**, **Tidak diketahui**, **Tidak berlaku**, dan **Segera hadir** (belum diimplementasikan).

**Integritas data:** setiap status harus berasal dari data nyata yang dibaca dari perangkat. Aplikasi tidak boleh menampilkan nilai contoh, simulasi, atau tebakan sebagai hasil diagnosis. Data yang tidak bisa dibaca ditampilkan sebagai **Tidak diketahui** beserta alasannya.

### 6.2 Tes interaktif (pasca-MVP)
Keyboard (semua tombol), layar (piksel mati, *backlight bleed*), speaker kiri/kanan, mikrofon, kamera, touchpad/klik, port USB, dan Wi-Fi/Bluetooth (hanya deteksi adaptor, tanpa koneksi internet).

### 6.3 Skor dan laporan
- Status keseluruhan, nanti ditambah skor kesehatan 0–100.
- Riwayat pemeriksaan di perangkat.
- Ekspor laporan ke **PDF** (untuk dibaca atau dicetak) dan **JSON** (data terstruktur), termasuk langsung ke flashdisk USB pada mode portable.

### 6.4 Mode portable
- Berjalan dari USB tanpa instalasi dan tanpa hak administrator.
- Data dan laporan disimpan di folder di samping aplikasi, sehingga tidak meninggalkan jejak di laptop yang diperiksa *(rencana)*.
- Windows: bila WebView2 Runtime belum terpasang, aplikasi menampilkan pesan native berisi instruksi pemasangan, alih-alih gagal tanpa keterangan.

### 6.5 Privasi dan nomor seri
- Nomor seri perangkat **disembunyikan secara default**. Pengguna dapat memilih untuk menampilkannya.
- Nomor seri hanya masuk ke laporan PDF/JSON bila pengguna memilihnya saat ekspor.
- Tanpa akun pengguna. Tanpa telemetri. Tidak ada informasi perangkat yang dikirim ke mana pun tanpa persetujuan eksplisit pengguna.

## 7. Kebutuhan non-fungsional

| Area | Kebutuhan |
|---|---|
| Offline | Tidak ada permintaan jaringan sama sekali. Semua aset (font, ikon, skrip) dibundel. CSP memblokir sumber eksternal. |
| Privasi | Tanpa akun dan tanpa telemetri. Informasi perangkat tidak dikirim tanpa persetujuan eksplisit; data tidak meninggalkan perangkat kecuali diekspor pengguna. Nomor seri disembunyikan secara default. |
| Integritas data | Hanya data nyata dari perangkat. Tidak ada hasil simulasi atau contoh yang ditampilkan sebagai diagnosis. |
| Hak akses | Tidak butuh hak administrator untuk pemeriksaan inti. Data yang butuh admin ditandai "Tidak diketahui" beserta penjelasannya. |
| Performa | Pemeriksaan otomatis selesai < 30 detik *(asumsi)*. UI tidak membeku (pembacaan hardware dijalankan di thread terpisah). |
| Ukuran | Aplikasi sekecil mungkin. Dependency baru harus punya alasan yang jelas. |
| Bahasa | Antarmuka bahasa Indonesia. Bahasa Inggris dipertimbangkan nanti *(asumsi)*. |
| Aksesibilitas | Kontras cukup, mode terang/gelap mengikuti sistem, navigasi keyboard. |

## 8. Kriteria keberhasilan MVP

- Semua pemeriksaan otomatis inti memberi hasil bermakna dari data nyata di macOS Intel, macOS Apple Silicon, dan Windows 10/11. Data yang memang tidak tersedia di suatu perangkat ditandai jelas sebagai "Tidak diketahui" atau "Tidak berlaku".
- Aplikasi berjalan tanpa internet, dari installer maupun dari USB.
- Laporan PDF dan JSON bisa diekspor dan dibuka di perangkat lain.

## 9. Keputusan produk (19 November 2026)

| Topik | Keputusan |
|---|---|
| Persona prioritas | Pembeli laptop bekas, teknisi, pengguna pribadi |
| Nomor seri | Disembunyikan secara default, bisa ditampilkan atas pilihan pengguna |
| Format laporan | PDF dan JSON |
| Portable Windows | Deteksi WebView2 Runtime; beri instruksi bila belum tersedia (tanpa membundel *fixed runtime*) |
| Prinsip | Offline-first, tanpa akun, tanpa telemetri/pengiriman data tanpa persetujuan |
| Target OS | macOS Intel, macOS Apple Silicon, Windows 10/11 (Linux ditunda) |

### Pertanyaan yang masih terbuka
1. Apakah perlu bahasa Inggris sejak MVP?
2. Apakah aplikasi akan ditandatangani (Apple Developer ID / sertifikat Windows)? Tanpa tanda tangan, OS akan menampilkan peringatan keamanan.
