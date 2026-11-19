# PRD Teknis & Rencana Implementasi — Fase 3: Windows Diagnostics

> **DIARSIPKAN — scope Windows dibatalkan pada 19 November 2026.**
> Laptop Health Check kini dikembangkan **khusus macOS** (lihat [`PRD.md`](../../../PRD.md) dan [`ROADMAP.md`](../../../ROADMAP.md)).
> Dokumen ini disimpan hanya sebagai riwayat dan bahan referensi. Isinya **bukan rencana aktif**, dan
> tidak boleh dipakai untuk menambah fitur Windows.
>
> Riwayat singkat:
> - Milestone 3.0 (model data lintas OS + kerangka Windows + CI) masuk ke `main` lewat PR #2 (`851586b`, 19 Nov 2026). Job CI `windows` gagal di PR tersebut karena clippy `dead_code`; job macOS lolos.
> - Branch `feature/macos-only` mengeluarkan kode Windows (`platform/windows/`, field/enum khusus Windows, target NSIS, job CI `windows`). Perbaikan Milestone 3.0 yang berguna untuk macOS dipertahankan: kategori pemeriksaan, `HardwareSummary` ("Pemeriksaan belum lengkap"), `PlatformSupport` + banner pratinjau, field `Metric.experimental`, `Platform::notes`, dan CI macOS.
> - Modul Windows 3.1–3.9 tidak pernah diimplementasikan. Kode Milestone 3.0 tetap bisa dilihat di riwayat Git (`538ddd3`).

