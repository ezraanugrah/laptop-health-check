# Alur Git & GitHub — Laptop Health Check

Dokumen ini mengatur cara kode masuk ke `main` dan apa yang boleh/tidak boleh dilakukan Claude Code.
Dibuat setelah insiden 19 Nov 2026: PR #1 dibuat 8 detik setelah push dan di-merge 10 detik kemudian
(`21a5f43`) tanpa persetujuan eksplisit pemilik. Penyebab tidak dapat dipastikan (lihat ringkasan audit di bawah).

## 1. Prinsip

1. **Hanya pemilik yang me-merge ke `main`**, melalui GitHub web, setelah CI hijau.
2. **Claude tidak pernah membuat PR, me-merge, mengaktifkan auto-merge, menghapus branch, membuat tag, atau membuat release** tanpa persetujuan eksplisit untuk aksi tersebut (lihat §3).
3. Semua pekerjaan dilakukan di **branch fitur** (`feature/<nama>`). Tidak ada push langsung ke `main`.
4. Tidak ada `reset --hard`, `push --force`, atau penulisan ulang riwayat yang sudah di-push.

## 2. Alur standar per fase

```
main (terlindungi)
 └─ feature/<fase>           ← Claude bekerja & commit di sini (commit/push hanya atas izin)
     ├─ push branch          ← izin eksplisit per push
     ├─ CI berjalan otomatis (GitHub Actions, read-only)
     ├─ PR dibuat            ← oleh PEMILIK di GitHub web, atau oleh Claude sebagai DRAFT
     │                          hanya bila pemilik menulis persetujuan eksplisit
     └─ merge                ← oleh PEMILIK di GitHub web setelah CI hijau & ditinjau
```

Setelah merge: sinkronkan lokal dengan `git fetch origin` lalu `git merge --ff-only origin/main` (atas izin).

## 3. Aturan untuk Claude Code

| Aksi | Boleh tanpa izin? | Syarat |
|---|---|---|
| Membaca status Git/GitHub (`git status`, `git log`, `gh pr view`, `gh api` GET) | ✅ Ya | Hanya membaca |
| `git fetch` | ✅ Ya | Hanya memperbarui ref `origin/*`; disebutkan di laporan |
| Edit file di working tree | ✅ Ya (dalam lingkup tugas) | Dilaporkan; tidak dihapus tanpa izin |
| `git commit` | ❌ | Izin eksplisit, menyebut branch |
| `git push` branch fitur | ❌ | Izin eksplisit per push, menyebut branch |
| `git push` ke `main` | ❌ Tidak pernah | — |
| Membuat PR (`gh pr create`, API, tombol aplikasi) | ❌ | Izin eksplisit yang menyebut **"buat PR"** + branch sumber/tujuan; dibuat sebagai **Draft** |
| Merge PR (`gh pr merge`, API, tombol aplikasi) | ❌ Tidak pernah oleh Claude | Merge dilakukan pemilik |
| Auto-merge / merge queue | ❌ Tidak pernah | — |
| Hapus branch, tag, release | ❌ | Izin eksplisit per aksi |
| Ubah pengaturan repo / ruleset | ❌ | Pemilik yang mengubah |

Format persetujuan yang dianggap sah (ditulis pemilik di chat), contoh:
- "Saya setujui: push `feature/windows-diagnostics`."
- "Saya setujui: buat PR draft `feature/windows-diagnostics` → `main`."

Persetujuan berlaku **satu kali untuk aksi yang disebut**; tidak berlaku untuk aksi lain atau sesi berikutnya.
Setelah push, Claude memeriksa ulang status PR tepat sebelum melapor dan menyebut bahwa status dapat berubah setelah pemeriksaan.

## 4. Panduan GitHub Rulesets untuk `main` (dilakukan pemilik)

Rulesets tersedia gratis untuk repositori publik.

**Settings → Rules → Rulesets → New ruleset → New branch ruleset**

1. **Ruleset Name:** `Proteksi main`
2. **Enforcement status:** `Active`
3. **Target branches:** *Add target* → **Include default branch**
4. **Bypass list:** pilih salah satu (lihat §4.1)
5. **Branch rules** — centang:
   - ✅ **Restrict deletions**
   - ✅ **Block force pushes**
   - ✅ **Require a pull request before merging**
     - *Required approvals*: sesuai pilihan §4.1
     - ✅ *Require conversation resolution before merging*
     - *Allowed merge methods*: pilih satu saja (mis. **Merge** atau **Squash**)
   - ✅ **Require status checks to pass** — aktifkan **setelah** workflow CI Fase 3 berjalan sekali, lalu tambahkan check `windows`, `macos-intel`, dan `macos-arm64` (nama job di workflow `CI`)
   - ⬜ *Require linear history* — jangan dicentang bila memakai metode Merge commit
   - ⬜ *Require signed commits* — jangan dicentang (commit lokal belum ditandatangani)
6. **Create**.

### 4.1 Pilihan approval (repo satu pemilik)

GitHub tidak menghitung approval dari pembuat PR sendiri.

| Pilihan | Pengaturan | Efek |
|---|---|---|
| **A — Sederhana** | Required approvals = **0**, bypass list kosong | Push langsung & force push ke `main` diblokir; merge tetap bisa oleh akun pemilik (dan alat apa pun yang memakai tokennya) |
| **B — Langkah sengaja** | Required approvals = **1**, bypass: *Repository admin* → **For pull requests only** (bila opsi ini tersedia di UI) | Setiap merge butuh mencentang "bypass rules" secara sadar; push langsung tetap diblokir |
| C — Ketat | Required approvals = 1, tanpa bypass | Tidak ada yang bisa merge tanpa reviewer kedua — **tidak disarankan** untuk repo satu orang |

Rekomendasi: **B**, dikombinasikan dengan §4.2. Bila opsi *For pull requests only* tidak muncul, pakai **A** + §4.2.

### 4.2 Pengamanan tambahan (disarankan)

- **Settings → General → Pull Requests:** biarkan **Allow auto-merge** mati (saat ini mati); aktifkan hanya satu metode merge.
- **Token lokal:** ganti token `gh` (scope `repo`+`workflow`, akses penuh) dengan **fine-grained personal access token** khusus repo ini:
  *Contents: Read and write*, *Metadata: Read*, **tanpa** *Pull requests: write* dan **tanpa** *Administration*. Alat lokal (termasuk Claude) tetap bisa push branch, tetapi tidak bisa membuat atau me-merge PR; merge hanya lewat web oleh pemilik.
  Catatan: workflow `.github/workflows/*` butuh izin *Workflows: Read and write* saat file workflow di-push.
- **Settings → Emails:** aktifkan **Keep my email addresses private** dan **Block command line pushes that expose my email** (merge commit `21a5f43` memuat email pribadi akun).
- **Settings → Password and authentication:** pastikan 2FA aktif; tinjau **Sessions**, **Applications** (OAuth & GitHub Apps), dan **Personal access tokens** (kolom *Last used*).

### 4.3 Verifikasi setelah ruleset aktif

Claude dapat memverifikasi secara read-only:
```bash
gh api repos/ezraanugrah/laptop-health-check/rules/branches/main --jq '.[].type'
```
Harus memuat minimal: `deletion`, `non_fast_forward`, `pull_request` (dan `required_status_checks` setelah CI ada).

## 5. Ringkasan audit insiden PR #1 (19 Nov 2026)

- Push branch 04:05:46Z → PR dibuat 04:05:54Z → merge 04:06:04Z, semuanya atas nama akun pemilik via GitHub (committer `GitHub`).
- Tidak ditemukan: atribusi GitHub App, auto-merge, GitHub Actions, webhook, deploy key, kolaborator lain, git hooks/alias lokal, hook Claude Code, sesi Claude lain di repo ini, atau perintah PR/merge dari Claude.
- Isi `main` setelah merge identik dengan commit Fase 2 `077d1d3`; tidak ada perubahan yang hilang atau tambahan.
- Penyebab belum dapat dipastikan; pemilik disarankan meninjau Sessions/Applications/Tokens di GitHub.