| | |
|---|---|
| Status | **Diarsipkan** (sebelumnya: disetujui D1–D8, §11; Milestone 3.0 di-merge lewat PR #2; modul 3.1–3.9 tidak dikerjakan) |
| Tanggal | 19 November 2026 |
| Basis kode | `main` @ `21a5f43` (Fase 2 macOS) |
| Branch rencana | `feature/windows-diagnostics` (dibuat dari `main` setelah disetujui) |
| Target | Windows 10 & 11, **x64**, akun pengguna standar (tanpa admin), offline |

## 1. Tujuan

1. Mengimplementasikan trait `Platform` untuk Windows dengan **data asli** dari API native, sehingga pemeriksaan yang sama dengan macOS berjalan di Windows 10/11 x64.
2. Mempertahankan kontrak diagnostik lintas platform. Lapisan `diagnostics/` (penilaian) dan frontend tetap sama; perubahan kontrak hanya bersifat **aditif** (field `Option` baru).
3. Membangun dan menguji di **GitHub Actions** karena mesin pengembangan adalah MacBook Intel. Hasil CI dibedakan secara tegas dari **validasi di hardware Windows asli**.

### Ruang lingkup

| Modul yang diminta | `CheckId` | Catatan |
|---|---|---|
| System Information | `system` | |
| Battery Health | `battery` | |
| SSD/HDD | `storage` | |
| CPU | `cpu` | Info + status pembatasan (*throttling*) |
| RAM | `memory` | Info + tekanan memori + bukti error hardware dari log Windows |
| GPU | `gpu` | |
| Temperature & Fan | `temperature`, `fans` | Hanya bila tersedia tanpa driver kernel |
| Activation/Device Management | `ownership` | Aktivasi Windows, MDM, Entra ID/domain, Autopilot |
| Serial Number (opt-in) | command `get_serial_number` | Tetap tersembunyi secara default |

### Di luar ruang lingkup Fase 3

- Windows ARM64, Windows 7/8.1, Windows Server sebagai target produk, Linux.
- Data yang **hanya** tersedia dengan hak administrator (ditampilkan "Tidak diketahui" + alasan).
- Driver kernel apa pun (mis. WinRing0/PawnIO untuk suhu CPU atau kipas EC).
- SDK vendor (NVAPI, AMD ADL, Dell/HP/Lenovo WMI).
- Fitur keamanan (TPM, Secure Boot, BitLocker, antivirus) → diusulkan untuk fase berikutnya.
- Deteksi WebView2 saat start dan mode portable penuh (Fase 6). Exe portable tetap dibangun untuk pengujian.
- *Code signing* (tanpa tanda tangan, SmartScreen akan memperingatkan).

## 2. Prinsip yang tidak bisa ditawar

1. **Hanya data nyata.** Tidak ada nilai pengganti atau simulasi di jalur produksi. Data yang tidak bisa dibaca menjadi `None`/`ProbeError` → **Tidak diketahui** beserta alasannya. Data tidak tersedia tidak pernah dianggap sehat.
2. **Tanpa admin.** Manifest `asInvoker` (bawaan) dan tanpa prompt UAC.
3. **Tanpa driver kernel, tanpa PowerShell/cmd.** Hanya API native (Win32, WMI/COM, DXGI, PDH, SetupAPI/IOCTL). Ini mengurangi risiko keamanan, kesalahan lokalisasi, dan deteksi palsu antivirus.
4. **Read-only** terhadap hardware dan konfigurasi sistem.
5. **Privasi.** Nomor seri hanya dibaca atas permintaan. UPN/email, nama tenant/domain, nama komputer, nama pengguna, dan alamat MAC tidak pernah ditampilkan, dicatat di log, maupun diekspor.
6. **Tahan gangguan.** Setiap probe punya batas waktu. Panic atau error COM tidak boleh menjatuhkan aplikasi, sehingga probe bermasalah menjadi `ProbeError`.
7. **Lokalisasi aman.** Perhitungan memakai nilai numerik dan nama counter PDH berbahasa Inggris (`PdhAddEnglishCounterW`), bukan teks yang diterjemahkan Windows.

## 3. Kompatibilitas dengan arsitektur macOS

### 3.1 Yang tetap

- Trait `Platform` (8 probe + `serial_number` + `sources`) tidak berubah signaturnya. Windows wajib mengimplementasikan semuanya, dan compiler memaksanya.
- Seluruh lapisan `diagnostics/` (Findings, ambang, status, `run_all` paralel) dipakai bersama.
- IPC tetap tiga command: `get_app_info`, `run_diagnostics`, `get_serial_number`.

### 3.2 Perubahan kontrak (aditif, macOS mengisi `None`)

| Tipe | Field baru (usulan) | Diisi oleh |
|---|---|---|
| `SystemOverview` | `manufacturer`, `os_edition`, `os_display_version` (mis. "24H2"), `firmware_type` (UEFI/BIOS), `firmware_version` | Windows (sebagian juga macOS) |
| `BatteryInfo` | `battery_count`, `chemistry`, `capacity_is_relative` | Windows |
| `DiskInfo` | `os_health` (HealthStatus OS), `predicted_failure`, `media_type`, `bus_type`, `wear_percent`, `power_on_hours`, `temperature_c` | Windows (wear/hours/temp hanya bila tersedia tanpa admin) |
| `ThermalStatus` | `passive_limit_percent`, `performance_limit_percent`, `max_mhz`, `limit_mhz` | Windows |
| `MemoryInfo` | `memory_load_percent`, `commit_used_bytes`, `commit_limit_bytes`, `hardware_error_events_30d`, `memory_diagnostic_last` | Windows |
| `GpuInfo` | `driver_version`, `driver_date`, `device_problem_code`, `dedicated_vram_bytes`, `temperature_c`; **rename** `metal_support` → `graphics_api` (keputusan D8) | Windows + macOS |
| `SensorKind` | `ThermalZone` (zona ACPI, **bukan** suhu die CPU) | Windows |
| `OwnershipInfo` | rename `dep_enrolled` → `provisioning_enrolled` (DEP/Autopilot); tambah `directory_join` (Tidak ada/Entra ID/Workplace/Domain), `os_activated` | Windows + macOS |
| `DiagnosticsReport` | `coverage { measured, total }` (keputusan D1) | Keduanya |

Setiap perubahan dicerminkan di `src/types/diagnostics.ts`, dengan test JSON lintas bahasa tetap dijaga.

### 3.3 Struktur modul

```
src-tauri/src/platform/
├─ windows/                 #[cfg(windows)] — memanggil API native
│  ├─ mod.rs                impl Platform for Windows + sources()
│  ├─ com.rs                inisialisasi COM (MTA per thread probe), helper WMI dengan batas waktu
│  ├─ system.rs           ├─ battery.rs     ├─ storage.rs   ├─ memory.rs
│  ├─ cpu.rs              ├─ gpu.rs         ├─ sensors.rs   └─ ownership.rs
└─ windows_parse/           SEMUA platform — parser & dekoder murni (SMBIOS, baris WMI,
                            struktur IOCTL, nilai PDH) + test fixture → bisa dites di Mac & CI
src-tauri/fixtures/windows/<perangkat>/   hasil ekspor tersanitasi dari laptop asli
```

Pemisahan `windows_parse` memungkinkan sebagian besar logika Windows diuji di MacBook ini tanpa Windows.

## 4. Spesifikasi per modul

Semua API di bawah sudah dicek tersedia di crate `windows` **0.62.2**, versi yang sudah dipakai Tauri.

### 4.1 System Information
| Data | API | Admin? |
|---|---|---|
| Nama/edisi/versi OS | Registry `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion` (`ProductName`, `EditionID`, `DisplayVersion`, `CurrentBuildNumber`, `UBR`) | Tidak |
| Pabrikan, model, jenis PC, RAM | WMI `Win32_ComputerSystem` (`Manufacturer`, `Model`, `PCSystemType`, `TotalPhysicalMemory`) | Tidak |
| Prosesor | Registry `HARDWARE\DESCRIPTION\System\CentralProcessor\0\ProcessorNameString` | Tidak |
| Firmware | `GetFirmwareType` + WMI `Win32_BIOS` (`SMBIOSBIOSVersion`, `ReleaseDate`). `SerialNumber` **tidak dibaca** di sini. | Tidak |

Aturan akurasi:
- **Windows 11 ditentukan dari build ≥ 22000.** Registry `ProductName` di Windows 11 sering masih bertuliskan "Windows 10".
- **Aturan status:** Sehat bila OS, CPU, dan RAM terbaca. Usulan D3: **Peringatan** untuk Windows 10 non-LTSC, karena dukungan resmi berakhir 14 Oktober 2025 dan ESU konsumen 13 Oktober 2026.

### 4.2 Battery Health
| Data | API | Admin? |
|---|---|---|
| Ada/tidaknya baterai, AC | `GetSystemPowerStatus` (`BatteryFlag` 128 = tanpa baterai) | Tidak |
| Kapasitas desain & penuh, siklus, kimia | SetupAPI (`GUID_DEVCLASS_BATTERY`) → `IOCTL_BATTERY_QUERY_TAG` → `IOCTL_BATTERY_QUERY_INFORMATION` (`BATTERY_INFORMATION`) | Tidak |
| Status, tegangan, laju | `IOCTL_BATTERY_QUERY_STATUS` | Tidak |
| Suhu baterai | `IOCTL_BATTERY_QUERY_INFORMATION` (`BatteryTemperature`), sering tidak didukung | Tidak |

Aturan:
- Ambang kapasitas sama dengan macOS: ≥80% Sehat, 60–79% Peringatan, <60% Kritis.
- `CycleCount = 0` berarti **"tidak dilaporkan"**, bukan 0 siklus.
- Windows tidak menyediakan batas siklus desain, sehingga aturan rasio siklus tidak dipakai. Jumlah siklus tetap ditampilkan.
- Bila `Capabilities` bertanda *capacity relative*, persen tidak bisa dihitung → **Tidak diketahui** + alasan.
- Lebih dari satu baterai dinilai per baterai, dan statusnya diambil yang terburuk.
- Tidak ada baterai → **Tidak berlaku**.

### 4.3 SSD/HDD
| Data | API | Admin? |
|---|---|---|
| Model, jenis media, bus, status kesehatan OS | WMI `ROOT\Microsoft\Windows\Storage:MSFT_PhysicalDisk` (`FriendlyName`, `MediaType`, `BusType`, `HealthStatus`, `OperationalStatus`, `Size`) | Tidak (perlu diverifikasi di hardware) |
| Prediksi kegagalan SMART | WMI `Win32_DiskDrive.Status` (`OK` / `Pred Fail`) | Tidak |
| Ruang kosong volume sistem | `GetDiskFreeSpaceExW(%SystemDrive%)` + pemetaan `MSFT_Partition` → nomor disk | Tidak |
| Keausan, jam pakai, suhu, data tertulis | **Spike:** `IOCTL_STORAGE_QUERY_PROPERTY` (`StorageDeviceProtocolSpecificProperty`, NVMe Health Log 02h) dengan handle tanpa hak akses. Fallback: `MSFT_StorageReliabilityCounter` (**butuh admin** → Tidak diketahui) | Belum pasti |

Aturan:
- **Kritis:** `HealthStatus` = Unhealthy, `Pred Fail`, atau bit *critical warning* NVMe aktif.
- **Peringatan:** `HealthStatus` = Warning, keausan NVMe ≥ 90%, atau ruang kosong < 10%.
- **Sehat:** `HealthStatus` = Healthy (atau `OK` bila MSFT tidak tersedia).
- Disk USB/eksternal tidak dinilai, sama seperti di macOS.
- Nomor seri disk **tidak dibaca**.

### 4.4 RAM
| Data | API | Admin? |
|---|---|---|
| Total, beban memori | `GlobalMemoryStatusEx` | Tidak |
| Commit charge | `GetPerformanceInfo` | Tidak |
| Modul (kapasitas, kecepatan, tipe, form factor, slot) | WMI `Win32_PhysicalMemory`. `SerialNumber` **tidak dibaca**. | Tidak |
| Error hardware terkoreksi (30 hari) | **Spike:** `EvtQuery` channel `System`, provider `Microsoft-Windows-WHEA-Logger` | Kemungkinan tidak |
| Hasil Windows Memory Diagnostic terakhir | **Spike:** `EvtQuery`, `Microsoft-Windows-MemoryDiagnostics-Results` (1201 = tanpa error, 1202 = error) | Kemungkinan tidak |

Aturan:
- **Kritis:** hasil Memory Diagnostic 1202, atau beban/commit ≥ 98%.
- **Peringatan:** ada error memori WHEA dalam 30 hari, atau beban/commit ≥ 90%.
- **Sehat:** beban terbaca normal tanpa bukti error.
- Catatan tetap ditampilkan: kerusakan sel RAM tidak bisa diuji dari OS; sarankan `mdsched.exe`.

### 4.5 CPU
| Data | API | Admin? |
|---|---|---|
| Core fisik/logis, P/E (hybrid) | `GetLogicalProcessorInformationEx(RelationProcessorCore)` (`EfficiencyClass`) | Tidak |
| Nama, frekuensi dasar | Registry `ProcessorNameString`, `~MHz` | Tidak |
| Beban | `GetSystemTimes`, dua sampel berjarak 1 detik (setara `host_statistics` macOS) | Tidak |
| Batas frekuensi | `CallNtPowerInformation(ProcessorInformation)` → `MaxMhz`, `CurrentMhz`, `MhzLimit` | Tidak |
| Pembatasan termal/daya | PDH (nama Inggris): `\Thermal Zone Information(*)\% Passive Limit`, `\Processor Information(_Total)\% Performance Limit` | Tidak |

Aturan (perlu kalibrasi di hardware asli):
- **Kritis:** *Passive Limit* < 50%.
- **Peringatan:** *Passive Limit* < 100%, atau `MhzLimit` < `MaxMhz` saat terhubung AC dan beban ringan.
- Pembatasan saat memakai baterai atau mode hemat daya dicatat sebagai **info**, bukan peringatan, karena penyebabnya pengaturan daya, bukan masalah termal.
- **Sehat:** tidak ada pembatasan yang terbaca.

### 4.6 GPU
| Data | API | Admin? |
|---|---|---|
| Adapter, vendor, VRAM khusus/bersama | DXGI `CreateDXGIFactory1` → `EnumAdapters1` → `DXGI_ADAPTER_DESC1` (adapter software dilewati) | Tidak |
| Driver, tanggal, kode masalah perangkat | WMI `Win32_VideoController` (`DriverVersion`, `DriverDate`, `ConfigManagerErrorCode`, `Status`) | Tidak |
| Dukungan grafis | `D3D11CreateDevice` → *feature level* tertinggi | Tidak |
| Suhu GPU | **Spike:** `D3DKMTQueryAdapterInfo(KMTQAITYPE_ADAPTERPERFDATA)` (WDDM 2.4+, sumber yang sama dengan Task Manager) | Tidak |

Aturan:
- **Kritis:** `ConfigManagerErrorCode` 43 atau 10, yaitu perangkat dihentikan karena melaporkan masalah.
- **Peringatan:** kode 28 (tanpa driver), hanya ada "Microsoft Basic Display Adapter", atau gagal membuat perangkat D3D.
- **Sehat:** adapter hardware dengan kode 0 dan D3D berhasil dibuat.
- VRAM diambil dari DXGI. `AdapterRAM` di WMI terbatas 4 GB, jadi tidak akurat.

### 4.7 Temperature & Fan
| Data | API | Admin? |
|---|---|---|
| Zona termal ACPI | PDH `\Thermal Zone Information(*)\Temperature` (Kelvin) → `SensorKind::ThermalZone` | Tidak |
| Suhu GPU | D3DKMT (spike, §4.6) | Tidak |
| Suhu baterai | IOCTL baterai (bila didukung) | Tidak |
| Suhu die CPU | **Tidak didukung**: butuh driver kernel (MSR) | — |
| Kipas | WMI `Win32_Fan` (jarang diisi OEM). Tidak ada API standar lain tanpa driver. | Tidak |

Aturan:
- Zona ACPI diberi label **"zona termal sistem"**, bukan "CPU".
- Zona ≥ 95 °C → **Peringatan**. ≥ 105 °C, atau disertai *Passive Limit* aktif → **Kritis**.
- Tidak ada sensor yang terbaca → **Tidak diketahui**.
- Kipas tanpa data → **Tidak diketahui**, dengan alasan "Windows tidak menyediakan API kipas standar; aplikasi tidak memakai driver kernel demi keamanan". **Bukan** "Tidak berlaku", karena kipasnya mungkin ada.

### 4.8 Activation/Device Management (`ownership`)
| Data | API | Admin? |
|---|---|---|
| Aktivasi/keaslian Windows | `SLIsGenuineLocal` (SLID Windows). Fallback: WMI `SoftwareLicensingProduct.LicenseStatus` (lambat). | Tidak |
| Terdaftar MDM (mis. Intune) | `IsDeviceRegisteredWithManagement`. UPN yang dikembalikan **dibuang**. | Tidak |
| Entra ID / Workplace join | `NetGetAadJoinInformation`. Nama tenant **tidak ditampilkan**. | Tidak |
| Domain | `NetGetJoinInformation`. Hanya statusnya; nama domain **tidak ditampilkan**. | Tidak |
| Windows Autopilot (setara DEP) | Registry `HKLM\SOFTWARE\Microsoft\Provisioning\Diagnostics\Autopilot` (kunci berisi data tenant) | Perlu diverifikasi |

Aturan:
- **Peringatan:** Windows tidak aktif/tidak asli; atau perangkat terdaftar MDM, Entra ID, domain, atau Autopilot.
- **Sehat:** semuanya terbaca bersih, disertai keterbatasan.
- **Keterbatasan (selalu tampil):**
  - Pendaftaran Autopilot bisa baru muncul setelah reset/instal ulang.
  - Kunci pemulihan BitLocker atau Device Encryption bisa terikat ke akun Microsoft pemilik lama.
  - Status aktivasi lokal bisa berbeda dengan status di server Microsoft.
  - Hasil ini bukan jaminan bebas penguncian dan bukan bukti kepemilikan.

### 4.9 Serial Number (opt-in)
- Sumber utama: `GetSystemFirmwareTable('RSMB')` → parser SMBIOS Type 1 (murni, dites). Fallback: WMI `Win32_BIOS.SerialNumber`.
- Nilai *placeholder* OEM ("To be filled by O.E.M.", "Default string", "System Serial Number", "Not Specified", "0", hanya spasi/nol) dianggap **tidak diisi pabrikan** (`None`).
- Tetap hanya dibaca saat tombol "Tampilkan" ditekan. Tidak disimpan, tidak dicatat di log, dan tidak ikut diekspor.

## 5. Pengambilan data uji dari hardware asli

- **Mode ekspor CLI** pada exe yang sama: `laptop-health-check.exe --export-diagnostics <file.json>`.
  - Menjalankan semua probe, lalu menulis data mentah dan laporan ke JSON, lalu keluar tanpa membuka jendela.
  - Nomor seri, nama komputer, nama pengguna, UPN, tenant, dan domain disanitasi otomatis.
  - Bisa dijalankan penguji di laptop mana pun memakai exe portable hasil CI, tanpa alat pengembang.
- Hasil ekspor ditinjau manual (cek kebocoran identitas seperti di Fase 2), lalu disimpan sebagai fixture `src-tauri/fixtures/windows/<perangkat>/`.
- Mode ekspor juga berguna di macOS untuk fixture Apple Silicon.

## 6. Build & CI (GitHub Actions)

### 6.1 Workflow

**`ci.yml`** — dipicu oleh push ke `feature/**`, pull request ke `main`, dan `workflow_dispatch`.
- `permissions: contents: read`, `concurrency` membatalkan run lama, dan action dipin ke SHA.
- Matriks job:

| Job (nama status check) | Runner | Langkah |
|---|---|---|
| `windows` | `windows-latest` (**Windows Server 2025**) | `npm ci`, typecheck, `npm test`, `npm run build`, `cargo fmt --check`, `cargo clippy --all-targets -D warnings`, `cargo test`, `cargo test -- --ignored dump_real_report` → artefak `ci-windows-vm-report.json` |
| `macos-intel` | `macos-15-intel` (x86_64; tersedia sampai ±2027) | Sama; regresi macOS Intel di VM |
| `macos-arm64` | `macos-latest` (arm64) | Sama; **verifikasi kompilasi & format Apple Silicon di VM** (bukan hardware) |

**`build-windows.yml`** — hanya `workflow_dispatch` (manual):
- Menjalankan `npm run tauri build` di `windows-latest`.
- Artefak: installer NSIS (dengan WebView2 *offline installer*), `laptop-health-check.exe` portable, dan `SHA256SUMS.txt`.
- Retensi 14 hari.
- **Tidak membuat tag maupun release.**

Catatan:
- Repo publik, sehingga runner standar gratis. Log dan artefak juga publik, jadi hanya data VM runner yang boleh diunggah, tidak pernah fixture dari perangkat pribadi.
- Rust dan MSVC sudah tersedia di image Windows. Cache memakai `Swatinem/rust-cache` dan cache npm.
- Disk MacBook tidak terpakai. Target Windows **tidak** dipasang di Mac (opsional `cargo check --target x86_64-pc-windows-msvc`, +±250 MB, tidak disarankan).

### 6.2 Tingkat verifikasi — CI ≠ hardware asli

| Tingkat | Bukti | Tempat | Arti |
|---|---|---|---|
| **L0 Kompilasi** | build + clippy Windows hijau | CI `windows-latest` | Kode bisa dikompilasi. **Bukan** bukti datanya benar. |
| **L1 Logika** | test parser & ambang hijau | CI (3 OS) + Mac lokal | Aturan benar terhadap fixture |
| **L2 Smoke VM** | `dump_real_report` jalan tanpa crash | CI `windows-latest` | API dipanggil tanpa crash di **VM Windows Server** tanpa baterai/sensor. Bukan validasi hardware. |
| **L3 Hardware Win 11** | ekspor JSON + screenshot + checklist pembanding | Laptop Windows 11 asli, akun standar | Validasi data asli |
| **L4 Hardware Win 10** | idem | Laptop Windows 10 22H2 asli | Validasi data asli |
| **L5 Portable/offline** | exe portable dari USB, mode pesawat, akun standar | Laptop asli | Validasi distribusi |

Dokumentasi dan laporan hanya menyebut sebuah modul **"terverifikasi"** setelah L3/L4. Tingkat verifikasi per modul dicatat di TASKS.md.

## 7. Rencana implementasi (milestone)

| # | Milestone | Isi | Tingkat target |
|---|---|---|---|
| 3.0 | Kontrak & fondasi | Branch `feature/windows-diagnostics` dari `main` (izin). Perubahan kontrak §3.2 + migrasi macOS + TS. Kerangka `windows/` dan `windows_parse/`. Helper COM/WMI ber-timeout. Workflow `ci.yml` (izin push). **Checkpoint: laporan dan CI hijau di 3 OS dengan stub.** | L0–L1 |
| 3.1 | System Information + Serial opt-in | Registry/WMI/firmware, parser SMBIOS, filter *placeholder* | L1–L2 |
| 3.2 | Battery | SetupAPI + IOCTL, multi-baterai, siklus 0, kapasitas relatif | L1–L2 |
| 3.3 | SSD/HDD | MSFT_PhysicalDisk, Win32_DiskDrive, ruang kosong, eksklusi USB, spike NVMe | L1–L2 |
| 3.4 | RAM | Memory status, modul, spike event log WHEA/MemDiag | L1–L2 |
| 3.5 | CPU | Topologi P/E, beban, MhzLimit, PDH (nama Inggris) | L1–L2 |
| 3.6 | GPU | DXGI, kode masalah perangkat, D3D11 feature level, spike D3DKMT | L1–L2 |
| 3.7 | Temperature & Fan | Zona termal PDH, Win32_Fan, alasan "Tidak diketahui" | L1–L2 |
| 3.8 | Activation/Device Management | SLIsGenuineLocal, MDM, Entra/domain, Autopilot, keterbatasan | L1–L2 |
| 3.9 | Ekspor, build, validasi | `--export-diagnostics`, `build-windows.yml` (manual), **validasi L3–L5 di laptop asli**, kalibrasi ambang, dokumentasi, laporan Fase 3 | L3–L5 |

Setiap milestone diakhiri dengan test lokal (Mac) dan CI. Commit dan push hanya dengan izin, sesuai `docs/GIT-WORKFLOW.md`.

## 8. Dependency

| Jenis | Item | Alasan |
|---|---|---|
| Rust (khusus Windows) | `windows = "0.62"` di `[target.'cfg(windows)'.dependencies]`. Fitur: `Win32_Foundation`, `Win32_System_Com`, `Win32_System_Wmi`, `Win32_System_Variant`, `Win32_System_Power`, `Win32_Devices_DeviceAndDriverInstallation`, `Win32_Storage_FileSystem`, `Win32_System_IO`, `Win32_System_Ioctl`, `Win32_System_SystemInformation`, `Win32_System_Threading`, `Win32_System_ProcessStatus`, `Win32_System_Performance`, `Win32_Graphics_Dxgi`, `Win32_Graphics_Dxgi_Common`, `Win32_Graphics_Direct3D`, `Win32_Graphics_Direct3D11`, `Wdk_Graphics_Direct3D` (spike), `Win32_System_Registry`, `Win32_System_EventLog`, `Win32_Management_MobileDeviceManagementRegistration`, `Win32_NetworkManagement_NetManagement`, `Win32_Security_Authentication_Identity` | Versi yang **sama** dengan yang sudah ada di `Cargo.lock` (dipakai Tauri), jadi tidak ada crate baru yang diunduh. Tidak berpengaruh ke build macOS. Semua fungsi sudah dicek ada. |
| Rust (ditolak) | `wmi`, `sysinfo`, `nvml-wrapper`, driver kernel | Menambah dependency/versi ganda atau berisiko keamanan; helper WMI tipis ditulis sendiri |
| npm | Tidak ada | — |
| CI | `actions/checkout`, `actions/setup-node`, `dtolnay/rust-toolchain`, `Swatinem/rust-cache`, `actions/upload-artifact` (dipin SHA) | Standar dan tanpa secret |
| Perangkat | ≥1 laptop **Windows 11** + ≥1 laptop **Windows 10 22H2** (pinjaman) dengan akun standar | Validasi L3–L5 |

## 9. Risiko

| # | Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|---|
| R1 | Tidak ada Windows di mesin dev; validasi bergantung CI VM dan laptop pinjaman | Tinggi | Pasti | Parser murni dites di Mac; mode ekspor JSON; L3/L4 wajib sebelum klaim "terverifikasi" |
| R2 | CI memakai **Windows Server 2025 VM**: tanpa baterai/sensor, sebagian API klien tidak ada | Sedang | Pasti | Test integrasi toleran (cukup tidak crash); data VM dilabeli; perilaku klien dibuktikan di L3/L4 |
| R3 | WMI lambat/hang/rusak di sebagian PC | Sedang | Sedang | Timeout per query (`IEnumWbemClassObject::Next`), API native diutamakan, probe paralel |
| R4 | Konflik COM dengan WebView2 (STA di thread utama) | Sedang | Sedang | COM hanya di thread probe (MTA); tangani `RPC_E_CHANGED_MODE`/`RPC_E_TOO_LATE` |
| R5 | Data penting butuh admin (reliability counter, TPM/BitLocker WMI) | Sedang | Pasti | Alternatif non-admin (§4); bila tidak ada → Tidak diketahui + alasan |
| R6 | Suhu Windows tidak akurat: zona ACPI bukan die CPU, sebagian OEM statis | Sedang | Tinggi | Label "zona termal sistem", ambang konservatif, tanpa driver kernel |
| R7 | Kipas hampir selalu tanpa data | Rendah | Tinggi | Tidak diketahui + alasan jelas; keputusan D1 agar status keseluruhan tidak selalu "Tidak diketahui" |
| R8 | Variasi vendor (CycleCount 0, kapasitas relatif, serial *placeholder*, AdapterRAM 4 GB) | Sedang | Tinggi | Penanganan eksplisit + test per kasus |
| R9 | Lokalisasi (counter PDH, teks WMI) | Sedang | Sedang | `PdhAddEnglishCounterW`; hanya nilai numerik/kode yang dipakai |
| R10 | `unsafe` FFI (buffer IOCTL, VARIANT COM, tabel SMBIOS) | Tinggi | Sedang | Wrapper RAII, cek ukuran/panjang, parser murni dengan test batas & input rusak |
| R11 | Ambang CPU/termal Windows belum terkalibrasi | Sedang | Tinggi | Mulai konservatif; kalibrasi di 3.9 dengan data L3/L4 |
| R12 | Exe tanpa tanda tangan → SmartScreen/antivirus memperingatkan | Sedang | Tinggi | Tanpa PowerShell/driver; dokumentasikan; keputusan signing di Fase 6/7 |
| R13 | Repo publik: log/artefak CI terbuka | Sedang | Sedang | `permissions: read`, tanpa secret, hanya data VM, fixture pribadi ditinjau manual |
| R14 | Runner `macos-15-intel` pensiun ±2027 | Rendah | Pasti | Regresi Intel lokal tetap di MacBook; arm64 jadi jalur utama CI macOS |
| R15 | Merge tanpa izin terulang | Tinggi | Tidak diketahui | Ruleset `main` + fine-grained token + aturan `docs/GIT-WORKFLOW.md` |

## 10. Acceptance criteria

**A. Kontrak & regresi macOS**
- [ ] Semua test lama (109) tetap lolos. Hasil di MacBook Intel asli tidak berubah, kecuali field baru yang memang ditambahkan.
- [ ] Field kontrak baru berupa `Option`, dicerminkan di TypeScript, dan test JSON lintas bahasa lolos.

**B. CI (L0–L2)**
- [ ] Job CI `windows`, `macos-intel`, dan `macos-arm64` hijau: typecheck, test frontend, build, fmt, clippy `-D warnings`, cargo test.
- [ ] Artefak laporan VM Windows dihasilkan tanpa crash dan dilabeli **VM**.
- [ ] Workflow tanpa secret, `permissions: contents: read`, action dipin SHA, dan tidak membuat tag/release.

**C. Logika (L1)**
- [ ] Setiap modul Windows punya test parser dengan fixture tersanitasi dari ≥1 laptop asli.
- [ ] Setiap ambang baru dites di batasnya.
- [ ] Kasus khusus dites: siklus 0, kapasitas relatif, multi-baterai, disk USB, Code 43/28, serial *placeholder*, Windows 11 dengan `ProductName` "Windows 10", counter PDH tidak ada, WMI timeout.

**D. Hardware asli (L3 Windows 11, L4 Windows 10)**
- [ ] Dengan **akun standar** dan **offline** (mode pesawat), 9 kartu tampil, setiap status punya alasan dan sumber data, dan tidak ada prompt UAC.
- [ ] Nilai cocok dengan alat pembanding bawaan Windows:

  | Data | Alat pembanding | Toleransi |
  |---|---|---|
  | Kapasitas desain/penuh, siklus | `powercfg /batteryreport` | Sama persis |
  | HealthStatus disk | `Get-PhysicalDisk` | Sama persis |
  | Kode masalah GPU, driver | Device Manager | Sama persis |
  | Model/VRAM GPU | Task Manager | Sama persis |
  | Beban CPU | Task Manager | Wajar sesuai waktu sampel |
  | MDM / Entra ID | `dsregcmd /status` | Sama persis |
  | Aktivasi | `slmgr /dli` | Sama persis |

- [ ] 10 kali pemeriksaan berturut-turut tanpa crash. Satu pemeriksaan selesai **< 10 detik**.
- [ ] Tidak ada proses PowerShell/cmd/driver yang dijalankan aplikasi (tinjau kode + Task Manager).

**E. Privasi & keamanan**
- [ ] Nomor seri hanya dibaca atas permintaan.
- [ ] UPN, tenant, domain, nama komputer, dan nama pengguna tidak ada di UI, log, maupun ekspor (diverifikasi pada file ekspor).
- [ ] Read-only, tanpa driver kernel, CSP tidak berubah.

**F. Distribusi (L5, sebagian)**
- [ ] Installer NSIS dan exe portable hasil `build-windows.yml` berjalan di laptop Windows 10/11 asli. Peringatan SmartScreen didokumentasikan.

**G. Dokumentasi**
- [ ] ARCHITECTURE, TASKS, dan PRD diperbarui, termasuk tingkat verifikasi per modul dan daftar yang belum terverifikasi.

## 11. Keputusan final (disetujui pemilik, 19 Nov 2026)

| # | Keputusan | Implementasi di Milestone 3.0 |
|---|---|---|
| D1 | Pisahkan pemeriksaan **inti** (baterai, SSD/HDD, RAM, CPU) dan **pelengkap** (temperatur, kipas, GPU). Bila data inti tidak tersedia, jangan menyimpulkan seluruh hardware sehat; tampilkan **"Pemeriksaan belum lengkap"**. | `CheckCategory` + `HardwareSummary` (`status`: healthy/warning/critical/**incomplete**, `measured/total`, `missingCore`, `missingSupplementary`). Temuan Kritis/Peringatan tetap tampil walau data belum lengkap. Pelengkap yang tidak terukur hanya dicatat di cakupan. |
| D2 | Judul kartu kepemilikan sesuai OS | `checkTitle(id, os)`: "Activation Lock & MDM" (macOS), "Aktivasi & Manajemen Perangkat" (Windows) |
| D3 | Status dukungan Windows berdasarkan edisi, versi, dan lifecycle yang dapat diverifikasi, **terpisah dari kesehatan hardware**; pertimbangkan ESU bila dapat dibaca andal | Kategori `DeviceSecurity` (Sistem & Kepemilikan) tidak memengaruhi `HardwareSummary`. Model `OsSupport` (`Supported`, `ExtendedSecurityUpdates`, `EndedEsuUnverified`, `Ended`) + sumber lifecycle. Tabel lifecycle dan deteksi ESU dikerjakan di 3.1; bila ESU tidak dapat dibaca andal → `EndedEsuUnverified`. |
| D4 | Jangan tampilkan nama organisasi, tenant ID, atau informasi sensitif | Model tidak punya field untuk itu (hanya jenis keanggotaan: Entra ID/Workplace/Domain) |
| D5 | Fitur eksperimental (keausan SSD, log error memori, suhu GPU) boleh dikembangkan, tetapi tidak dinyatakan terverifikasi sebelum diuji di hardware Windows asli | `Metric.experimental` + label "eksperimental" di UI. **Data eksperimental hanya bersifat informasi dan tidak mengubah status.** |
| D6 | Branch Fase 3 dari `main` yang sinkron; commit & push hanya dengan persetujuan masing-masing | Branch lokal `feature/windows-diagnostics` dari `21a5f43`; belum ada commit/push |
| D7 | CI VM bukan bukti hardware asli; validasi di laptop Windows asli wajib sebelum klaim kompatibilitas & rilis final | `PlatformSupport` (`Verified`/`Preview`) di `AppInfo`; Windows & Apple Silicon = **Preview** dengan banner di UI. Tingkat verifikasi L0–L5 (§6.2). |
| D8 | `metal_support` → `graphics_api` dengan menjaga kompatibilitas kontrak & test macOS | Diganti di model, parser macOS, penilaian, dan UI ("API grafis"); test macOS tetap lolos |

Tambahan model yang ditemukan saat finalisasi: kapasitas baterai kini memakai `CapacityUnit` (macOS **mAh**, Windows **mWh**) agar angka tidak salah dilabeli; keterbatasan deteksi kini disediakan lapisan platform (`Platform::notes`).
